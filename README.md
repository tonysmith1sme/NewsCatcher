# NewsCatcher - X (Twitter) 智能新闻抓取与提炼机器人系统

NewsCatcher 是一款全自动的 Twitter (X) 新闻与资讯抓取提炼系统。通过设置 X (Twitter) 账号 Cookie，自动抓取指定监控源（关键词搜索、指定推主、Hashtag 话题等）的推文，并对接任意 OpenAI 兼容协议的大语言模型（LLM）进行智能总结、归类与过滤，最后将精炼后的新闻以 Markdown 文档的形式持久化存储在 SQLite 数据库中。

系统前端遵循 **Google Material Design 3 (M3)** 设计规范，设置页按 Tab 分区，反馈使用 Snackbar / Dialog，并内置 Markdown 阅读体验。

---

## 核心特性

- **全自动 X (Twitter) 抓取**：走现行 X GraphQL（`Viewer` 鉴权、`SearchTimeline` 搜索），自动生成 `x-client-transaction-id`。支持粘贴完整 Cookie（`auth_token` / `ct0` / `kdt` / `twid` 等），无需官方 API Key。
- **OpenAI 兼容 LLM 接口接入**：支持标准 OpenAI 协议（兼容 OpenAI、DeepSeek、Claude 代理、Qwen、Ollama 等），可配置自定义 Base URL、API Key 与 Model。
- **AI 提示词预设**：可保存多套 system / user 提示词（人格与文风），随时切换当前使用的一套；内置「专业主编」可一键恢复默认。
- **AI 智能提炼与分类过滤**：AI 自动阅读推文正文，生成精炼标题、概要总结以及完整 Markdown 报告，自动分类并仅保留用户关注的分类新闻入库。
- **Material Design 3 前端**：Vue 3 + Vite + `@material/web`。系统设置分为「抓取 / AI / 分类 / 通知 / 存储」五个 Tab；成功、失败与确认操作使用 M3 Snackbar 与 Dialog，不再弹出浏览器 `alert`。
- **动态定时任务调度**：支持灵活设定定时抓取周期（每 N 分钟、小时、天、周），包含运行日志查看与手动一键触发。
- **分类全生命周期管理**：支持自定义任意新分类，且允许删除默认的旧分类。
- **新新闻自动通知转发**：入库后可通过 Telegram Bot、QQ 机器人（Open API v2，含 `X-Union-Appid` / `msg_seq`，群聊会回退 `/v2/groups/`）或自定义 Webhook（Discord / Server酱 / Bark）推送。
- **原文保留与图片本地存储**：可开关配置在 Markdown 报告末尾保留推文原文，并自动将推文配图下载到运行目录或自定义绝对路径。
- **轻量 SQLite 数据库**：采用 SQLite + Prisma ORM，结构化存储推文原数据与提炼后的 Markdown 新闻文档。

---

## 技术栈

- **前端 (Frontend)**：Vue 3, Vite, TypeScript, `@material/web` (Material Design 3), Pinia, Vue Router, Marked
- **后端 (Backend)**：Node.js, TypeScript, Express, Prisma ORM, SQLite, Node-Cron, Axios, OpenAI SDK, x-client-transaction-id
- **运维与任务管理**：Concurrently（前后端单命令并行启动）

---

## 下载即用（普通用户）

从 [GitHub Releases](https://github.com/tonysmith1sme/NewsCatcher/releases) 下载对应系统的压缩包，解压后即可运行：

| 压缩包 | 系统 |
| --- | --- |
| `NewsCatcher-linux-x64.zip` | Linux x86_64（需 glibc，如 Ubuntu/Debian） |
| `NewsCatcher-linux-arm64.zip` | Linux ARM64 |
| `NewsCatcher-macos-x64.zip` | macOS Intel |
| `NewsCatcher-macos-arm64.zip` | macOS Apple Silicon |
| `NewsCatcher-windows-x64.zip` | Windows x64 |

解压后目录内已包含程序、空数据库 `data.db` 和 `media/` 图片目录：

```text
NewsCatcher-linux-x64/
  NewsCatcher          # Windows 为 NewsCatcher.exe
  data.db
  media/
  README.txt
```

Linux / macOS：

```bash
cd NewsCatcher-linux-x64
chmod +x NewsCatcher
./NewsCatcher
```

Windows：解压后双击 `NewsCatcher.exe`，或在 PowerShell 中执行 `.\NewsCatcher.exe`。

启动后终端会打印 `http://127.0.0.1:4000`，用浏览器打开即可。数据库、图片和运行文件都在同一目录，请整包一起移动。端口可用 `PORT`、`HOST` 覆盖。

macOS 若提示未知开发者，可执行 `xattr -cr ./NewsCatcher` 后再打开。

打 tag `v*` 并 push 后，GitHub Actions 会自动编译上述压缩包并发布到 Release。

---

## 开发者快速开始

### 1. 环境准备
确保本机已安装 Node.js (>= 18.x) 与 npm。

### 2. 克隆项目与安装依赖
```bash
git clone https://github.com/tonysmith1sme/NewsCatcher
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

- 开发前端：`http://localhost:4000`（Vite，代理到后端）
- 开发后端：`http://localhost:4001`
- 生产 / 二进制：同一端口（默认 `4000`）同时提供页面与 `/api/v1`
- REST 说明：[docs/api.md](docs/api.md)、[docs/openapi.yaml](docs/openapi.yaml)

本地打二进制：

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
npm run dist
```

产物在 `release/`。

---

## 详细使用教程

详细使用指引与配置说明请参阅 [使用教程文档 (docs/usage.md)](docs/usage.md)。

---

## 开源许可证

[MIT License](LICENSE)
