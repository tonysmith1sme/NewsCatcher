export interface NewsItem {
  id: string;
  tweetId: string;
  title: string;
  summary: string;
  markdownContent: string;
  category: string;
  importance: number;
  author: string;
  authorUsername?: string;
  originalUrl: string;
  mediaUrlsJson?: string;
  tweetCreatedAt?: string;
  createdAt: string;
}

export interface SourceItem {
  id: string;
  name: string;
  type: string;
  query: string;
  enabled: boolean;
  createdAt: string;
}

export interface LogItem {
  id: string;
  status: string;
  fetchedCount: number;
  savedCount: number;
  message: string;
  createdAt: string;
}

export interface ConfigMap {
  x_auth_token?: string;
  x_ct0?: string;
  ai_base_url?: string;
  ai_api_key?: string;
  ai_model?: string;
  target_categories?: string;
  schedule_enabled?: string;
  schedule_value?: string;
  schedule_unit?: string;
}
