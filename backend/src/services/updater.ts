import fs from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { APP_VERSION, GITHUB_REPO } from '../version';
import { getAppHome, isPackaged } from '../runtime';
import { HttpError } from '../http/errors';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
  assetName: string;
  notes: string;
  packaged: boolean;
}

function normalizeVersion(tag: string): string {
  return String(tag || '').trim().replace(/^v/i, '');
}

function compareVersions(a: string, b: string): number {
  const pa = normalizeVersion(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = normalizeVersion(b).split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

export function releaseAssetName(): string {
  const { platform, arch } = process;
  if (platform === 'win32') return 'NewsCatcher-windows-x64.zip';
  if (platform === 'darwin' && arch === 'arm64') return 'NewsCatcher-macos-arm64.zip';
  if (platform === 'darwin') return 'NewsCatcher-macos-x64.zip';
  if (arch === 'arm64') return 'NewsCatcher-linux-arm64.zip';
  return 'NewsCatcher-linux-x64.zip';
}

function binaryNames(): string[] {
  return process.platform === 'win32' ? ['NewsCatcher.exe'] : ['NewsCatcher'];
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const currentVersion = APP_VERSION;
  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'NewsCatcher', Accept: 'application/vnd.github+json' },
    });
    const latestVersion = normalizeVersion(res.data?.tag_name || '');
    const assetName = releaseAssetName();
    const asset = (res.data?.assets || []).find((item: any) => item.name === assetName);
    return {
      currentVersion,
      latestVersion: latestVersion || currentVersion,
      updateAvailable: Boolean(latestVersion) && compareVersions(latestVersion, currentVersion) > 0 && Boolean(asset),
      releaseUrl: res.data?.html_url || `https://github.com/${GITHUB_REPO}/releases`,
      assetName,
      notes: String(res.data?.body || ''),
      packaged: isPackaged(),
    };
  } catch (err: any) {
    if (err.response?.status === 404) {
      return {
        currentVersion,
        latestVersion: currentVersion,
        updateAvailable: false,
        releaseUrl: `https://github.com/${GITHUB_REPO}/releases`,
        assetName: releaseAssetName(),
        notes: '',
        packaged: isPackaged(),
      };
    }
    throw new HttpError(502, 'UPDATE_CHECK_FAILED', `检查更新失败: ${err.message || '网络错误'}`);
  }
}

function findBinary(dir: string): string | null {
  const names = binaryNames();
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop() as string;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (names.includes(entry.name)) {
        return full;
      }
    }
  }
  return null;
}

export async function applyUpdate(): Promise<{ version: string; restartRequired: boolean }> {
  if (!isPackaged()) {
    throw new HttpError(400, 'NOT_PACKAGED', '当前不是二进制运行，无法自动替换程序文件');
  }
  const info = await checkForUpdate();
  if (!info.updateAvailable) {
    throw new HttpError(400, 'ALREADY_LATEST', '已是最新版本');
  }

  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
  const release = await axios.get(url, {
    timeout: 15000,
    headers: { 'User-Agent': 'NewsCatcher', Accept: 'application/vnd.github+json' },
  });
  const asset = (release.data?.assets || []).find((item: any) => item.name === info.assetName);
  if (!asset?.browser_download_url) {
    throw new HttpError(404, 'NOT_FOUND', `未找到更新包 ${info.assetName}`);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'newscatcher-update-'));
  const zipPath = path.join(tmpDir, info.assetName);
  const extractDir = path.join(tmpDir, 'extracted');
  fs.mkdirSync(extractDir, { recursive: true });

  const zipRes = await axios.get(asset.browser_download_url, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxRedirects: 5,
    headers: { 'User-Agent': 'NewsCatcher' },
  });
  fs.writeFileSync(zipPath, Buffer.from(zipRes.data));

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(extractDir, true);

  const nextBinary = findBinary(extractDir);
  if (!nextBinary) {
    throw new HttpError(500, 'UPDATE_INVALID', '更新包中未找到可执行文件');
  }

  const dest = process.execPath;
  const backup = `${dest}.bak`;
  if (fs.existsSync(backup)) {
    try { fs.unlinkSync(backup); } catch { /* ignore */ }
  }
  fs.renameSync(dest, backup);
  fs.copyFileSync(nextBinary, dest);
  try {
    fs.chmodSync(dest, 0o755);
  } catch { /* windows */ }

  return { version: info.latestVersion, restartRequired: true };
}


