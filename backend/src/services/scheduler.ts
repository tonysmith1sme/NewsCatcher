import cron from 'node-cron';
import { getSystemConfig } from './config';
import { NewsProcessorService } from './newsProcessor';

export class SchedulerService {
  private static task: cron.ScheduledTask | null = null;
  private static isRunningTask: boolean = false;

  public static async initScheduler(): Promise<void> {
    await this.reloadScheduler();
  }

  public static async reloadScheduler(): Promise<void> {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }

    const enabled = (await getSystemConfig('schedule_enabled', 'false')) === 'true';
    if (!enabled) {
      console.log('[Scheduler] 定时任务已禁用');
      return;
    }

    const value = parseInt(await getSystemConfig('schedule_value', '1'), 10) || 1;
    const unit = await getSystemConfig('schedule_unit', 'hours'); // 'minutes' | 'hours' | 'days' | 'weeks'

    let cronExpression = '';
    switch (unit) {
      case 'minutes':
        cronExpression = `*/${Math.min(Math.max(value, 1), 59)} * * * *`;
        break;
      case 'hours':
        cronExpression = `0 */${Math.min(Math.max(value, 1), 23)} * * *`;
        break;
      case 'days':
        cronExpression = `0 0 */${Math.min(Math.max(value, 1), 31)} * *`;
        break;
      case 'weeks':
        cronExpression = `0 0 * * 0`; // Run weekly
        break;
      default:
        cronExpression = `0 */1 * * *`; // Default every hour
    }

    console.log(`[Scheduler] 启动定时任务调度，表达式: ${cronExpression} (周期: 每 ${value} ${unit})`);

    this.task = cron.schedule(cronExpression, async () => {
      if (this.isRunningTask) {
        console.log('[Scheduler] 上一轮任务尚未结束，本次跳过');
        return;
      }
      this.isRunningTask = true;
      try {
        console.log('[Scheduler] 触发定时抓取与 AI 提炼任务');
        await NewsProcessorService.runFetchTask();
      } catch (err: any) {
        console.error('[Scheduler] 定时任务执行失败:', err.message);
      } finally {
        this.isRunningTask = false;
      }
    });
  }

  public static async triggerManualRun(): Promise<{ id: string; fetched: number; saved: number; logMessage: string }> {
    if (this.isRunningTask) {
      throw new Error('当前已有抓取任务在后台运行中，请稍后再试');
    }
    this.isRunningTask = true;
    try {
      return await NewsProcessorService.runFetchTask();
    } finally {
      this.isRunningTask = false;
    }
  }
}
