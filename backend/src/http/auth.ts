import { randomBytes } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { getSystemConfig, setSystemConfig } from '../services/config';
import { HttpError } from './errors';

export const API_KEY_CONFIG = 'api_access_key';

export function generateApiKey(): string {
  return randomBytes(32).toString('hex');
}

export async function getStoredApiKey(): Promise<string> {
  const envKey = (process.env.NEWSCATCHER_API_KEY || '').trim();
  if (envKey) return envKey;
  return (await getSystemConfig(API_KEY_CONFIG)).trim();
}

export async function persistApiKey(key: string): Promise<void> {
  await setSystemConfig(API_KEY_CONFIG, key);
}

export function readBearerToken(req: Request): string {
  const header = String(req.headers.authorization || '');
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  return String(req.headers['x-api-key'] || '').trim();
}

export async function requireApiKey(req: Request, _res: Response, next: NextFunction) {
  if (req.path === '/health' || req.path === '/setup') {
    return next();
  }
  try {
    const expected = await getStoredApiKey();
    if (!expected) {
      throw new HttpError(401, 'API_KEY_REQUIRED', '尚未初始化 API Key，请先调用 POST /api/v1/setup');
    }
    const provided = readBearerToken(req);
    if (!provided || provided !== expected) {
      throw new HttpError(401, 'UNAUTHORIZED', '无效或缺失的 API Key');
    }
    next();
  } catch (err) {
    next(err);
  }
}
