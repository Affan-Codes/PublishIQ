import { contentPipelineQueue } from '../jobs/index.js';
import { prisma } from '../database/db.js';
import { logger } from '../utils/logger.js';

export const schedulerService = {
  /**
   * Synchronizes a channel's BullMQ repeatable/delayed schedules.
   */
  async syncChannelSchedule(channelId: string): Promise<void> {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      logger.warn({ channelId }, 'Channel not found during schedule sync');
      return;
    }

    // 1. Remove any existing schedules in BullMQ for this channel
    await this.removeChannelSchedule(channelId);

    // If channel is disabled or deleted, we stop here
    if (channel.status === 'Disabled') {
      logger.info({ channelId }, 'Channel is disabled. Removed schedule.');
      return;
    }

    if (channel.automationMode === 'Manual') {
      logger.info({ channelId }, 'Manual automation mode. Schedule bypassed.');
      return;
    }

    const timezone = channel.scheduleTimezone || 'UTC';
    const type = channel.scheduleType || 'Cron';
    let cronPattern = channel.scheduleCron;

    if (type === 'OneTime') {
      // Handle One-Time schedule using delayed job
      const config = (channel.scheduleConfig as Record<string, any>) || {};
      const targetTime = config.targetTime ? new Date(config.targetTime).getTime() : 0;
      const delay = targetTime - Date.now();

      if (delay > 0) {
        logger.info({ channelId, delay }, 'Scheduling one-time delayed job');
        await contentPipelineQueue.add(
          'content-pipeline-job',
          { channelId, isScheduled: true },
          { delay, jobId: `one-time:${channelId}` }
        );
      } else {
        logger.warn({ channelId, targetTime }, 'One-time target time is in the past, skipping scheduling');
      }
      return;
    }

    // For Daily, Weekly, or Custom Cron
    if (type === 'Daily') {
      const config = (channel.scheduleConfig as Record<string, any>) || {};
      const hour = config.hour !== undefined ? config.hour : 12;
      const minute = config.minute !== undefined ? config.minute : 0;
      cronPattern = `${minute} ${hour} * * *`;
    } else if (type === 'Weekly') {
      const config = (channel.scheduleConfig as Record<string, any>) || {};
      const hour = config.hour !== undefined ? config.hour : 12;
      const minute = config.minute !== undefined ? config.minute : 0;
      const dayOfWeek = config.dayOfWeek !== undefined ? config.dayOfWeek : 1; // 0-6 (Sun-Sat)
      cronPattern = `${minute} ${hour} * * ${dayOfWeek}`;
    }

    logger.info({ channelId, cronPattern, timezone }, 'Scheduling repeatable content pipeline job');

    await contentPipelineQueue.add(
      `channel-run:${channelId}`,
      { channelId, isScheduled: true },
      {
        repeat: {
          pattern: cronPattern,
          tz: timezone,
        },
        jobId: `repeat:${channelId}`,
      }
    );
  },

  /**
   * Removes all repeatable and delayed schedules for a channel from the queue.
   */
  async removeChannelSchedule(channelId: string): Promise<void> {
    // A. Remove repeatable jobs
    const repeatableJobs = await contentPipelineQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.name === `channel-run:${channelId}`) {
        await contentPipelineQueue.removeRepeatableByKey(job.key);
        logger.debug({ key: job.key, channelId }, 'Removed repeatable schedule');
      }
    }

    // B. Remove delayed jobs if present
    const delayedJob = await contentPipelineQueue.getJob(`one-time:${channelId}`);
    if (delayedJob) {
      await delayedJob.remove();
      logger.debug({ channelId }, 'Removed delayed one-time schedule');
    }
  },

  /**
   * Lists all upcoming repeatable runs in BullMQ.
   */
  async listUpcomingRuns(): Promise<any[]> {
    const repeatableJobs = await contentPipelineQueue.getRepeatableJobs();
    const list = [];

    for (const r of repeatableJobs) {
      if (r.name.startsWith('channel-run:')) {
        const channelId = r.name.replace('channel-run:', '');
        const channel = await prisma.channel.findUnique({
          where: { id: channelId },
        });

        list.push({
          key: r.key,
          name: r.name,
          cron: r.pattern,
          next: r.next ? new Date(r.next).toISOString() : null,
          tz: r.tz,
          channelId,
          channelName: channel?.name || 'Unknown Channel',
        });
      }
    }

    return list;
  }
};

export default schedulerService;
