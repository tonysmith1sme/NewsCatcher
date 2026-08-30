import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { getSystemConfig } from './services/config';
import { SchedulerService } from './services/scheduler';
import { requireApiKey } from './http/auth';
import { errorBody } from './http/errors';
import v1Router from './routes/v1';
import { getAppHome, getFrontendDir, getListenPort, getMediaDir, isPackaged, prepareRuntime } from './runtime';

prepareRuntime();

const app = express();
app.use(cors());
app.use(express.json());

const defaultMediaDir = getMediaDir();
if (!fs.existsSync(defaultMediaDir)) {
  fs.mkdirSync(defaultMediaDir, { recursive: true });
}
app.use('/media', express.static(defaultMediaDir));

app.use('/media_custom', async (req, res, next) => {
  const customDir = await getSystemConfig('storage_media_dir', '');
  if (customDir && fs.existsSync(customDir)) {
    return express.static(customDir)(req, res, next);
  }
  return express.static(defaultMediaDir)(req, res, next);
});

app.use('/api/v1', requireApiKey, v1Router);

const frontendDir = getFrontendDir();
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/media')) {
      return next();
    }
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const { status, body } = errorBody(err);
  if (status >= 500) {
    console.error('[API]', err);
  }
  res.status(status).json(body);
});

const PORT = getListenPort();
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, async () => {
  const displayHost = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
  console.log(`[NewsCatcher] 服务已启动: http://${displayHost}:${PORT}`);
  if (isPackaged()) {
    console.log(`[NewsCatcher] 数据目录: ${getAppHome()} （可用 NEWSCATCHER_HOME 覆盖）`);
  }
  await SchedulerService.initScheduler();
});
