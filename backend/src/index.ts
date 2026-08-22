import express, { Request, Response } from 'express';
import cors from 'cors';
import { prisma, getSystemConfig, setSystemConfig } from './services/config';
import { TwitterService } from './services/twitter';
import { AIService } from './services/ai';
import { SchedulerService } from './services/scheduler';

const app = express();
app.use(cors());
app.use(express.json());

// --- News API ---
app.get('/api/news', async (req: Request, res: Response) => {
  try {
    const { category, search, page = '1', limit = '12' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    const where: any = {};
    if (category && category !== 'ALL') {
      where.category = category as string;
    }
    if (search) {
      where.OR = [
        { title: { contains: search as string } },
        { summary: { contains: search as string } },
        { markdownContent: { contains: search as string } },
        { author: { contains: search as string } },
      ];
    }

    const [total, news] = await Promise.all([
      prisma.news.count({ where }),
      prisma.news.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ]);

    res.json({ success: true, data: news, total, page: pageNum, limit: limitNum });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/news/:id', async (req: Request, res: Response) => {
  try {
    const news = await prisma.news.findUnique({ where: { id: req.params.id } });
    if (!news) {
      return res.status(404).json({ success: false, message: '未找到对应的新闻文章' });
    }
    res.json({ success: true, data: news });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/news/:id', async (req: Request, res: Response) => {
  try {
    await prisma.news.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: '已成功删除该条新闻' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- Config API ---
app.get('/api/config', async (req: Request, res: Response) => {
  try {
    const keys = ['x_auth_token', 'x_ct0', 'ai_base_url', 'ai_api_key', 'ai_model', 'target_categories', 'schedule_enabled', 'schedule_value', 'schedule_unit'];
    const configMap: Record<string, string> = {};
    for (const k of keys) {
      configMap[k] = await getSystemConfig(k);
    }
    res.json({ success: true, data: configMap });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/config', async (req: Request, res: Response) => {
  try {
    const configs: Record<string, string> = req.body;
    for (const [k, v] of Object.entries(configs)) {
      await setSystemConfig(k, String(v));
    }
    // Reload scheduler in case schedule settings changed
    await SchedulerService.reloadScheduler();
    res.json({ success: true, message: '系统配置更新成功' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- Sources API ---
app.get('/api/sources', async (req: Request, res: Response) => {
  try {
    const sources = await prisma.source.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: sources });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/sources', async (req: Request, res: Response) => {
  try {
    const { name, type, query, enabled = true } = req.body;
    if (!name || !query) {
      return res.status(400).json({ success: false, message: '名称和查询表达式不能为空' });
    }
    const source = await prisma.source.create({
      data: { name, type: type || 'search', query, enabled: Boolean(enabled) },
    });
    res.json({ success: true, data: source });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/sources/:id', async (req: Request, res: Response) => {
  try {
    await prisma.source.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: '抓取源已删除' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/api/sources/:id/toggle', async (req: Request, res: Response) => {
  try {
    const src = await prisma.source.findUnique({ where: { id: req.params.id } });
    if (!src) return res.status(404).json({ success: false, message: '源不存在' });
    const updated = await prisma.source.update({
      where: { id: req.params.id },
      data: { enabled: !src.enabled },
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- Test Connections API ---
app.post('/api/test/twitter', async (req: Request, res: Response) => {
  try {
    const { authToken, ct0 } = req.body;
    const result = await TwitterService.testCredentials(authToken, ct0);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/test/ai', async (req: Request, res: Response) => {
  try {
    const result = await AIService.testConnection();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- Task Execution API ---
app.post('/api/task/run', async (req: Request, res: Response) => {
  try {
    const result = await SchedulerService.triggerManualRun();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/api/logs', async (req: Request, res: Response) => {
  try {
    const logs = await prisma.executionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  console.log(`[NewsCatcher Backend] Server running on http://localhost:${PORT}`);
  // Initialize scheduler on startup
  await SchedulerService.initScheduler();
});
