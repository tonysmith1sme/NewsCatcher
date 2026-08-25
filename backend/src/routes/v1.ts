import { Router } from 'express';
import { prisma } from '../services/config';
import { TwitterService } from '../services/twitter';
import { AIService } from '../services/ai';
import { SchedulerService } from '../services/scheduler';
import { NotificationService } from '../services/notification';
import {
  activatePromptPreset,
  createPromptPreset,
  deletePromptPreset,
  listPromptPresets,
  resetPromptPreset,
  updatePromptPreset,
} from '../services/promptPresets';
import { loadSettings, maskSettings, patchSettings } from '../services/settings';
import { generateApiKey, getStoredApiKey, persistApiKey } from '../http/auth';
import { HttpError } from '../http/errors';
import { asyncHandler } from '../http/asyncHandler';

const router = Router();

function parsePage(req: { query: any }, defaultSize = 12) {
  const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || req.query.limit || defaultSize), 10) || defaultSize, 1), 100);
  return { page, pageSize };
}

router.get('/health', (_req, res) => {
  res.json({ data: { status: 'ok' } });
});

router.post('/setup', asyncHandler(async (_req, res) => {
  const existing = await getStoredApiKey();
  if (existing) {
    throw new HttpError(403, 'ALREADY_INITIALIZED', 'API Key 已初始化，请使用现有密钥');
  }
  const apiKey = generateApiKey();
  await persistApiKey(apiKey);
  res.status(201).json({ data: { apiKey } });
}));

router.get('/settings', asyncHandler(async (req, res) => {
  const settings = await loadSettings();
  const reveal = String(req.query.reveal || '') === '1';
  const apiKey = await getStoredApiKey();
  res.json({
    data: {
      ...(reveal ? settings : maskSettings(settings)),
      apiKey: reveal ? apiKey : undefined,
    },
  });
}));

router.patch('/settings', asyncHandler(async (req, res) => {
  const updated = await patchSettings(req.body || {});
  res.json({ data: maskSettings(updated) });
}));

router.post('/settings/twitter/test', asyncHandler(async (req, res) => {
  const settings = await loadSettings();
  const authToken = req.body?.authToken || settings.twitter.authToken;
  const ct0 = req.body?.ct0 || settings.twitter.ct0;
  const result = await TwitterService.testCredentials(authToken, ct0);
  if (!result.success) {
    throw new HttpError(400, 'TWITTER_AUTH_FAILED', result.message);
  }
  res.json({ data: result });
}));

router.post('/settings/ai/test', asyncHandler(async (_req, res) => {
  const result = await AIService.testConnection();
  if (!result.success) {
    throw new HttpError(400, 'AI_TEST_FAILED', result.message);
  }
  res.json({ data: result });
}));

router.post('/settings/notifications/test', asyncHandler(async (req, res) => {
  const channel = String(req.body?.channel || req.body?.type || '');
  const testPayload = {
    title: 'NewsCatcher 测试通知测试消息',
    summary: '这是一条用于验证机器人通知转发接口的示例新闻摘要。',
    category: '测试',
    author: 'NewsCatcher Bot',
    originalUrl: 'https://x.com',
  };
  if (channel === 'telegram' || channel === 'tg') {
    await NotificationService.sendTelegram(testPayload);
  } else if (channel === 'qq') {
    await NotificationService.sendQQBot(testPayload);
  } else if (channel === 'webhook') {
    await NotificationService.sendCustomWebhook(testPayload);
  } else {
    await NotificationService.sendNotification(testPayload);
  }
  res.json({ data: { message: '测试通知发送指令已发出，请查看对应平台接收结果' } });
}));

router.post('/settings/api-key/rotate', asyncHandler(async (_req, res) => {
  const apiKey = generateApiKey();
  await persistApiKey(apiKey);
  res.json({ data: { apiKey } });
}));

router.get('/news', asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePage(req);
  const category = String(req.query.category || '');
  const search = String(req.query.q || req.query.search || '');
  const where: any = {};
  if (category && category !== 'ALL') where.category = category;
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { summary: { contains: search } },
      { markdownContent: { contains: search } },
      { author: { contains: search } },
    ];
  }
  const [total, items] = await Promise.all([
    prisma.news.count({ where }),
    prisma.news.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  res.json({ data: items, meta: { page, pageSize, total } });
}));

router.get('/news/:id', asyncHandler(async (req, res) => {
  const news = await prisma.news.findUnique({ where: { id: req.params.id }, include: { raw: true } });
  if (!news) throw new HttpError(404, 'NOT_FOUND', '未找到对应的新闻文章');
  res.json({ data: news });
}));

router.delete('/news/:id', asyncHandler(async (req, res) => {
  try {
    await prisma.news.delete({ where: { id: req.params.id } });
  } catch {
    throw new HttpError(404, 'NOT_FOUND', '未找到对应的新闻文章');
  }
  res.status(204).end();
}));

router.get('/sources', asyncHandler(async (_req, res) => {
  const items = await prisma.source.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ data: items });
}));

router.post('/sources', asyncHandler(async (req, res) => {
  const { name, type, query, enabled = true } = req.body || {};
  if (!name || !query) throw new HttpError(400, 'VALIDATION_ERROR', '名称和查询表达式不能为空');
  const source = await prisma.source.create({
    data: { name, type: type || 'search', query, enabled: Boolean(enabled) },
  });
  res.status(201).json({ data: source });
}));

router.get('/sources/:id', asyncHandler(async (req, res) => {
  const source = await prisma.source.findUnique({ where: { id: req.params.id } });
  if (!source) throw new HttpError(404, 'NOT_FOUND', '源不存在');
  res.json({ data: source });
}));

router.patch('/sources/:id', asyncHandler(async (req, res) => {
  const existing = await prisma.source.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new HttpError(404, 'NOT_FOUND', '源不存在');
  const { name, type, query, enabled } = req.body || {};
  const source = await prisma.source.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name: String(name) } : {}),
      ...(type !== undefined ? { type: String(type) } : {}),
      ...(query !== undefined ? { query: String(query) } : {}),
      ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
    },
  });
  res.json({ data: source });
}));

router.delete('/sources/:id', asyncHandler(async (req, res) => {
  try {
    await prisma.source.delete({ where: { id: req.params.id } });
  } catch {
    throw new HttpError(404, 'NOT_FOUND', '源不存在');
  }
  res.status(204).end();
}));

router.get('/prompt-presets', asyncHandler(async (_req, res) => {
  const { presets, activeId } = await listPromptPresets();
  res.json({ data: { items: presets, activeId } });
}));

router.post('/prompt-presets', asyncHandler(async (req, res) => {
  const { name, systemPrompt, userPromptTemplate } = req.body || {};
  if (!name || !String(name).trim()) throw new HttpError(400, 'VALIDATION_ERROR', '预设名称不能为空');
  const preset = await createPromptPreset({
    name: String(name),
    systemPrompt: String(systemPrompt || ''),
    userPromptTemplate: String(userPromptTemplate || ''),
  });
  res.status(201).json({ data: preset });
}));

router.get('/prompt-presets/:id', asyncHandler(async (req, res) => {
  const { presets } = await listPromptPresets();
  const preset = presets.find((p) => p.id === req.params.id);
  if (!preset) throw new HttpError(404, 'NOT_FOUND', '预设不存在');
  res.json({ data: preset });
}));

router.patch('/prompt-presets/:id', asyncHandler(async (req, res) => {
  try {
    const { name, systemPrompt, userPromptTemplate } = req.body || {};
    const preset = await updatePromptPreset(req.params.id, { name, systemPrompt, userPromptTemplate });
    res.json({ data: preset });
  } catch (err: any) {
    throw new HttpError(err.message === '预设不存在' ? 404 : 400, err.message === '预设不存在' ? 'NOT_FOUND' : 'VALIDATION_ERROR', err.message);
  }
}));

router.delete('/prompt-presets/:id', asyncHandler(async (req, res) => {
  try {
    await deletePromptPreset(req.params.id);
  } catch (err: any) {
    throw new HttpError(err.message === '预设不存在' ? 404 : 400, err.message === '预设不存在' ? 'NOT_FOUND' : 'VALIDATION_ERROR', err.message);
  }
  res.status(204).end();
}));

router.post('/prompt-presets/:id/activate', asyncHandler(async (req, res) => {
  try {
    const activeId = await activatePromptPreset(req.params.id);
    res.json({ data: { activeId } });
  } catch (err: any) {
    throw new HttpError(404, 'NOT_FOUND', err.message);
  }
}));

router.post('/prompt-presets/:id/reset', asyncHandler(async (req, res) => {
  try {
    const preset = await resetPromptPreset(req.params.id);
    res.json({ data: preset });
  } catch (err: any) {
    throw new HttpError(err.message.includes('仅内置') ? 400 : 404, err.message.includes('仅内置') ? 'VALIDATION_ERROR' : 'NOT_FOUND', err.message);
  }
}));

router.post('/jobs', asyncHandler(async (req, res) => {
  const type = String(req.body?.type || 'fetch');
  if (type !== 'fetch') throw new HttpError(400, 'VALIDATION_ERROR', '仅支持 type=fetch');
  try {
    const result = await SchedulerService.triggerManualRun();
    res.status(202).json({ data: result });
  } catch (err: any) {
    throw new HttpError(409, 'JOB_RUNNING', err.message);
  }
}));

router.get('/jobs', asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePage(req, 50);
  const [total, items] = await Promise.all([
    prisma.executionLog.count(),
    prisma.executionLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  res.json({ data: items, meta: { page, pageSize, total } });
}));

router.get('/jobs/:id', asyncHandler(async (req, res) => {
  const job = await prisma.executionLog.findUnique({ where: { id: req.params.id } });
  if (!job) throw new HttpError(404, 'NOT_FOUND', '任务记录不存在');
  res.json({ data: job });
}));

export default router;
