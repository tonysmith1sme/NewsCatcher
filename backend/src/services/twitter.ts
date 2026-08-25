import axios from 'axios';
import { ClientTransaction, fetchXDocument } from 'x-client-transaction-id';
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

const WEB_BEARER =
  'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const GQL_SEARCH_ID = 'hyPfJYJ_XAtDYoslQc-Rgg';
const GQL_VIEWER_ID = '5XShkXk2oO2J7SYmTu6pvw';

const GQL_TIMELINE_FEATURES = {
  rweb_video_screen_enabled: false,
  rweb_cashtags_enabled: true,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: true,
  rweb_tipjar_consumption_enabled: false,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: false,
  rweb_cashtags_composer_attachment_enabled: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_annotations_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  content_disclosure_indicator_enabled: true,
  content_disclosure_ai_generated_indicator_enabled: true,
  responsive_web_grok_show_grok_translated_post: true,
  responsive_web_grok_analysis_button_from_backend: true,
  post_ctas_fetch_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: false,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: true,
  responsive_web_enhance_cards_enabled: false,
};

const GQL_VIEWER_FEATURES = {
  subscriptions_upsells_api_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: true,
  rweb_tipjar_consumption_enabled: false,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
};

function stripWrap(value: string): string {
  return value.trim().replace(/^["']+|["']+$/g, '').trim();
}

function parseCookiePairs(raw: string): Record<string, string> {
  const pairs: Record<string, string> = {};
  const text = stripWrap(raw);
  if (!text) return pairs;

  if (!text.includes('=') && !text.includes(';')) {
    return pairs;
  }

  for (const part of text.split(';')) {
    const chunk = part.trim();
    if (!chunk) continue;
    const eq = chunk.indexOf('=');
    if (eq <= 0) continue;
    const key = chunk.slice(0, eq).trim();
    const value = stripWrap(chunk.slice(eq + 1));
    if (key && value && !pairs[key]) {
      pairs[key] = value;
    }
  }
  return pairs;
}

function extractTokenValue(raw: string, key: string): string {
  const text = stripWrap(raw);
  if (!text) return '';
  const pairs = parseCookiePairs(text);
  if (pairs[key]) return pairs[key];
  const prefix = `${key}=`;
  if (text.toLowerCase().startsWith(prefix)) {
    return stripWrap(text.slice(prefix.length).split(';')[0] || '');
  }
  if (!text.includes('=') && !text.includes(';')) {
    return text;
  }
  return '';
}

function resolveCookies(authTokenInput: string, ct0Input: string): { authToken: string; ct0: string; cookieHeader: string } {
  const merged = {
    ...parseCookiePairs(authTokenInput || ''),
    ...parseCookiePairs(ct0Input || ''),
  };

  const authToken = merged.auth_token || extractTokenValue(authTokenInput || '', 'auth_token');
  const ct0 = merged.ct0 || extractTokenValue(ct0Input || '', 'ct0');

  if (authToken) merged.auth_token = authToken;
  if (ct0) merged.ct0 = ct0;

  const cookieHeader = Object.entries(merged)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

  return { authToken, ct0, cookieHeader };
}

function extractViewerUser(data: any): { screenName: string; name: string; id?: string } | null {
  const result = data?.data?.viewer?.user_results?.result;
  if (!result) return null;
  const screenName = result.core?.screen_name || result.legacy?.screen_name;
  if (!screenName) return null;
  return {
    screenName,
    name: result.core?.name || result.legacy?.name || screenName,
    id: result.rest_id,
  };
}

function parseTimelineTweets(payload: any): TweetItem[] {
  const instructions =
    payload?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions ||
    payload?.data?.user?.result?.timeline_v2?.timeline?.instructions ||
    [];
  const tweets: TweetItem[] = [];
  const seen = new Set<string>();

  const pushFromResult = (result: any) => {
    if (!result) return;
    const tweetLegacy = result.legacy || result.tweet?.legacy;
    const userResult = result.core?.user_results?.result || result.tweet?.core?.user_results?.result;
    if (!tweetLegacy) return;
    const id = tweetLegacy.id_str || result.rest_id;
    if (!id || seen.has(id)) return;
    seen.add(id);

    const mediaList: TweetMedia[] = [];
    const mediaEntities = tweetLegacy.extended_entities?.media || tweetLegacy.entities?.media || [];
    for (const m of mediaEntities) {
      if (m.media_url_https) {
        mediaList.push({ type: m.type || 'photo', url: m.media_url_https });
      }
    }

    const username = userResult?.core?.screen_name || userResult?.legacy?.screen_name || 'unknown';
    tweets.push({
      id,
      text: tweetLegacy.full_text || tweetLegacy.text || '',
      authorName: userResult?.core?.name || userResult?.legacy?.name || username,
      authorUsername: username,
      createdAt: new Date(tweetLegacy.created_at || Date.now()),
      url: `https://x.com/${username}/status/${id}`,
      media: mediaList,
    });
  };

  for (const inst of instructions) {
    const entries = inst.entries || [];
    for (const entry of entries) {
      pushFromResult(entry.content?.itemContent?.tweet_results?.result);
      for (const item of entry.content?.items || []) {
        pushFromResult(item.item?.itemContent?.tweet_results?.result);
      }
    }
  }
  return tweets;
}

function describeAxiosError(err: any): string {
  if (err.response) {
    const status = err.response.status;
    const data = err.response.data;
    const apiMsg = data?.errors?.[0]?.message || data?.error || (typeof data === 'string' ? data.slice(0, 180) : '');
    return apiMsg ? `HTTP ${status}: ${apiMsg}` : `HTTP ${status}`;
  }
  if (err.code === 'ECONNABORTED') return '连接超时，请检查网络或代理';
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') return `无法连接 X 服务器 (${err.code})`;
  return err.message || '未知网络错误';
}

export class TwitterService {
  private static txCache: { instance: ClientTransaction; expiresAt: number } | null = null;
  private static txPending: Promise<ClientTransaction> | null = null;

  private static async getClientTransaction(): Promise<ClientTransaction> {
    if (this.txCache && this.txCache.expiresAt > Date.now()) {
      return this.txCache.instance;
    }
    if (this.txPending) return this.txPending;
    this.txPending = (async () => {
      const document = await fetchXDocument();
      const instance = await ClientTransaction.create(document);
      this.txCache = { instance, expiresAt: Date.now() + 10 * 60 * 1000 };
      return instance;
    })();
    try {
      return await this.txPending;
    } finally {
      this.txPending = null;
    }
  }

  private static async getHeaders(authToken: string, ct0: string, method = 'GET', url?: string) {
    const resolved = resolveCookies(authToken, ct0);
    const headers: Record<string, string> = {
      authorization: WEB_BEARER,
      'x-csrf-token': resolved.ct0,
      'x-twitter-active-user': 'yes',
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-client-language': 'en',
      cookie: resolved.cookieHeader,
      'user-agent': BROWSER_UA,
      accept: '*/*',
      'accept-language': 'en-US,en;q=0.9',
      origin: 'https://x.com',
      referer: 'https://x.com/home',
      'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
    };

    if (url) {
      try {
        const path = new URL(url).pathname;
        const tx = await this.getClientTransaction();
        headers['x-client-transaction-id'] = await tx.generateTransactionId(method, path);
      } catch (err) {
        console.error('[Twitter] failed to generate x-client-transaction-id:', err);
      }
    }

    return headers;
  }

  public static async testCredentials(authToken: string, ct0: string): Promise<{ success: boolean; message: string; user?: any }> {
    try {
      const resolved = resolveCookies(authToken || '', ct0 || '');
      if (!resolved.authToken || !resolved.ct0) {
        return { success: false, message: 'Cookie auth_token 或 ct0 不能为空，也可直接粘贴浏览器完整 Cookie' };
      }

      const viewerUrl = `https://x.com/i/api/graphql/${GQL_VIEWER_ID}/Viewer`;
      try {
        const headers = await this.getHeaders(authToken || '', ct0 || '', 'GET', viewerUrl);
        const res = await axios.get(viewerUrl, {
          headers,
          params: {
            variables: JSON.stringify({ withCommunitiesMemberships: true }),
            features: JSON.stringify(GQL_VIEWER_FEATURES),
            fieldToggles: JSON.stringify({ isDelegate: false, withAuxiliaryUserLabels: false }),
          },
          timeout: 15000,
          validateStatus: () => true,
        });
        const user = extractViewerUser(res.data);
        if (res.status >= 200 && res.status < 300 && user) {
          return {
            success: true,
            message: `登录成功，当前账号: @${user.screenName}${user.name ? ` (${user.name})` : ''}`,
            user,
          };
        }
      } catch (e: any) {
        console.error('[Twitter] Viewer 校验失败:', describeAxiosError(e));
      }

      const endpoints = [
        'https://x.com/i/api/1.1/account/verify_credentials.json',
        'https://api.x.com/1.1/account/verify_credentials.json',
        'https://x.com/i/api/1.1/account/settings.json',
      ];

      const errors: string[] = [];

      for (const url of endpoints) {
        try {
          const headers = await this.getHeaders(authToken || '', ct0 || '', 'GET', url);
          const res = await axios.get(url, {
            headers,
            timeout: 15000,
            validateStatus: () => true,
            maxRedirects: 5,
          });

          const data = res.data;
          if (res.status >= 200 && res.status < 300 && data && typeof data === 'object' && (data.screen_name || data.id_str)) {
            return {
              success: true,
              message: `登录成功，当前账号: @${data.screen_name || 'X 用户'}${data.name ? ` (${data.name})` : ''}`,
              user: data,
            };
          }

          const apiMsg = data?.errors?.[0]?.message || data?.error || (typeof data === 'string' ? data.slice(0, 120) : '');
          errors.push(`${res.status}${apiMsg ? ` ${apiMsg}` : ''}`);
        } catch (e: any) {
          errors.push(describeAxiosError(e));
        }
      }

      return {
        success: false,
        message: `未能验证 X 账号：${errors.filter((e, i, arr) => arr.indexOf(e) === i).join(' / ')}`,
      };
    } catch (err: any) {
      return { success: false, message: `X 认证失败: ${describeAxiosError(err)}` };
    }
  }

  public static async fetchTweetsByQuery(query: string, count: number = 20): Promise<TweetItem[]> {
    const authToken = await getSystemConfig('x_auth_token');
    const ct0 = await getSystemConfig('x_ct0');
    const resolved = resolveCookies(authToken, ct0);

    if (!resolved.authToken || !resolved.ct0) {
      throw new Error('未配置 X (Twitter) Cookie 凭证');
    }

    try {
      const gqlUrl = `https://x.com/i/api/graphql/${GQL_SEARCH_ID}/SearchTimeline`;
      const headers = await this.getHeaders(authToken, ct0, 'GET', gqlUrl);
      const gqlRes = await axios.get(gqlUrl, {
        headers,
        params: {
          variables: JSON.stringify({
            rawQuery: query,
            count,
            querySource: 'typed_query',
            product: 'Latest',
          }),
          features: JSON.stringify(GQL_TIMELINE_FEATURES),
        },
        timeout: 15000,
        validateStatus: () => true,
      });

      if (gqlRes.status >= 200 && gqlRes.status < 300) {
        const tweets = parseTimelineTweets(gqlRes.data);
        if (tweets.length > 0) return tweets;
        const gqlErr = gqlRes.data?.errors?.[0]?.message;
        if (gqlErr) {
          throw new Error(gqlErr);
        }
        return [];
      }

      const apiMsg = gqlRes.data?.errors?.[0]?.message || gqlRes.data?.error || `HTTP ${gqlRes.status}`;
      throw new Error(apiMsg);
    } catch (err: any) {
      console.error('Twitter fetch error:', err.response?.data || err.message);
      throw new Error(`抓取推文失败: ${err.response?.data?.errors?.[0]?.message || err.message}`);
    }
  }
}
