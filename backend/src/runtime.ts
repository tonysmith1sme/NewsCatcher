import fs from 'fs';
import path from 'path';

let prepared = false;

export function isPackaged(): boolean {
  return Boolean((process as any).pkg);
}

export function getAppHome(): string {
  if (process.env.NEWSCATCHER_HOME) {
    return path.resolve(process.env.NEWSCATCHER_HOME);
  }
  if (isPackaged()) {
    return path.dirname(process.execPath);
  }
  return process.cwd();
}

export function getDbPath(): string {
  if (isPackaged() || process.env.NEWSCATCHER_HOME) {
    return path.join(getAppHome(), 'data.db');
  }
  return path.join(process.cwd(), 'dev.db');
}

export function getMediaDir(): string {
  return path.join(getAppHome(), 'media');
}

export function getFrontendDir(): string {
  if (isPackaged()) {
    return path.join(__dirname, '../../frontend/dist');
  }
  return path.join(__dirname, '../../frontend/dist');
}

function queryEngineFileName(): string {
  const { platform, arch } = process;
  if (platform === 'win32' && arch === 'arm64') return 'query_engine-windows-arm64.dll.node';
  if (platform === 'win32') return 'query_engine-windows.dll.node';
  if (platform === 'darwin' && arch === 'arm64') return 'libquery_engine-darwin-arm64.dylib.node';
  if (platform === 'darwin') return 'libquery_engine-darwin.dylib.node';
  if (platform === 'linux' && arch === 'arm64') return 'libquery_engine-linux-arm64-openssl-3.0.x.so.node';
  return 'libquery_engine-debian-openssl-3.0.x.so.node';
}

function extractPrismaEngine(): void {
  const fileName = queryEngineFileName();
  const candidates = [
    path.join(__dirname, '../node_modules/.prisma/client', fileName),
    path.join(__dirname, '../../backend/node_modules/.prisma/client', fileName),
    path.join(__dirname, '../../node_modules/.prisma/client', fileName),
    path.join(process.cwd(), 'node_modules/.prisma/client', fileName),
  ];
  const source = candidates.find((p) => fs.existsSync(p));
  if (!source) {
    console.warn(`[Runtime] 未找到 Prisma engine: ${fileName}`);
    return;
  }
  if (!isPackaged()) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = source;
    return;
  }
  const destDir = path.join(getAppHome(), 'engines');
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, fileName);
  fs.copyFileSync(source, dest);
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = dest;
}

function ensureDatabase(): void {
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (fs.existsSync(dbPath)) return;
  const templates = [
    path.join(__dirname, '../prisma/template.db'),
    path.join(__dirname, '../../backend/prisma/template.db'),
  ];
  const template = templates.find((p) => fs.existsSync(p));
  if (template) {
    fs.copyFileSync(template, dbPath);
  }
}

export function prepareRuntime(): void {
  if (prepared) return;
  prepared = true;
  const home = getAppHome();
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(getMediaDir(), { recursive: true });
  ensureDatabase();
  extractPrismaEngine();
  process.env.DATABASE_URL = `file:${getDbPath()}`;
  if (isPackaged()) {
    const backup = `${process.execPath}.bak`;
    if (fs.existsSync(backup)) {
      try { fs.unlinkSync(backup); } catch { /* ignore */ }
    }
  }
}

export function getListenPort(): number {
  if (process.env.PORT) return Number(process.env.PORT);
  return isPackaged() ? 4000 : 4001;
}
