import axios from 'axios';
import { getSystemConfig } from './config';

export interface NotificationPayload {
  title: string;
  summary: string;
  category: string;
  author: string;
  originalUrl: string;
}

export class NotificationService {
  public static async sendNotification(payload: NotificationPayload): Promise<void> {
    const tgEnabled = (await getSystemConfig('notify_tg_enabled', 'false')) === 'true';
    const qqEnabled = (await getSystemConfig('notify_qq_enabled', 'false')) === 'true';
    const webhookEnabled = (await getSystemConfig('notify_webhook_enabled', 'false')) === 'true';

    const promises: Promise<any>[] = [];

    if (tgEnabled) {
      promises.push(this.sendTelegram(payload));
    }
    if (qqEnabled) {
      promises.push(this.sendQQBot(payload));
    }
    if (webhookEnabled) {
      promises.push(this.sendCustomWebhook(payload));
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  // Telegram Bot API
  public static async sendTelegram(payload: NotificationPayload): Promise<void> {
    const botToken = await getSystemConfig('notify_tg_bot_token');
    const chatId = await getSystemConfig('notify_tg_chat_id');

    if (!botToken || !chatId) return;

    const messageText = `📰 *【NewsCatcher 新闻收录】*\n\n` +
      `*标题*: ${this.escapeMarkdownV2(payload.title)}\n` +
      `*分类*: ${this.escapeMarkdownV2(payload.category)}\n` +
      `*推主*: ${this.escapeMarkdownV2(payload.author)}\n\n` +
      `*摘要*: ${this.escapeMarkdownV2(payload.summary)}\n\n` +
      `[查看原推](${payload.originalUrl})`;

    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: messageText,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: false,
      }, { timeout: 10000 });
      console.log('[Notification] Telegram 消息发送成功');
    } catch (err: any) {
      console.error('[Notification] Telegram 发送失败:', err.response?.data || err.message);
    }
  }

  // QQ 机器人 API v2 (https://bot.q.qq.com/wiki/develop/api-v2/)
  public static async sendQQBot(payload: NotificationPayload): Promise<void> {
    const appId = await getSystemConfig('notify_qq_app_id');
    const clientSecret = await getSystemConfig('notify_qq_client_secret');
    const channelId = await getSystemConfig('notify_qq_channel_id');
    const openid = await getSystemConfig('notify_qq_openid'); // C2C or Group openid

    if (!appId || !clientSecret) return;

    try {
      // 1. Get AccessToken for QQ Bot API v2
      const tokenRes = await axios.post('https://bots.qq.com/app/getAppAccessToken', {
        appId: appId,
        clientSecret: clientSecret,
      }, { timeout: 10000 });

      const accessToken = tokenRes.data?.access_token;
      if (!accessToken) {
        console.error('[Notification] QQ Bot 获取 AccessToken 失败');
        return;
      }

      const content = `📰【NewsCatcher 新闻推送】\n` +
        `标题：${payload.title}\n` +
        `分类：${payload.category}\n` +
        `作者：${payload.author}\n` +
        `摘要：${payload.summary}\n` +
        `链接：${payload.originalUrl}`;

      // Channel message or Direct C2C/Group message
      if (channelId) {
        await axios.post(`https://api.sgroup.qq.com/channels/${channelId}/messages`, {
          content: content,
        }, {
          headers: { Authorization: `QQBot ${accessToken}` },
          timeout: 10000,
        });
      } else if (openid) {
        await axios.post(`https://api.sgroup.qq.com/v2/users/${openid}/messages`, {
          content: content,
          msg_type: 0,
        }, {
          headers: { Authorization: `QQBot ${accessToken}` },
          timeout: 10000,
        });
      }
      console.log('[Notification] QQ 机器人消息发送成功');
    } catch (err: any) {
      console.error('[Notification] QQ 机器人发送失败:', err.response?.data || err.message);
    }
  }

  // Custom Webhook (Discord / Server酱 / Bark)
  public static async sendCustomWebhook(payload: NotificationPayload): Promise<void> {
    const webhookUrl = await getSystemConfig('notify_webhook_url');
    if (!webhookUrl) return;

    try {
      await axios.post(webhookUrl, {
        msgtype: 'text',
        text: `【NewsCatcher 新闻通知】${payload.title}`,
        title: payload.title,
        summary: payload.summary,
        category: payload.category,
        author: payload.author,
        url: payload.originalUrl,
      }, { timeout: 10000 });
      console.log('[Notification] 自定义 Webhook 发送成功');
    } catch (err: any) {
      console.error('[Notification] Webhook 发送失败:', err.message);
    }
  }

  private static escapeMarkdownV2(text: string): string {
    return text.replace(/[_*[\]()~`>#+-=|{}.!]/g, '\\$&');
  }
}
