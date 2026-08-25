import { getSystemConfig, setSystemConfig } from './config';
import { SchedulerService } from './scheduler';

export interface AppSettings {
  twitter: { authToken: string; ct0: string };
  ai: { baseUrl: string; apiKey: string; model: string };
  schedule: { enabled: boolean; value: number; unit: string };
  notifications: {
    telegram: { enabled: boolean; botToken: string; chatId: string };
    qq: { enabled: boolean; appId: string; clientSecret: string; channelId: string; openid: string };
    webhook: { enabled: boolean; url: string };
  };
  storage: { saveOriginalText: boolean; saveOriginalImages: boolean; mediaDir: string };
  categories: { all: string[]; target: string[] };
}

const SECRET_MASK = '********';

function parseJsonArray(raw: string, fallback: string[]): string[] {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : fallback;
  } catch {
    return fallback;
  }
}

function boolFrom(raw: string, fallback = false): boolean {
  if (!raw) return fallback;
  return raw === 'true';
}

export function maskSecret(value: string): string {
  if (!value) return '';
  const tail = value.slice(-4);
  return `${SECRET_MASK}${tail}`;
}

export function isMaskedSecret(value: unknown): boolean {
  return typeof value === 'string' && (value.startsWith(SECRET_MASK) || value === '');
}

export async function loadSettings(): Promise<AppSettings> {
  const [
    authToken, ct0, baseUrl, apiKey, model,
    scheduleEnabled, scheduleValue, scheduleUnit,
    tgEnabled, tgToken, tgChat,
    qqEnabled, qqAppId, qqSecret, qqChannel, qqOpenid,
    hookEnabled, hookUrl,
    saveText, saveImages, mediaDir,
    allCategories, targetCategories,
  ] = await Promise.all([
    getSystemConfig('x_auth_token'),
    getSystemConfig('x_ct0'),
    getSystemConfig('ai_base_url', 'https://api.openai.com/v1'),
    getSystemConfig('ai_api_key'),
    getSystemConfig('ai_model', 'gpt-3.5-turbo'),
    getSystemConfig('schedule_enabled', 'false'),
    getSystemConfig('schedule_value', '1'),
    getSystemConfig('schedule_unit', 'hours'),
    getSystemConfig('notify_tg_enabled', 'false'),
    getSystemConfig('notify_tg_bot_token'),
    getSystemConfig('notify_tg_chat_id'),
    getSystemConfig('notify_qq_enabled', 'false'),
    getSystemConfig('notify_qq_app_id'),
    getSystemConfig('notify_qq_client_secret'),
    getSystemConfig('notify_qq_channel_id'),
    getSystemConfig('notify_qq_openid'),
    getSystemConfig('notify_webhook_enabled', 'false'),
    getSystemConfig('notify_webhook_url'),
    getSystemConfig('save_original_text', 'true'),
    getSystemConfig('save_original_images', 'true'),
    getSystemConfig('storage_media_dir'),
    getSystemConfig('all_categories'),
    getSystemConfig('target_categories'),
  ]);

  return {
    twitter: { authToken, ct0 },
    ai: { baseUrl, apiKey, model },
    schedule: {
      enabled: boolFrom(scheduleEnabled),
      value: parseInt(scheduleValue, 10) || 1,
      unit: scheduleUnit || 'hours',
    },
    notifications: {
      telegram: { enabled: boolFrom(tgEnabled), botToken: tgToken, chatId: tgChat },
      qq: {
        enabled: boolFrom(qqEnabled),
        appId: qqAppId,
        clientSecret: qqSecret,
        channelId: qqChannel,
        openid: qqOpenid,
      },
      webhook: { enabled: boolFrom(hookEnabled), url: hookUrl },
    },
    storage: {
      saveOriginalText: boolFrom(saveText, true),
      saveOriginalImages: boolFrom(saveImages, true),
      mediaDir,
    },
    categories: {
      all: parseJsonArray(allCategories, ['AI', '金融', '科技', '政治', '游戏', '娱乐', '汽车', '体育', '其他']),
      target: parseJsonArray(targetCategories, ['AI', '金融', '科技']),
    },
  };
}

export function maskSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    twitter: { authToken: maskSecret(settings.twitter.authToken), ct0: maskSecret(settings.twitter.ct0) },
    ai: { ...settings.ai, apiKey: maskSecret(settings.ai.apiKey) },
    notifications: {
      telegram: { ...settings.notifications.telegram, botToken: maskSecret(settings.notifications.telegram.botToken) },
      qq: { ...settings.notifications.qq, clientSecret: maskSecret(settings.notifications.qq.clientSecret) },
      webhook: { ...settings.notifications.webhook },
    },
  };
}

async function writeIfPresent(key: string, value: unknown, secret = false) {
  if (value === undefined) return;
  if (secret && isMaskedSecret(value)) return;
  await setSystemConfig(key, String(value));
}

export async function patchSettings(patch: Record<string, any> = {}): Promise<AppSettings> {
  const twitter = patch.twitter || {};
  const ai = patch.ai || {};
  const schedule = patch.schedule || {};
  const notifications = patch.notifications || {};
  const telegram = notifications.telegram || {};
  const qq = notifications.qq || {};
  const webhook = notifications.webhook || {};
  const storage = patch.storage || {};
  const categories = patch.categories || {};

  await writeIfPresent('x_auth_token', twitter.authToken, true);
  await writeIfPresent('x_ct0', twitter.ct0, true);
  await writeIfPresent('ai_base_url', ai.baseUrl);
  await writeIfPresent('ai_api_key', ai.apiKey, true);
  await writeIfPresent('ai_model', ai.model);

  if (schedule.enabled !== undefined) await setSystemConfig('schedule_enabled', String(Boolean(schedule.enabled)));
  if (schedule.value !== undefined) await setSystemConfig('schedule_value', String(schedule.value));
  await writeIfPresent('schedule_unit', schedule.unit);

  if (telegram.enabled !== undefined) await setSystemConfig('notify_tg_enabled', String(Boolean(telegram.enabled)));
  await writeIfPresent('notify_tg_bot_token', telegram.botToken, true);
  await writeIfPresent('notify_tg_chat_id', telegram.chatId);

  if (qq.enabled !== undefined) await setSystemConfig('notify_qq_enabled', String(Boolean(qq.enabled)));
  await writeIfPresent('notify_qq_app_id', qq.appId);
  await writeIfPresent('notify_qq_client_secret', qq.clientSecret, true);
  await writeIfPresent('notify_qq_channel_id', qq.channelId);
  await writeIfPresent('notify_qq_openid', qq.openid);

  if (webhook.enabled !== undefined) await setSystemConfig('notify_webhook_enabled', String(Boolean(webhook.enabled)));
  await writeIfPresent('notify_webhook_url', webhook.url);

  if (storage.saveOriginalText !== undefined) await setSystemConfig('save_original_text', String(Boolean(storage.saveOriginalText)));
  if (storage.saveOriginalImages !== undefined) await setSystemConfig('save_original_images', String(Boolean(storage.saveOriginalImages)));
  await writeIfPresent('storage_media_dir', storage.mediaDir);

  if (categories.all !== undefined) await setSystemConfig('all_categories', JSON.stringify(categories.all));
  if (categories.target !== undefined) await setSystemConfig('target_categories', JSON.stringify(categories.target));

  await SchedulerService.reloadScheduler();
  return loadSettings();
}
