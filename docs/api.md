# NewsCatcher REST API

第三方前端请对接 **`/api/v1`**。内置 Vue 界面与外部客户端使用同一套接口。

- 文档机器可读版本：[openapi.yaml](./openapi.yaml)
- 开发后端地址：`http://<host>:4001`
- 二进制 / 生产：`http://<host>:4000`（页面与 API 同源）

## 鉴权

除以下接口外，均需携带 API Key：

- `GET /api/v1/health`
- `POST /api/v1/setup`（仅当尚未生成密钥时可用）

请求头：

```http
Authorization: Bearer <API_KEY>
```

也兼容 `X-Api-Key: <API_KEY>`。

可用环境变量 `NEWSCATCHER_API_KEY` 固定密钥。未设置时，首次调用 `POST /api/v1/setup` 会生成并返回密钥。之后可在系统设置 → 存储中查看或轮换。

## 响应格式

成功：

```json
{
  "data": {},
  "meta": { "page": 1, "pageSize": 12, "total": 0 }
}
```

`meta` 仅出现在分页列表。删除成功返回 `204` 空响应。创建返回 `201`，手动抓取返回 `202`。

失败：

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "无效或缺失的 API Key"
  }
}
```

常见 `code`：`UNAUTHORIZED`、`API_KEY_REQUIRED`、`ALREADY_INITIALIZED`、`NOT_FOUND`、`VALIDATION_ERROR`、`JOB_RUNNING`、`INTERNAL_ERROR`。

## 资源

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/health` | 健康检查（含 `version`） |
| GET | `/api/v1/updates` | 检查 GitHub Release 是否有新版本 |
| POST | `/api/v1/updates/apply` | 下载对应平台压缩包并替换当前二进制（不覆盖 data.db） |
| POST | `/api/v1/setup` | 首次生成 API Key |
| GET | `/api/v1/settings?reveal=1` | 读取分组配置；`reveal=1` 返回明文密钥 |
| PATCH | `/api/v1/settings` | 部分更新配置 |
| POST | `/api/v1/settings/twitter/test` | 测试 X Cookie |
| POST | `/api/v1/settings/ai/test` | 测试 AI 接口 |
| POST | `/api/v1/settings/notifications/test` | body: `{ "channel": "telegram"\|"qq"\|"webhook" }` |
| POST | `/api/v1/settings/api-key/rotate` | 轮换 API Key |
| GET | `/api/v1/news` | 查询参数：`category` `q` `page` `pageSize` |
| GET | `/api/v1/news/:id` | 新闻详情（含原文 `raw`） |
| DELETE | `/api/v1/news/:id` | 删除新闻 |
| GET/POST | `/api/v1/sources` | 列出 / 创建抓取源 |
| GET/PATCH/DELETE | `/api/v1/sources/:id` | 读取 / 更新 / 删除 |
| GET/POST | `/api/v1/prompt-presets` | 预设列表 `{ items, activeId }` / 新建 |
| GET/PATCH/DELETE | `/api/v1/prompt-presets/:id` | 预设读写 |
| POST | `/api/v1/prompt-presets/:id/activate` | 启用预设 |
| POST | `/api/v1/prompt-presets/:id/reset` | 恢复内置默认文案 |
| POST | `/api/v1/jobs` | body: `{ "type": "fetch" }` 手动抓取 |
| GET | `/api/v1/jobs` | 任务日志分页 |
| GET | `/api/v1/jobs/:id` | 单条任务日志 |

媒体文件仍为公开静态路径：`/media/*`、`/media_custom/*`。

## 设置体

```json
{
  "twitter": { "authToken": "", "ct0": "" },
  "ai": { "baseUrl": "https://api.openai.com/v1", "apiKey": "", "model": "gpt-3.5-turbo" },
  "schedule": { "enabled": false, "value": 1, "unit": "hours" },
  "notifications": {
    "telegram": { "enabled": false, "botToken": "", "chatId": "" },
    "qq": { "enabled": false, "appId": "", "clientSecret": "", "channelId": "", "openid": "" },
    "webhook": { "enabled": false, "url": "" }
  },
  "storage": { "saveOriginalText": true, "saveOriginalImages": true, "mediaDir": "" },
  "categories": { "all": ["AI"], "target": ["AI"] }
}
```

PATCH 只提交要改的字段。密钥若传脱敏值（以 `********` 开头）或空字符串，将保留原值。

## 旧路径

`/api/news`、`/api/config`、`/api/sources`、`/api/logs`、`/api/task/run` 等已移除，请改用上表。
