import OpenAI from 'openai';
import { getSystemConfig } from './config';
import { TweetItem } from './twitter';

export interface AISummaryResult {
  title: string;
  summary: string;
  markdownContent: string;
  category: string;
  importance: number;
}

export class AIService {
  private static async getClient(): Promise<OpenAI> {
    const baseURL = (await getSystemConfig('ai_base_url', 'https://api.openai.com/v1')).trim();
    const apiKey = (await getSystemConfig('ai_api_key', '')).trim();
    
    if (!apiKey) {
      throw new Error('未配置 AI API Key，请先在系统设置中配置 OpenAI 兼容接口');
    }

    return new OpenAI({
      baseURL: baseURL || 'https://api.openai.com/v1',
      apiKey: apiKey,
    });
  }

  public static async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const client = await this.getClient();
      const model = await getSystemConfig('ai_model', 'gpt-3.5-turbo');
      
      const response = await client.chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: 'Say "Hello, NewsCatcher AI is ready!"' }],
        max_tokens: 30,
      });

      const reply = response.choices[0]?.message?.content || '';
      return { success: true, message: `连接成功！AI 回复: ${reply}` };
    } catch (err: any) {
      return { success: false, message: `AI 接口测试失败: ${err.message}` };
    }
  }

  public static async processTweet(tweet: TweetItem, allowedCategories: string[]): Promise<AISummaryResult | null> {
    const client = await this.getClient();
    const model = await getSystemConfig('ai_model', 'gpt-3.5-turbo');

    const prompt = `你是一个专业的新闻主编与信息提炼分析专家。请仔细阅读以下抓取自 X (Twitter) 的原始推文内容，并进行分析总结。

推文发布者: ${tweet.authorName} (@${tweet.authorUsername})
发布时间: ${tweet.createdAt.toISOString()}
原推链接: ${tweet.url}
推文正文:
"""
${tweet.text}
"""

请按以下 JSON 格式输出分析结果（不要输出 markdown 代码块，只输出纯 JSON）：
{
  "isNews": true/false (判定该推文是否包含有效的新闻/资讯/深度信息，若仅为日常闲聊、广告骚扰则为 false),
  "title": "简短精炼的新闻标题（20字以内）",
  "summary": "1-2句精炼的新闻摘要概括",
  "markdownContent": "完整的新闻 Markdown 报告。格式包含：## 新闻背景、## 核心要点（列表）、## 原推评论与影响。包含原推链接 [查看原推](${tweet.url})",
  "category": "主要分类，例如：金融、AI、科技、政治、娱乐、游戏、汽车、体育、其他",
  "importance": 1-5 (重要度评分，数字 1-5，5表示重大新闻)
}`;

    try {
      const response = await client.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: '你是一个严格输出 JSON 格式的新闻提炼分析助手。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      });

      const rawContent = response.choices[0]?.message?.content || '{}';
      
      // Clean JSON formatting if wrapped in ```json ... ```
      const jsonStr = rawContent.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(jsonStr);

      if (!parsed.isNews) {
        return null; // Not valid news content
      }

      // Check category match if allowedCategories is non-empty
      if (allowedCategories.length > 0) {
        const categoryMatch = allowedCategories.some(cat => 
          parsed.category.toLowerCase().includes(cat.toLowerCase()) ||
          cat.toLowerCase().includes(parsed.category.toLowerCase())
        );
        if (!categoryMatch) {
          return null; // Filtered out by category preference
        }
      }

      return {
        title: parsed.title || '无标题新闻',
        summary: parsed.summary || tweet.text.slice(0, 100),
        markdownContent: parsed.markdownContent || `## ${parsed.title}\n\n${parsed.summary}\n\n[查看原推](${tweet.url})`,
        category: parsed.category || '科技',
        importance: Number(parsed.importance) || 3,
      };
    } catch (err: any) {
      console.error(`AI 处理推文 [${tweet.id}] 失败:`, err.message);
      return null;
    }
  }
}
