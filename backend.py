import http.server
import json
import logging
import socketserver
import threading
import time
import urllib.parse
import urllib.request
import gzip
import os
import sys
import re
from collections import OrderedDict


DEFAULT_CONFIG = {
    "host": "0.0.0.0",
    "port": 8000,
    "scheme": "http",
    "log_level": 3,
    "url_regex": r"https?://[^\"'\s]+",
    "cookie": "",
    "cache_size": 200,
    "cache_ttl": 60,
    "max_connections": 100,
}


CACHE_MAX_SIZE = 200
CACHE_MAX_BYTES = 512 * 1024
CACHE_TTL = 60
DEDUP_WINDOW = 0.5


class LRUCache:
    def __init__(self, max_size=CACHE_MAX_SIZE, max_bytes=CACHE_MAX_BYTES, ttl=CACHE_TTL):
        self.max_size = max_size
        self.max_bytes = max_bytes
        self.ttl = ttl
        self.data = OrderedDict()
        self.timestamps = {}
        self._lock = threading.Lock()

    def _estimate_size(self, value):
        try:
            if isinstance(value, bytes):
                return len(value)
            return len(json.dumps(value, ensure_ascii=False))
        except Exception:
            return 1024

    def get(self, key):
        with self._lock:
            if key not in self.data:
                return None, None, False
            ts = self.timestamps.get(key, 0)
            if time.time() - ts > self.ttl:
                del self.data[key]
                del self.timestamps[key]
                return None, None, False
            self.data.move_to_end(key)
            return self.data[key], ts, True

    def set(self, key, value):
        with self._lock:
            if key in self.data:
                del self.data[key]
                if key in self.timestamps:
                    del self.timestamps[key]
            size = self._estimate_size(value)
            while len(self.data) >= self.max_size or self._get_current_bytes() + size > self.max_bytes:
                if not self.data:
                    break
                old_key, old_value = self.data.popitem(last=False)
                if old_key in self.timestamps:
                    del self.timestamps[old_key]
            self.data[key] = value
            self.timestamps[key] = time.time()

    def _get_current_bytes(self):
        total = 0
        for v in self.data.values():
            total += self._estimate_size(v)
        return total

    def clear(self):
        with self._lock:
            self.data.clear()
            self.timestamps.clear()


request_cache = LRUCache()
dedup_table = {}
dedup_lock = threading.Lock()


def get_cached_or_fetch(url, fetch_fn, cache_key=None):
    key = cache_key or url
    value, ts, hit = request_cache.get(key)
    if hit:
        logging.debug("Cache HIT: %s", key[:100])
        return value
    logging.debug("Cache MISS: %s", key[:100])
    value = fetch_fn()
    if value is not None:
        try:
            request_cache.set(key, value)
        except Exception as e:
            logging.warning("Cache set failed: %s", e)
    return value


def get_dedup_key(method, url, body):
    return (method, url, body if body else "")


def acquire_request(key):
    with dedup_lock:
        now = time.time()
        existing = dedup_table.get(key)
        if existing and now - existing < DEDUP_WINDOW:
            return False
        dedup_table[key] = now
        return True


def cleanup_dedup():
    now = time.time()
    with dedup_lock:
        keys_to_remove = [k for k, t in dedup_table.items() if now - t > DEDUP_WINDOW]
        for k in keys_to_remove:
            del dedup_table[k]


def load_dotenv(path=".env"):
    if not os.path.isfile(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip()
                if (
                    (value.startswith('"') and value.endswith('"'))
                    or (value.startswith("'") and value.endswith("'"))
                ):
                    value = value[1:-1]
                if key and key not in os.environ:
                    os.environ[key] = value
    except Exception:
        pass


def load_config():
    cfg = dict(DEFAULT_CONFIG)
    path = os.environ.get("BiliTube_CONFIG", "config.json")
    if os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for key in cfg.keys():
                if key in data:
                    cfg[key] = data[key]
        except Exception:
            pass
    host = os.environ.get("BiliTube_HOST")
    port = os.environ.get("BiliTube_PORT")
    scheme = os.environ.get("BiliTube_SCHEME")
    log_level = os.environ.get("BiliTube_LOG_LEVEL")
    url_regex = os.environ.get("BiliTube_URL_REGEX")
    if host:
        cfg["host"] = host
    if port:
        try:
            cfg["port"] = int(port)
        except ValueError:
            pass
    if scheme:
        cfg["scheme"] = scheme
    if log_level:
        try:
            cfg["log_level"] = int(log_level)
        except ValueError:
            pass
    if url_regex is not None:
        cfg["url_regex"] = url_regex
    cookie = os.environ.get("BiliTube_cookie")
    if cookie:
        cfg["cookie"] = cookie
    return cfg


load_dotenv()
CONFIG = load_config()


LOG_LEVEL_MAP = {
    0: logging.CRITICAL + 1,
    1: logging.WARNING,
    2: logging.ERROR,
    3: logging.INFO,
    4: logging.DEBUG,
}


def setup_logging():
    effective_level = LOG_LEVEL_MAP.get(CONFIG["log_level"], logging.INFO)
    logging.basicConfig(
        level=effective_level,
        format="[%(asctime)s] [%(levelname)s] %(message)s",
    )


def build_target_url(raw):
    if not raw:
        return None
    parsed = urllib.parse.urlsplit(raw)
    if parsed.scheme in ("http", "https"):
        return raw
    if raw.startswith("//"):
        return "https:" + raw
    return "http://" + raw


def rewrite_json_links(body, url_regex):
    if not url_regex:
        url_regex = r"https?://[^\"'\s]+"
    try:
        decoded = body.decode("utf-8")
    except Exception:
        return body
    try:
        data = json.loads(decoded)
    except Exception:
        return body
    try:
        pattern = re.compile(url_regex)
    except re.error:
        return body

    def transform(obj):
        if isinstance(obj, dict):
            return {k: transform(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [transform(v) for v in obj]
        if isinstance(obj, str):
            if pattern.search(obj):
                return "/proxy?u=" + urllib.parse.quote(obj, safe="")
            return obj
        return obj

    updated = transform(data)
    try:
        return json.dumps(updated, ensure_ascii=False).encode("utf-8")
    except Exception:
        return body


def apply_auto_referer_and_origin(headers, target_url):
    parsed = urllib.parse.urlsplit(target_url)
    scheme = parsed.scheme or "https"
    hostname = parsed.hostname or ""
    if not hostname:
        return
    origin = f"{scheme}://{hostname}"
    referer = origin + "/"
    if hostname.endswith("bilibili.com") or hostname.endswith("hdslb.com"):
        origin = "https://www.bilibili.com"
        referer = "https://www.bilibili.com/"
    if "Referer" not in headers:
        headers["Referer"] = referer
    if "Origin" not in headers:
        headers["Origin"] = origin


def compress_response(body):
    if not body or len(body) < 1024:
        return body, False
    try:
        compressed = gzip.compress(body, compresslevel=1)
        if compressed and len(compressed) < len(body) * 0.9:
            return compressed, True
    except Exception:
        pass
    return body, False


class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    server_version = "BiliTubeProxy/1.0"

    def log_message(self, format, *args):
        logging.info("%s - %s", self.client_address[0], format % args)

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type,Authorization,X-Requested-With",
        )

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == "/proxy":
            self.handle_proxy("GET", parsed)
            return
        if parsed.path == "/stream":
            self.handle_stream(parsed)
            return
        if parsed.path == "/clear_cache":
            request_cache.clear()
            self.send_response(200)
            self.send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(b'{"status":"cleared"}')
            return
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == "/proxy":
            self.handle_proxy("POST", parsed)
            return
        self.send_error(405, "Method Not Allowed")

    def handle_proxy(self, method, parsed):
        query = urllib.parse.parse_qs(parsed.query)
        raw = query.get("u", [""])[0]
        target = build_target_url(raw)
        if not target:
            self.send_error(400, "Missing or invalid target url")
            return
        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length) if length > 0 else None
        dedup_key = get_dedup_key(method, target, body)
        if not acquire_request(dedup_key):
            self.send_error(429, "Too Many Requests")
            return
        cleanup_dedup()
        outgoing_headers = {}
        for key, value in self.headers.items():
            lk = key.lower()
            if lk in ("host", "connection", "origin", "referer", "cookie", "accept-encoding"):
                continue
            outgoing_headers[key] = value
        parsed_target = urllib.parse.urlsplit(target)
        hostname = parsed_target.hostname or ""
        if hostname.endswith("bilibili.com") or hostname.endswith("hdslb.com"):
            if "Accept" not in outgoing_headers:
                outgoing_headers["Accept"] = (
                    "application/json,text/javascript,*/*;q=0.01"
                )
        apply_auto_referer_and_origin(outgoing_headers, target)
        if CONFIG.get("cookie") and parsed_target.path == "/x/web-interface/wbi/search/type":
            outgoing_headers["Cookie"] = CONFIG["cookie"]

        def fetch():
            try:
                req = urllib.request.Request(
                    target,
                    data=body,
                    headers=outgoing_headers,
                    method=method,
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    return resp.read()
            except Exception as e:
                logging.warning("代理请求失败: %s", e)
                return None

        try:
            raw_body = get_cached_or_fetch(target, fetch)
            if raw_body is None:
                self.send_response(502)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                payload = {"error": "bad_gateway", "message": "Failed to fetch target"}
                self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
                return
            status = 200
            content_type = "application/json; charset=utf-8"
            body_bytes = rewrite_json_links(raw_body, CONFIG["url_regex"])
            compressed, was_compressed = compress_response(body_bytes)
            self.send_response(status)
            self.send_cors_headers()
            if was_compressed:
                self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Type", content_type)
            self.send_header("X-Cache", "HIT" if request_cache.get(target)[2] else "MISS")
            hop_by_hop = {
                "connection",
                "keep-alive",
                "proxy-authenticate",
                "proxy-authorization",
                "te",
                "trailers",
                "transfer-encoding",
                "upgrade",
            }
            self.end_headers()
            self.wfile.write(compressed)
        except Exception as e:
            logging.warning("代理请求失败: %s", e)
            self.send_response(502)
            self.send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            payload = {"error": "bad_gateway", "message": str(e)}
            self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def handle_stream(self, parsed):
        query = urllib.parse.parse_qs(parsed.query)
        raw = query.get("u", [""])[0]
        target = build_target_url(raw)
        if not target:
            self.send_error(400, "Missing or invalid target url")
            return
        ua = self.headers.get("User-Agent")
        headers = {"Accept": "*/*", "Connection": "keep-alive"}
        if ua:
            headers["User-Agent"] = ua
        parsed_target = urllib.parse.urlsplit(target)
        hostname = parsed_target.hostname or ""
        apply_auto_referer_and_origin(headers, target)
        range_header = self.headers.get("Range")
        if range_header:
            headers["Range"] = range_header
        if CONFIG.get("cookie"):
            headers["Cookie"] = CONFIG["cookie"]
        
        max_retries = 3
        retry_count = 0
        last_error = None
        
        while retry_count < max_retries:
            try:
                req = urllib.request.Request(target, headers=headers, method="GET")
                with urllib.request.urlopen(req, timeout=60) as resp:
                    status = resp.getcode()
                    resp_headers = dict(resp.headers)
                    self.send_response(status)
                    self.send_cors_headers()
                    
                    if range_header and status == 206:
                        content_range = resp_headers.get("Content-Range", "")
                        content_length = resp_headers.get("Content-Length", "0")
                        if content_range:
                            parts = content_range.split(" ")
                            if len(parts) >= 2:
                                range_part = parts[1]
                                if "/" in range_part:
                                    total_size = range_part.split("/")[-1]
                                    self.send_header("Content-Length", content_length)
                                    self.send_header("Accept-Ranges", "bytes")
                    
                    hop_by_hop = {
                        "connection",
                        "keep-alive",
                        "proxy-authenticate",
                        "proxy-authorization",
                        "te",
                        "trailers",
                        "transfer-encoding",
                        "upgrade",
                    }
                    for key, value in resp_headers.items():
                        if key.lower() in hop_by_hop:
                            continue
                        if key.lower() == "access-control-allow-origin":
                            continue
                        self.send_header(key, value)
                    
                    self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                    self.send_header("Pragma", "no-cache")
                    self.end_headers()
                    
                    chunk_size = 512 * 1024
                    total_sent = 0
                    while True:
                        try:
                            chunk = resp.read(chunk_size)
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                            total_sent += len(chunk)
                        except Exception as e:
                            logging.warning("Chunk read error: %s", e)
                            break
                    return
            except Exception as e:
                last_error = e
                retry_count += 1
                if retry_count < max_retries:
                    time.sleep(0.5 * retry_count)
                    logging.warning("Stream retry %d/%d: %s", retry_count, max_retries, e)
                continue
        
        logging.warning("Stream failed after %d retries: %s", max_retries, last_error)
        self.send_response(502)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        payload = {"error": "stream_failed", "message": str(last_error)}
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))


def print_banner():
    host = CONFIG["host"]
    port = CONFIG["port"]
    scheme = CONFIG["scheme"]
    addr = f"{scheme}://{host}:{port}/"
    blue = "\033[94m"
    red = "\033[91m"
    reset = "\033[0m"
    text = f"{blue}Bili{red}Tube{reset}"
    cache_info = f"缓存: {CACHE_MAX_SIZE} 条, TTL: {CACHE_TTL}s"
    lines = [
        "",
        "==============================",
        f"          {text}          ",
        "==============================",
        "",
        "服务启动成功！",
        f"地址: {addr}",
        f"缓存: {CACHE_MAX_SIZE} 条, TTL: {CACHE_TTL}秒",
        "",
    ]
    for line in lines:
        sys.stdout.write(line + "\n")
        sys.stdout.flush()


def run_server():
    setup_logging()
    handler_cls = ProxyHandler
    server = socketserver.ThreadingTCPServer(
        (CONFIG["host"], CONFIG["port"]),
        handler_cls,
    )
    server.daemon_threads = True
    print_banner()
    while True:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            server.shutdown()
            break
        except Exception as e:
            logging.error("服务器错误，正在重启: %s", e)
            time.sleep(1)


if __name__ == "__main__":
    run_server()
