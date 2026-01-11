# <img src="img/BiliTube.png" alt="BiliTube" width="40"> BiliTube

> 一个基于 Bilibili API、YouTube 风格的视频播放平台

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.7+-green.svg)
![HTML5](https://img.shields.io/badge/html5-orange.svg)
![CSS3](https://img.shields.io/badge/css3-blue.svg)
![JavaScript](https://img.shields.io/badge/javascript-yellow.svg)

[功能特性](#-功能特性) · [快速开始](#-快速开始) · [项目结构](#-项目结构) · [技术栈](#-技术栈) · [配置说明](#-配置说明)

</div>

---

## ✨ 功能特性

### 🎬 核心功能
- **视频播放** - 基于 HTML5 的视频播放器，支持高清/标清切换
- **弹幕系统** - 实时弹幕显示，支持开关控制
- **视频推荐** - 智能推荐相关视频，支持自动连播
- **搜索功能** - 支持搜索视频和用户，带搜索建议
- **订阅管理** - 关注 UP 主，查看订阅内容

### 💾 数据存储
- **观看历史** - 自动记录观看历史，支持断点续播
- **收藏管理** - 收藏喜欢的视频
- **点赞投币** - 支持点赞、投币、分享操作

### 🎨 用户体验
- **深色模式** - 支持深色/浅色主题切换
- **响应式设计** - 完美适配桌面和移动设备
- **流畅动画** - 精美的过渡动画和加载效果
- **侧边栏** - 可折叠的侧边栏导航

### 🚀 性能优化
- **智能缓存** - LRU 缓存机制，提升加载速度
- **懒加载** - 图片和视频按需加载
- **请求去重** - 防止重复请求，节省带宽
- **Gzip 压缩** - 自动压缩响应数据

---

## 🚀 快速开始

### 环境要求
- Python 3.7 或更高版本
- 现代浏览器（Chrome、Firefox、Edge、Safari）

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/yourusername/BiliTube.git
cd BiliTube
```

2. **配置服务器**（可选）
编辑 `config.json` 文件：
```json
{
  "host": "0.0.0.0",
  "port": 8000,
  "scheme": "http",
  "log_level": 3,
  "url_regex": "https?://[^\"'\\s]+"
}
```

3. **启动服务器**
```bash
python app.py
```

4. **访问应用**
打开浏览器访问：`http://localhost:8000`

---

## 📁 项目结构

```
BiliTube/
├── app.py                 # Python 后端代理服务器
├── config.json            # 配置文件
├── index.html             # 主页面
├── css/
│   └── style.css          # 样式文件
├── js/
│   ├── script.js          # 核心脚本
│   ├── home.js            # 首页逻辑
│   ├── player.js          # 视频播放器
│   ├── search.js          # 搜索功能
│   ├── search-suggest.js  # 搜索建议
│   ├── modal.js           # 模态框
│   ├── history.js         # 观看历史
│   ├── favorate.js        # 收藏功能
│   ├── love.js            # 点赞功能
│   ├── coin.js            # 投币功能
│   ├── share.js           # 分享功能
│   ├── subscribe.js       # 订阅功能
│   └── loading.js         # 加载动画
├── img/
│   ├── BiliTube.png       # Logo
│   ├── BiliTube-Font.png  # Logo 文字
│   ├── avatar-placeholder.png    # 头像占位图
│   └── thumbnail-placeholder.png # 缩略图占位图
└── README.md              # 项目说明
```

---

## 🛠 技术栈

### 后端
- **Python** - 主要编程语言
- **http.server** - HTTP 服务器
- **socketserver** - 套接字服务器
- **urllib** - HTTP 请求处理
- **gzip** - 数据压缩
- **threading** - 多线程处理

### 前端
- **HTML5** - 页面结构
- **CSS3** - 样式设计
  - CSS 变量
  - Flexbox 布局
  - CSS Grid 布局
  - 动画和过渡
- **JavaScript (ES6+)** - 交互逻辑
  - Fetch API
  - IndexedDB
  - DOM 操作
  - 事件处理

### 核心特性
- **单页应用 (SPA)** - 基于哈希路由
- **代理服务器** - 解决跨域问题
- **LRU 缓存** - 智能数据缓存
- **IndexedDB** - 本地数据存储

---

## ⚙️ 配置说明

### 服务器配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `host` | 服务器监听地址 | `0.0.0.0` |
| `port` | 服务器监听端口 | `8000` |
| `scheme` | 协议类型 | `http` |
| `log_level` | 日志级别 (0-4) | `3` |
| `url_regex` | URL 匹配正则 | `https?://[^\"'\\s]+` |
| `cookie` | Bilibili Cookie（可选） | `""` |
| `cache_size` | 缓存大小 | `200` |
| `cache_ttl` | 缓存过期时间（秒） | `60` |
| `max_connections` | 最大连接数 | `100` |

### 日志级别

- `0` - CRITICAL
- `1` - WARNING
- `2` - ERROR
- `3` - INFO
- `4` - DEBUG

### 环境变量

你也可以通过环境变量配置：

```bash
export BiliTube_HOST="0.0.0.0"
export BiliTube_PORT="8000"
export BiliTube_SCHEME="http"
export BiliTube_LOG_LEVEL="3"
export BiliTube_cookie="your_cookie_here"
```

---

## 🎯 API 接口

### 代理接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/proxy` | GET/POST | 代理请求 Bilibili API |
| `/stream` | GET | 流式传输视频数据 |
| `/clear_cache` | GET | 清除缓存 |

### Bilibili API

项目使用以下 Bilibili API：

- 视频推荐：`/x/web-interface/wbi/index/top/feed/rcmd`
- 热门视频：`/x/web-interface/popular`
- 视频信息：`/x/web-interface/view`
- 播放地址：`/x/player/playurl`
- 弹幕数据：`/comment.bilibili.com/{cid}.xml`
- 评论列表：`/x/v2/reply/main`
- 搜索接口：`/x/web-interface/wbi/search/type`
- 相关推荐：`/x/web-interface/archive/related`

---

## 📱 使用说明

### 首页
- 浏览推荐视频、热门视频
- 点击标签切换不同内容
- 下拉刷新或滚动加载更多

### 视频播放
- 点击视频卡片进入播放页面
- 支持播放/暂停、快进/快退
- 可切换高清/标清画质
- 支持弹幕开关
- 支持倍速播放
- 自动记录播放进度

### 搜索
- 在搜索框输入关键词
- 选择搜索视频或用户
- 支持搜索建议和历史记录

### 个人中心
- 查看观看历史
- 管理收藏视频
- 清空历史记录

---

## � AI 使用说明

本程序使用 Trae IDE 进行编辑，各 AI 模型分工如下：

| 负责领域 | AI 模型 |
|---------|---------|
| UI 设计 & 原型制作 | Gemini3 Pro |
| 前/后端编码 & 功能设计 | GPT 5.1 |
| 性能优化 & Bug 修复 | Minimax M2.1 |
| 文档制作 | GLM 4.7 |

感谢各 AI 模型的协作，共同完成了 BiliTube 项目的开发！

---

## �🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐️ Star 支持一下！**

Made with ❤️ by ThinkerX

</div>
