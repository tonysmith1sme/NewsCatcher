import axios, { AxiosInstance } from 'axios';
import { getSystemConfig } from './config';

export interface TweetMedia {
  type: string;
  url: string;
}

export interface TweetItem {
  id: string;
  text: string;
  authorName: string;
  authorUsername: string;
  createdAt: Date;
  url: string;
  media: TweetMedia[];
}

export class TwitterService {
  private static getHeaders(authToken: string, ct0: string) {
    // Standard X Web client headers with Bearer token used by X Web Application
    const BEARER_TOKEN = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
    
    return {
      'authorization': BEARER_TOKEN,
      'x-csrf-token': ct0,
      'x-twitter-active-user': 'yes',
      'x-twitter-auth-type': 'OAuth2Session',
      'cookie': `auth_token=${authToken}; ct0=${ct0};`,
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'content-type': 'application/json',
    };
  }

  public static async testCredentials(authToken: string, ct0: string): Promise<{ success: boolean; message: string; user?: any }> {
    try {
      if (!authToken || !ct0) {
        return { success: false, message: 'Cookie auth_token 或 ct0 不能为空' };
      }
      const response = await axios.get('https://x.com/i/api/1.1/account/verify_credentials.json', {
        headers: this.getHeaders(authToken, ct0),
        timeout: 10000,
      });

      if (response.data && response.data.screen_name) {
        return {
          success: true,
          message: `登录成功，当前账号: @${response.data.screen_name} (${response.data.name})`,
          user: response.data,
        };
      }
      return { success: false, message: '未能验证 X 账号，请检查 Cookie 有效性' };
    } catch (err: any) {
      const errMsg = err.response?.data?.errors?.[0]?.message || err.message || '网络连接或 Cookie 错误';
      return { success: false, message: `X 认证失败: ${errMsg}` };
    }
  }

  public static async fetchTweetsByQuery(query: string, count: number = 20): Promise<TweetItem[]> {
    const authToken = await getSystemConfig('x_auth_token');
    const ct0 = await getSystemConfig('x_ct0');

    if (!authToken || !ct0) {
      throw new Error('未配置 X (Twitter) Cookie 凭证');
    }

    const client = axios.create({
      baseURL: 'https://x.com/i/api/2/search/adaptive.json',
      headers: this.getHeaders(authToken, ct0),
      timeout: 15000,
    });

    try {
      const response = await client.get('', {
        params: {
          q: query,
          count: count,
          query_source: 'typed_query',
          tweet_search_mode: 'live',
        },
      });

      const tweetsObj = response.data?.globalObjects?.tweets || {};
      const usersObj = response.data?.globalObjects?.users || {};

      const tweets: TweetItem[] = [];

      for (const tweetId of Object.keys(tweetsObj)) {
        const tweetData = tweetsObj[tweetId];
        const userId = tweetData.user_id_str;
        const user = usersObj[userId] || {};

        const mediaList: TweetMedia[] = [];
        const entitiesMedia = tweetData.extended_entities?.media || tweetData.entities?.media || [];
        for (const m of entitiesMedia) {
          if (m.media_url_https) {
            mediaList.push({
              type: m.type || 'photo',
              url: m.media_url_https,
            });
          }
        }

        const username = user.screen_name || 'unknown';
        const tweetItem: TweetItem = {
          id: tweetData.id_str,
          text: tweetData.full_text || tweetData.text || '',
          authorName: user.name || username,
          authorUsername: username,
          createdAt: new Date(tweetData.created_at || Date.now()),
          url: `https://x.com/${username}/status/${tweetData.id_str}`,
          media: mediaList,
        };

        tweets.push(tweetItem);
      }

      return tweets;
    } catch (err: any) {
      console.error('Twitter fetch error:', err.response?.data || err.message);
      throw new Error(`抓取推文失败: ${err.response?.data?.errors?.[0]?.message || err.message}`);
    }
  }
}
