import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { getSystemConfig } from './config';
import { getMediaDir } from '../runtime';

export class StorageService {
  public static async getStorageDir(): Promise<string> {
    const customDir = (await getSystemConfig('storage_media_dir', '')).trim();
    if (customDir) {
      if (!fs.existsSync(customDir)) {
        try {
          fs.mkdirSync(customDir, { recursive: true });
        } catch (e) {
          console.error(`创建自定义目录失败 [${customDir}]，退回默认目录:`, e);
        }
      }
      if (fs.existsSync(customDir)) {
        return customDir;
      }
    }

    const defaultDir = getMediaDir();
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
    return defaultDir;
  }

  public static async downloadImage(imageUrl: string, filename: string): Promise<string | null> {
    try {
      const storageDir = await this.getStorageDir();
      const savePath = path.join(storageDir, filename);

      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      fs.writeFileSync(savePath, Buffer.from(response.data));

      // Return relative URL for frontend serving
      return `/media/${filename}`;
    } catch (err: any) {
      console.error(`下载图片 [${imageUrl}] 失败:`, err.message);
      return null;
    }
  }
}
