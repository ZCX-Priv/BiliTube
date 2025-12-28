## 实现计划：读取.env中的cookie并应用到Bilibili搜索接口

### 1. 修改后端 (backend.py)

**步骤 1.1: 添加cookie配置支持**
- 在 `DEFAULT_CONFIG` 中添加 `"cookie": ""` 字段
- 在 `load_config()` 函数中读取 `BiliTube_cookie` 环境变量

**步骤 1.2: 修改代理处理器**
- 在 `ProxyHandler.handle_proxy()` 方法中检测请求URL是否是Bilibili搜索接口
- 搜索接口路径为：`api.bilibili.com/x/web-interface/wbi/search`
- 如果配置了cookie且是搜索接口，自动添加 `Cookie` 请求头

### 2. 配置示例

在 `.env` 文件中添加：
```
BiliTube_cookie="buvid3=xxx; bili_jct=xxx; SESSDATA=xxx"
```

### 实现细节

- **安全性**：cookie仅从服务器端读取，不暴露给客户端
- **精确匹配**：cookie仅对搜索接口生效，不影响其他代理请求
- **兼容性**：保持现有功能不变，仅扩展搜索功能