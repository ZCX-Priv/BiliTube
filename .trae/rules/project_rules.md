# BiliTube 项目编码规范

## Chrome 80+ 兼容性
- 本地开发必须用 `localhost`，禁止直接打开 HTML 文件

## 文档更新提醒
⚠️ 修改代码后必须同步更新文档：prd.md、CHANGELOG.md

## JavaScript 规范
- 使用 ES6+，优先 `const`/`let`，禁止 `var`
- 命名：小驼峰变量/函数，大驼峰类/状态对象，全大写常量
- 字符串用单引号，必须加分号
- 异步用 `async/await` + `fetch`，统一 try-catch 处理
- DOM 元素变量名加 `$` 后缀，如 `videoElement$`
- 使用状态对象集中管理模块状态，如 `HOME_STATE`

## CSS 规范
- 类名用 kebah-case，BEM 命名法
- 使用 CSS 变量（`--` 前缀），支持 dark 主题
- 优先 Flexbox/Grid，相对单位（rem/em/%）
- 避免使用 !important

## Python 规范
- PEP 8，中文注释
- 命名：全小写下划线（函数/变量/模块），大驼峰（类），全大写（常量）
- 使用 `typing` 模块添加类型注解
- 合理使用 LRU 缓存优化性能

## HTML 规范
- 使用 HTML5 doctype，设置 lang="zh-CN"
- 使用语义化标签：header、nav、main、article、aside、footer
- 属性值用双引号，闭合自闭合标签
- 为图片添加 alt 属性，为按钮/链接添加描述性文本
- script 放在 body 末尾，stylesheet 放 head

## 注释规范
- 函数使用 JSDoc 注释
- 复杂逻辑必须添加注释说明
- 禁止无意义注释和 TODO 而不处理
