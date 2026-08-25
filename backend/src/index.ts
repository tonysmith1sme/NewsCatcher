import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { getSystemConfig } from './services/config';
import { SchedulerService } from './services/scheduler';
import { requireApiKey } from './http/auth';
import { errorBody } from './http/errors';
import v1Router from './routes/v1';

const app = express();
app.use(cors());
app.use(express.json());

const defaultMediaDir = path.join(process.cwd(), 'media');
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

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const { status, body } = errorBody(err);
  if (status >= 500) {
    console.error('[API]', err);
  }
  res.status(status).json(body);
});

const PORT = Number(process.env.PORT) || 4001;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, async () => {
  console.log(`[NewsCatcher Backend] Server running on http://${HOST}:${PORT}`);
  await SchedulerService.initScheduler();
});
