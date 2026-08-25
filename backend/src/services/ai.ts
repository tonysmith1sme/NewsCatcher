import OpenAI from 'openai';
import { getSystemConfig } from './config';
import { TweetItem } from './twitter';
import { JSON_SCHEMA_TEXT, buildUserPrompt, getActivePreset } from './promptPresets';

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

    const categoryHint = allowedCategories.length > 0
      ? `可选优先分类包含：${allowedCategories.join('、')}。如果属于其中一种请精确归类为该分类；如果不属于，可以归类为其他合适的简短分类名称。`
      : '例如：金融、AI、科技、政治、娱乐、游戏、汽车、体育、其他';

    const preset = await getActivePreset();
    const promptVars = {
      authorName: tweet.authorName,
      authorUsername: tweet.authorUsername,
      createdAt: tweet.createdAt.toISOString(),
      url: tweet.url,
      text: tweet.text,
      categoryHint,
      jsonSchema: '',
    };
    promptVars.jsonSchema = JSON_SCHEMA_TEXT.replace(/\{\{url\}\}/g, tweet.url).replace(/\{\{categoryHint\}\}/g, categoryHint);
    const userPrompt = buildUserPrompt(preset.userPromptTemplate, promptVars);
    const systemPrompt = preset.systemPrompt.trim() || '你是一个严格输出 JSON 格式的新闻提炼分析助手。';

    try {
      const response = await client.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
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
