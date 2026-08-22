# NewsCatcher - X (Twitter) 智能新闻抓取与提炼机器人系统

NewsCatcher 是一款全自动的 Twitter (X) 新闻与资讯抓取提炼系统。通过设置 X (Twitter) 账号 Cookie，自动抓取指定监控源（关键词搜索、指定推主、Hashtag 话题等）的推文，并对接任意 OpenAI 兼容协议的大语言模型（LLM）进行智能总结、归类与过滤，最后将精炼后的新闻以 Markdown 文档的形式持久化存储在 SQLite 数据库中。

系统前端严格遵循 **Google Material Design 3 (M3)** 设计规范，提供极致优雅的美观界面与 Markdown 渲染阅读体验。

---

## 🌟 核心特性

- 🤖 **全自动 X (Twitter) 抓取**：遵循参照 X 原生 GraphQL/API 规范，通过配置账户 `auth_token` 与 `ct0` Cookie 实现高透明度免 API Key 访问与抓取。
- 🧠 **OpenAI 兼容 LLM 接口接入**：支持标准 OpenAI 协议（兼容 OpenAI, DeepSeek, Claude 代理, Qwen, Ollama 等），可配置自定义 Base URL、API Key 与 Model。
- 🎯 **AI 智能提炼与分类过滤**：AI 自动阅读推文正文，生成精炼标题、概要总结以及完整 Markdown 报告，自动分类并仅保留用户关注的分类新闻入库。
- 📖 **Material Design 3 前端 UI & Markdown 阅读器**：使用 Vue 3 + Vite 开发，应用官方 Material Design 3 组件规范，内置全屏 Markdown 渲染阅读器。
- ⏱️ **动态定时任务调度**：支持灵活设定定时抓取周期（每 N 分钟、小时、天、周），包含运行日志查看与手动一键触发。
- 🗃️ **分类全生命周期管理**：支持自定义任意新分类，且允许删除默认的旧分类。
- 🗄️ **轻量 SQLite 数据库**：采用 SQLite + Prisma ORM，结构化存储推文原数据与提炼后的 Markdown 新闻文档。

---

## 🛠️ 技术栈

- **前端 (Frontend)**：Vue 3, Vite, TypeScript, `@material/web` (Material Design 3), Pinia, Vue Router, Marked
- **后端 (Backend)**：Node.js, TypeScript, Express, Prisma ORM, SQLite, Node-Cron, Axios, OpenAI SDK
- **运维与任务管理**：Concurrently (前后端单命令并行启动)

---

## 🚀 快速开始

### 1. 环境准备
确保本机已安装 Node.js (>= 18.x) 与 npm。

### 2. 克隆项目与安装依赖
```bash
git clone <repository-url>
cd NewsCatcher

# 安装根目录依赖（包含 concurrently 自动化工具）
npm install

# 安装后端依赖
npm --prefix backend install

# 安装前端依赖
npm --prefix frontend install
```

### 3. 初始化 SQLite 数据库
```bash
npm --prefix backend run prisma:push
```

### 4. 一键同时启动前后端服务
```bash
npm run dev
```

- 前端访问地址：`http://localhost:4000` (或 `http://<IP>:4000`)
- 后端 API 地址：`http://localhost:4001` (或 `http://<IP>:4001`)

---

## 📖 详细使用教程

详细使用指引与配置说明请参阅 [使用教程文档 (docs/usage.md)](docs/usage.md)。

---

## 📄 开源许可证

[MIT License](LICENSE)
