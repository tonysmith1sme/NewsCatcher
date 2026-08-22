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

      const headers = this.getHeaders(authToken, ct0);

      // Endpoint 1: Verify Account Credentials (REST v1.1 endpoint on x.com)
      try {
        const res = await axios.get('https://x.com/i/api/1.1/account/verify_credentials.json', {
          headers,
          timeout: 10000,
        });

        if (res.data && (res.data.screen_name || res.data.id_str)) {
          return {
            success: true,
            message: `登录成功，当前账号: @${res.data.screen_name || 'X 用户'} (${res.data.name || ''})`,
            user: res.data,
          };
        }
      } catch (e: any) {
        if (e.response?.status === 401) {
          return { success: false, message: 'X 认证失败 (HTTP 401): Cookie (auth_token 或 ct0) 已失效或过期，请重新在浏览器提取最新的 Cookie' };
        }
      }

      // Endpoint 2: Account Settings (Fallback)
      try {
        const res2 = await axios.get('https://x.com/i/api/1.1/account/settings.json', {
          headers,
          timeout: 10000,
        });

        if (res2.data && res2.data.screen_name) {
          return {
            success: true,
            message: `登录成功，当前账号: @${res2.data.screen_name}`,
            user: res2.data,
          };
        }
      } catch (e: any) {
        if (e.response?.status === 401) {
          return { success: false, message: 'X 认证失败 (HTTP 401): Cookie (auth_token 或 ct0) 已失效或过期，请重新在浏览器提取最新的 Cookie' };
        }
      }

      return { success: false, message: '未能验证 X 账号，请确认输入的 auth_token 和 ct0 是否填写正确且有效' };
    } catch (err: any) {
      if (err.response?.status === 404) {
        return { success: false, message: 'X API 请求失败 (404)，请检查网络代理或连接环境' };
      }
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

    const headers = this.getHeaders(authToken, ct0);

    try {
      // 1. Try modern GraphQL Search Timeline endpoint
      const gqlFeatures = {
        rweb_tipjar_consumption_enabled: true,
        responsive_web_graphql_exclude_directive_enabled: true,
        verified_phone_label_enabled: false,
        creator_subscriptions_tweet_preview_api_enabled: true,
        responsive_web_graphql_timeline_navigation_enabled: true,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        communities_web_enable_tweet_community_results_fetch: true,
        c9s_tweet_anatomy_moderator_badge_enabled: true,
        articles_preview_enabled: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: true,
        tweet_awards_web_tipping_enabled: false,
        creator_subscriptions_quote_tweet_preview_enabled: false,
        freedom_of_speech_promoted_has_timeline_warning_enabled: true,
        tweetwithvisibilityresults_prefer_grok_responses_enabled: false,
        rweb_video_timestamps_enabled: true,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        responsive_web_enhance_cards_enabled: false
      };

      const gqlVariables = {
        rawQuery: query,
        count: count,
        querySource: "typed_query",
        product: "Latest"
      };

      try {
        const gqlRes = await axios.get('https://x.com/i/api/graphql/nK1KiAckcVUSyuymflHyBw/SearchTimeline', {
          headers,
          params: {
            variables: JSON.stringify(gqlVariables),
            features: JSON.stringify(gqlFeatures)
          },
          timeout: 15000,
        });

        const instructions = gqlRes.data?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions || [];
        const tweets: TweetItem[] = [];

        for (const inst of instructions) {
          const entries = inst.entries || [];
          for (const entry of entries) {
            const result = entry.content?.itemContent?.tweet_results?.result;
            if (!result) continue;

            const tweetLegacy = result.legacy || result.tweet?.legacy;
            const userLegacy = result.core?.user_results?.result?.legacy || result.tweet?.core?.user_results?.result?.legacy;

            if (!tweetLegacy) continue;

            const mediaList: TweetMedia[] = [];
            const mediaEntities = tweetLegacy.extended_entities?.media || tweetLegacy.entities?.media || [];
            for (const m of mediaEntities) {
              if (m.media_url_https) {
                mediaList.push({
                  type: m.type || 'photo',
                  url: m.media_url_https
                });
              }
            }

            const username = userLegacy?.screen_name || 'unknown';
            tweets.push({
              id: tweetLegacy.id_str || result.rest_id,
              text: tweetLegacy.full_text || tweetLegacy.text || '',
              authorName: userLegacy?.name || username,
              authorUsername: username,
              createdAt: new Date(tweetLegacy.created_at || Date.now()),
              url: `https://x.com/${username}/status/${tweetLegacy.id_str || result.rest_id}`,
              media: mediaList
            });
          }
        }

        if (tweets.length > 0) {
          return tweets;
        }
      } catch (gqlErr) {
        // Fallback to adaptive REST
      }

      // 2. Fallback Adaptive Search REST API on x.com domain
      const response = await axios.get('https://x.com/i/api/2/search/adaptive.json', {
        headers,
        params: {
          q: query,
          count: count,
          query_source: 'typed_query',
          tweet_search_mode: 'live',
        },
        timeout: 15000,
      });

      const tweetsObj = response.data?.globalObjects?.tweets || {};
      const usersObj = response.data?.globalObjects?.users || {};

      const tweets: TweetItem[] = [];

      for (const tweetId of Object.keys(tweetsObj)) {
        const tweetData = tweetsObj[tweetId];
        const userId = tweetData.user_id_str;
        const user = usersObj[userId] || {};

        const mediaList: TweetMedia[] = [];
        const mediaEntities = tweetData.extended_entities?.media || tweetData.entities?.media || [];
        for (const m of mediaEntities) {
          if (m.media_url_https) {
            mediaList.push({
              type: m.type || 'photo',
              url: m.media_url_https
            });
          }
        }

        const username = user.screen_name || 'unknown';
        tweets.push({
          id: tweetData.id_str,
          text: tweetData.full_text || tweetData.text || '',
          authorName: user.name || username,
          authorUsername: username,
          createdAt: new Date(tweetData.created_at || Date.now()),
          url: `https://x.com/${username}/status/${tweetData.id_str}`,
          media: mediaList
        });
      }

      return tweets;
    } catch (err: any) {
      console.error('Twitter fetch error:', err.response?.data || err.message);
      throw new Error(`抓取推文失败: ${err.response?.data?.errors?.[0]?.message || err.message}`);
    }
  }
}
