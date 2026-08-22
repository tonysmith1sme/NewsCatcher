import { prisma, getSystemConfig } from './config';
import { TwitterService, TweetItem } from './twitter';
import { AIService } from './ai';
import { NotificationService } from './notification';
import { StorageService } from './storage';

export class NewsProcessorService {
  public static async runFetchTask(): Promise<{ fetched: number; saved: number; logMessage: string }> {
    const log = await prisma.executionLog.create({
      data: {
        status: 'IN_PROGRESS',
        fetchedCount: 0,
        savedCount: 0,
        message: '开始定时抓取任务...',
      },
    });

    try {
      // 1. Get enabled sources
      const sources = await prisma.source.findMany({ where: { enabled: true } });
      if (sources.length === 0) {
        const msg = '任务完成：暂无可用的抓取源，请在控制台中添加关键词或用户抓取源';
        await prisma.executionLog.update({
          where: { id: log.id },
          data: { status: 'SUCCESS', message: msg },
        });
        return { fetched: 0, saved: 0, logMessage: msg };
      }

      // 2. Get target category filter preference
      const categoriesJson = await getSystemConfig('target_categories', '[]');
      let allowedCategories: string[] = [];
      try {
        allowedCategories = JSON.parse(categoriesJson);
      } catch (e) {
        allowedCategories = [];
      }

      // 3. Get storage preferences
      const saveOriginalText = (await getSystemConfig('save_original_text', 'true')) === 'true';
      const saveOriginalImages = (await getSystemConfig('save_original_images', 'true')) === 'true';

      let totalFetched = 0;
      let totalSaved = 0;

      for (const src of sources) {
        console.log(`[NewsProcessor] Fetching source: ${src.name} (${src.query})`);
        try {
          const tweets = await TwitterService.fetchTweetsByQuery(src.query, 20);
          totalFetched += tweets.length;

          for (const tweet of tweets) {
            // Deduplication check in SQLite
            const existing = await prisma.news.findUnique({ where: { tweetId: tweet.id } });
            if (existing) {
              continue; // Skip existing tweet
            }

            // AI analysis and category filter
            const aiResult = await AIService.processTweet(tweet, allowedCategories);
            if (!aiResult) {
              continue; // Excluded by AI or category filter
            }

            const downloadedMediaUrls: string[] = [];

            // Download original images locally if enabled
            if (saveOriginalImages && tweet.media.length > 0) {
              let imgIndex = 1;
              for (const m of tweet.media) {
                const ext = m.url.split('.').pop()?.split('?')[0] || 'jpg';
                const filename = `${tweet.id}_${imgIndex}.${ext}`;
                const localUrl = await StorageService.downloadImage(m.url, filename);
                const displayUrl = localUrl || m.url;
                downloadedMediaUrls.push(displayUrl);
                imgIndex++;
              }
            } else {
              tweet.media.forEach(m => downloadedMediaUrls.push(m.url));
            }

            // Save News to SQLite
            const createdNews = await prisma.news.create({
              data: {
                tweetId: tweet.id,
                title: aiResult.title,
                summary: aiResult.summary,
                markdownContent: aiResult.markdownContent,
                category: aiResult.category,
                importance: aiResult.importance,
                author: tweet.authorName,
                authorUsername: tweet.authorUsername,
                originalUrl: tweet.url,
                mediaUrlsJson: JSON.stringify(downloadedMediaUrls),
                tweetCreatedAt: tweet.createdAt,
              },
            });

            // Save TweetRaw to separate SQLite table if enabled
            if (saveOriginalText) {
              await prisma.tweetRaw.create({
                data: {
                  newsId: createdNews.id,
                  tweetId: tweet.id,
                  rawText: tweet.text,
                  authorName: tweet.authorName,
                  authorUsername: tweet.authorUsername,
                  originalUrl: tweet.url,
                  mediaUrlsJson: JSON.stringify(downloadedMediaUrls),
                  tweetCreatedAt: tweet.createdAt,
                },
              });
            }

            totalSaved++;

            // Trigger notification
            NotificationService.sendNotification({
              title: aiResult.title,
              summary: aiResult.summary,
              category: aiResult.category,
              author: tweet.authorName,
              originalUrl: tweet.url,
            }).catch(e => console.error('[Notification] Error:', e));
          }
        } catch (err: any) {
          console.error(`[NewsProcessor] Source "${src.name}" fetch error:`, err.message);
        }
      }

      const msg = `抓取完成：共获取 ${totalFetched} 条推文，提炼并保存 ${totalSaved} 条符合目标分类的新闻文档`;
      await prisma.executionLog.update({
        where: { id: log.id },
        data: {
          status: 'SUCCESS',
          fetchedCount: totalFetched,
          savedCount: totalSaved,
          message: msg,
        },
      });

      return { fetched: totalFetched, saved: totalSaved, logMessage: msg };
    } catch (err: any) {
      const errorMsg = `抓取任务异常中断: ${err.message}`;
      await prisma.executionLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          message: errorMsg,
        },
      });
      throw err;
    }
  }
}
