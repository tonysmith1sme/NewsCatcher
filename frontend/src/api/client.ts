import axios from 'axios';

export const API_KEY_STORAGE = 'newscatcher_api_key';

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

export function setApiKey(key: string) {
  if (key) localStorage.setItem(API_KEY_STORAGE, key);
  else localStorage.removeItem(API_KEY_STORAGE);
}

export const api = axios.create({
  baseURL: '/api/v1',
});

api.interceptors.request.use((config) => {
  const key = getApiKey();
  if (key) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${key}`;
  }
  return config;
});

export function apiError(err: any): string {
  return err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || '请求失败';
}

export async function ensureApiKey(): Promise<boolean> {
  if (getApiKey()) return true;
  try {
    const res = await axios.post('/api/v1/setup');
    const key = res.data?.data?.apiKey;
    if (key) {
      setApiKey(key);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
