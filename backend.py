import http.server
import json
import logging
import socketserver
import threading
import time
import urllib.parse
import urllib.request
import os
import sys
import re


DEFAULT_CONFIG = {
    "host": "0.0.0.0",
    "port": 8000,
    "scheme": "http",
    "log_level": 3,
    "user_agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "url_regex": r"https?://[^\"'\s]+",
}


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
    user_agent = os.environ.get("BiliTube_USER_AGENT")
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
    if user_agent:
        cfg["user_agent"] = user_agent
    if url_regex is not None:
        cfg["url_regex"] = url_regex
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
        outgoing_headers = {}
        for key, value in self.headers.items():
            lk = key.lower()
            if lk in ("host", "connection", "origin", "referer", "cookie"):
                continue
            outgoing_headers[key] = value
        if "User-Agent" not in outgoing_headers:
            outgoing_headers["User-Agent"] = CONFIG["user_agent"]
        parsed_target = urllib.parse.urlsplit(target)
        hostname = parsed_target.hostname or ""
        if hostname.endswith("bilibili.com") or hostname.endswith("hdslb.com"):
            cookie = (
                os.environ.get("BiliTube_Cookie")
                or os.environ.get("BiliTube_COOKIE")
                or os.environ.get("BILIBILI_COOKIE")
                or os.environ.get("BiliTube_COOKIE")
            )
            if cookie:
                outgoing_headers["Cookie"] = cookie
            if "Accept" not in outgoing_headers:
                outgoing_headers["Accept"] = (
                    "application/json,text/javascript,*/*;q=0.01"
                )
        apply_auto_referer_and_origin(outgoing_headers, target)
        req = urllib.request.Request(
            target,
            data=body,
            headers=outgoing_headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                status = resp.getcode()
                resp_headers = resp.headers
                raw_body = resp.read()
        except Exception as e:
            logging.warning("Proxy request failed: %s", e)
            self.send_response(502)
            self.send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            payload = {"error": "bad_gateway", "message": str(e)}
            self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
            return
        content_type = resp_headers.get("Content-Type", "")
        body_bytes = rewrite_json_links(raw_body, CONFIG["url_regex"])
        self.send_response(status)
        self.send_cors_headers()
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
        self.end_headers()
        self.wfile.write(body_bytes)

    def handle_stream(self, parsed):
        query = urllib.parse.parse_qs(parsed.query)
        raw = query.get("u", [""])[0]
        target = build_target_url(raw)
        if not target:
            self.send_error(400, "Missing or invalid target url")
            return
        ua = self.headers.get("User-Agent")
        headers = {"User-Agent": ua or CONFIG["user_agent"]}
        parsed_target = urllib.parse.urlsplit(target)
        hostname = parsed_target.hostname or ""
        if hostname.endswith("bilibili.com") or hostname.endswith("hdslb.com"):
            cookie = (
                os.environ.get("BiliTube_Cookie")
                or os.environ.get("BiliTube_COOKIE")
                or os.environ.get("BILIBILI_COOKIE")
                or os.environ.get("BiliTube_COOKIE")
            )
            if cookie:
                headers["Cookie"] = cookie
        apply_auto_referer_and_origin(headers, target)
        req = urllib.request.Request(target, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                status = resp.getcode()
                resp_headers = resp.headers
                self.send_response(status)
                self.send_cors_headers()
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
                self.end_headers()
                while True:
                    chunk = resp.read(64 * 1024)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        except Exception as e:
            logging.warning("Stream proxy failed: %s", e)
            self.send_response(502)
            self.send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            payload = {"error": "bad_gateway", "message": str(e)}
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
    lines = [
        "",
        "==============================",
        f"          {text}          ",
        "==============================",
        "",
        "服务启动成功！",
        f"地址: {addr}",
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
            logging.error("Server error, restarting: %s", e)
            time.sleep(1)


if __name__ == "__main__":
    run_server()
