## 概览

`backend.py` 实现了一个基于 Python 标准库的轻量级反向代理服务，用于为前端页面（BiliTube）提供统一的跨域访问能力，尤其针对 B 站（`bilibili.com` / `hdslb.com`）的接口与媒体资源做了专门适配。

核心能力：
- 提供 `/proxy` 与 `/stream` 两类代理入口
- 自动补全与规范化目标 URL
- 自动设置 `User-Agent`、`Referer`、`Origin` 等关键头
- 支持通过环境变量与 `config.json` 配置主机、端口、日志等级等
- 对 JSON 响应中的外链进行重写，将其改写为继续通过本代理访问
- 为前端暴露统一的 CORS 友好接口（`Access-Control-Allow-*`）

## 启动与运行方式

入口函数为 `run_server()`（`backend.py:370`），脚本直接执行时会启动服务：

```bash
python backend.py
```

运行流程：
- `load_dotenv()` 加载 `.env` 文件到环境变量（`backend.py:27`）
- `load_config()` 合并默认配置、`config.json` 及环境变量（`backend.py:52`）
- `setup_logging()` 根据配置初始化日志（`backend.py:104`）
- 使用 `socketserver.ThreadingTCPServer` 启动多线程 HTTP 服务（`backend.py:373`）
- 使用 `ProxyHandler` 处理所有 HTTP 请求（`backend.py:372`）

终端会打印启动横幅和服务地址（`print_banner()`，`backend.py:346`），示例：

```text
服务启动成功！
地址: http://0.0.0.0:8000/
```

## 配置系统

### 默认配置

默认配置定义在 `DEFAULT_CONFIG`（`backend.py:14`）：

- `host`：监听地址，默认 `0.0.0.0`
- `port`：监听端口，默认 `8000`
- `scheme`：用于打印服务地址的协议字符串，默认 `http`
- `log_level`：日志等级（0–4），默认 `3`
  - `0`：完全静默（比 `CRITICAL` 还高，等于「关闭」）
  - `1`：仅警告及更严重
  - `2`：错误及更严重
  - `3`：信息级日志
  - `4`：调试日志
- `user_agent`：代理请求使用的 UA 字符串，默认模拟桌面 Chrome
- `url_regex`：用于匹配 JSON 中需要改写的 URL 的正则

### 配置加载顺序

`load_config()`（`backend.py:52`）会按以下优先级加载配置（后者覆盖前者）：

1. `DEFAULT_CONFIG`
2. 配置文件 `config.json`
   - 文件路径来自环境变量 `BiliTube_CONFIG`，默认值为 `config.json`
   - 若存在，则尝试读取其中与默认配置同名的字段
3. 环境变量
   - `BiliTube_HOST` → `host`
   - `BiliTube_PORT` → `port`
   - `BiliTube_SCHEME` → `scheme`
   - `BiliTube_LOG_LEVEL` → `log_level`
   - `BiliTube_USER_AGENT` → `user_agent`
   - `BiliTube_URL_REGEX` → `url_regex`

此外，在调用 `load_config()` 之前，`load_dotenv()` 会从 `.env` 文件中读入键值对到进程环境（仅当环境中原本不存在该键时进行覆盖）。

### B 站 Cookie 配置

在访问 B 站域名时，代理会尝试附加登录 Cookie，以支持需要登录状态的接口（如历史记录、稍后再看等）：

在 `handle_proxy()` 与 `handle_stream()` 中，会依次从下列环境变量中读取 Cookie（`backend.py:230`、`backend.py:298`）：

- `BiliTube_Cookie`
- `BiliTube_COOKIE`
- `BILIBILI_COOKIE`
- `BiliTube_COOKIE`

找到的第一个非空值会被添加到下游请求的 `Cookie` 头。

## URL 规范化与构建

函数 `build_target_url(raw)`（`backend.py:112`）负责将前端传来的原始目标地址规范化为完整 URL：

- 若 `raw` 已经是 `http://` 或 `https://` 开头的完整 URL，直接返回
- 若以 `//` 开头（协议相对 URL），补全为 `https:` 前缀
- 其他情况（如仅域名或路径），统一补全为 `http://` 前缀

如果最终无法得到有效 URL，则视为无效，调用方会返回 `400` 错误。

## JSON 链接重写机制

函数 `rewrite_json_links(body, url_regex)`（`backend.py:123`）用于对 JSON 响应中的 URL 进行重写，使后续请求仍然经过本代理：

处理流程：
- 尝试将 `body` 按 UTF-8 解码为字符串
- `json.loads` 解析为 Python 对象
- 使用 `url_regex` 构造正则表达式（若为空则使用默认 `https?://[^"'\\s]+`）
- 递归遍历 JSON 对象中的所有字段：
  - 对于字符串字段，若匹配到 URL，则将该字符串替换为 `/proxy?u=<urlencode(原始URL)>`
  - 其余类型（数字、布尔、对象、数组）保持不变
- 将修改后的对象通过 `json.dumps` 再编码回 UTF-8 字节串

注意：
- 若任一步解析失败（非 UTF-8、非 JSON、正则错误等），函数会直接返回原始 `body`，保证不因重写导致错误。
- 仅对 JSON 内容进行重写，其他类型（如视频流、二进制文件）不会受到影响。

## 自动设置 Referer 与 Origin

函数 `apply_auto_referer_and_origin(headers, target_url)`（`backend.py:157`）会根据目标地址自动填充 `Referer` 与 `Origin` 头（仅在调用时这些头不存在的情况下）：

- 先根据 `target_url` 拆解出协议与主机，默认协议为 `https`
- 构造默认的：
  - `Origin`：`<scheme>://<hostname>`
  - `Referer`：`<Origin>/`
- 若主机后缀为 `bilibili.com` 或 `hdslb.com`，则强制使用：
  - `Origin`：`https://www.bilibili.com`
  - `Referer`：`https://www.bilibili.com/`

该逻辑可以模拟浏览器正常来源，避免部分接口因来源校验失败。

## 核心请求处理逻辑

### 路由分发

`ProxyHandler` 继承自 `http.server.SimpleHTTPRequestHandler`（`backend.py:174`），主要重写了 `do_OPTIONS`、`do_GET`、`do_POST` 方法。

路由规则（`backend.py:193`、`backend.py:203`）：

- `OPTIONS *`：
  - 无条件返回 `204`，并附带 CORS 头
- `GET /proxy?u=...`：
  - 调用 `handle_proxy("GET", parsed)` 进行转发
- `POST /proxy?u=...`：
  - 调用 `handle_proxy("POST", parsed)` 进行转发
- `GET /stream?u=...`：
  - 调用 `handle_stream(parsed)` 进行流式转发
- 其他 `GET`：
  - 回退到父类的静态文件处理逻辑（可用于本地静态资源托管）
- 其他 `POST`：
  - 返回 `405 Method Not Allowed`

### CORS 处理

方法 `send_cors_headers()`（`backend.py:180`）为所有代理响应附加以下头：

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET,POST,OPTIONS`
- `Access-Control-Allow-Headers: Content-Type,Authorization,X-Requested-With`

`do_OPTIONS`、`handle_proxy`、`handle_stream` 中都会调用该方法，保证前端在任意域名下都可以直接访问该代理接口。

### 通用响应头过滤

在 `handle_proxy()` 与 `handle_stream()` 中，会在回传上游响应头之前过滤掉下列跳跃式（hop-by-hop）头（`backend.py:267`、`backend.py:314`）：

- `Connection`
- `Keep-Alive`
- `Proxy-Authenticate`
- `Proxy-Authorization`
- `TE`
- `Trailers`
- `Transfer-Encoding`
- `Upgrade`

同时忽略上游返回的 `Access-Control-Allow-Origin`，避免与自身设置的 `*` 冲突。

## /proxy 接口

实现位置：`handle_proxy(self, method, parsed)`（`backend.py:210`）。

### 请求规范

- HTTP 方法：`GET` 或 `POST`
- 路径：`/proxy`
- 查询参数：
  - `u`：必填，目标资源的 URL 或 URL 片段
    - 示例：`/proxy?u=https%3A%2F%2Fapi.bilibili.com%2Fx%2Fweb-interface%2Fsearch`
    - 示例：`/proxy?u=api.bilibili.com%2Fx%2Fweb-interface%2Fsearch`（会自动补全为 `http://`）
- 请求体：
  - 对于 `POST`，原样转发到目标服务器
- 请求头：
  - 所有 header 会被遍历一遍，以下字段被剔除：
    - `Host`
    - `Connection`
    - `Origin`
    - `Referer`
    - `Cookie`
  - 其余头将被原样转发
  - 额外覆盖/添加的头：
    - `User-Agent`：固定为配置中的 UA
    - 若目标是 B 站域名：
      - `Cookie`：读取环境变量中配置的登录 Cookie
      - `Accept`：若请求头中没有 `Accept`，则设置为 `application/json,text/javascript,*/*;q=0.01`
  - 最后调用 `apply_auto_referer_and_origin` 自动补充 `Referer` 与 `Origin`

### 响应处理

- 发起下游请求：
  - 使用 `urllib.request.urlopen`，超时时间 30 秒
- 如果下游请求失败：
  - 返回 HTTP `502 Bad Gateway`
  - 响应头：
    - `Content-Type: application/json; charset=utf-8`
    - CORS 相关头
  - 响应体：
    - `{"error": "bad_gateway", "message": "<异常信息>"}`（UTF-8 JSON）
- 如果请求成功：
  - 读取完整响应体 `raw_body`
  - 调用 `rewrite_json_links(raw_body, CONFIG["url_regex"])` 尝试对 JSON 中 URL 进行改写
  - 返回实际下游响应码（例如 200、404 等）
  - 复制下游响应头（过滤 hop-by-hop 头与下游的 CORS 头）
  - 响应体为处理后的字节串 `body_bytes`

无论成功或失败，都会通过 `send_cors_headers()` 设置 CORS，供前端安全访问。

## /stream 接口

实现位置：`handle_stream(self, parsed)`（`backend.py:286`）。

`/stream` 更适合用于转发大文件/媒体资源，如视频分片、音频流等。

### 请求规范

- HTTP 方法：`GET`
- 路径：`/stream`
- 查询参数：
  - `u`：必填，目标资源 URL 或片段（与 `/proxy` 相同的规范）
- 请求头：
  - 构造新的请求头，仅包含：
    - `User-Agent`：配置中的 UA
    - 若目标为 B 站域名，则附加 Cookie（从环境变量中读取）
  - 同样调用 `apply_auto_referer_and_origin` 自动填充 `Referer` 与 `Origin`

### 流式转发

处理流程：
- 向目标服务器发起 `GET` 请求
- 读取上游响应状态码与响应头，并返回给前端（同样过滤 hop-by-hop 头和上游 CORS 头）
- 在一个循环中以 64 KB 为块大小连续读取上游响应体，将每块数据写入 `self.wfile`
  - 一旦读取到空块（EOF），循环结束

错误处理：
- 若过程中出现异常，返回 `502 Bad Gateway`
- 同 `/proxy` 一样返回 JSON 错误结构，并附带 CORS 头

## 日志与调试

### 日志等级映射

`LOG_LEVEL_MAP`（`backend.py:95`）将数值配置映射到 `logging` 模块的等级：

- `0` → `logging.CRITICAL + 1`（相当于关闭所有日志）
- `1` → `logging.WARNING`
- `2` → `logging.ERROR`
- `3` → `logging.INFO`
- `4` → `logging.DEBUG`

`setup_logging()` 使用该映射配置全局日志格式为：

```text
[时间] [等级] 消息内容
```

### 访问日志

`ProxyHandler.log_message()`（`backend.py:177`）重写了父类日志行为，将每条访问日志记录为：

```text
<客户端 IP> - <HTTP 请求行 / 自定义消息>
```

具体日志内容会根据 `log_level` 设置决定是否输出。

## 部署与使用建议

- 推荐在本地或内网环境中启动该代理，再由前端 JS 通过 `fetch` 或 `XMLHttpRequest` 调用 `/proxy` 与 `/stream`
- 若部署在公网，建议：
  - 使用上游反向代理（如 Nginx）为其增加 HTTPS 支持
  - 在反向代理层限制可访问的路径与来源 IP
  - 根据需要添加鉴权措施（当前实现未集成认证）
- 在生产环境中建议将 `log_level` 设置为 `2` 或 `1`，以减少日志噪音

## 前端接入示例

### 调用 JSON 接口

```js
// 例如请求 B 站某 JSON 接口
const target = 'https://api.bilibili.com/x/web-interface/search';
const url = '/proxy?u=' + encodeURIComponent(target);

const params = { keyword: 'test' };

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(params),
})
  .then((res) => res.json())
  .then((data) => {
    console.log(data);
  });
```

### 播放媒体流

```js
// 将真实媒体 URL 包裹为 /stream 代理地址
const mediaUrl = 'https://example.com/video.m4s';
const proxied = '/stream?u=' + encodeURIComponent(mediaUrl);

const video = document.querySelector('video');
video.src = proxied;
video.play();
```

## 小结

该后端代理通过纯标准库实现了：

- 针对 B 站生态优化的 HTTP 反向代理
- 自动处理跨域、来源、登录 Cookie 等细节
- 对 JSON 中嵌套链接进行递归重写，保证所有后续请求继续走代理

前端只需与本服务的 `/proxy` 和 `/stream` 交互，即可在浏览器中安全、统一地访问目标站点的 API 与媒体资源。

