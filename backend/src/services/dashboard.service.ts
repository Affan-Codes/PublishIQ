import { dashboardRepository } from '../repositories/dashboard.repository.js';
import { getRedisInstance } from '../database/redis.js';
import { contentPipelineQueue } from '../jobs/index.js';

export const dashboardService = {
  async getDashboardStats(workspaceId: string) {
    const [
      channelCount,
      contentCount,
      successRecordCount,
      failureRecordCount,
      platformConnections,
      failedJobs,
      recentPublishes,
    ] = await dashboardRepository.getDashboardData(workspaceId);

    const totalPublishes = successRecordCount + failureRecordCount;
    const successRate = totalPublishes > 0 ? ((successRecordCount / totalPublishes) * 100).toFixed(1) : '100.0';

    const jobCounts = await contentPipelineQueue.getJobCounts();

    return {
      overview: {
        totalChannels: channelCount,
        totalContentGenerated: contentCount,
        publishedCount: successRecordCount,
        failedPublishCount: failureRecordCount,
        successRatePercentage: parseFloat(successRate),
      },
      queueCounts: jobCounts,
      platformConnections: platformConnections.map((conn) => ({
        platform: conn.platform,
        healthStatus: conn.healthStatus,
        status: conn.status,
      })),
      failedJobs: failedJobs.map((job) => ({
        id: job.id,
        channelName: job.channel?.name || 'Unknown Channel',
        failedAt: job.failedAt,
        failureReason: job.failureReason,
        failureStage: job.failureStage,
      })),
      recentPublishes: recentPublishes.map((record) => ({
        id: record.id,
        channelName: record.channel?.name || 'Unknown Channel',
        contentText: record.generatedContent?.text || '',
        platform: record.platform,
        publishedAt: record.publishedAt,
        publishedUrl: record.publishedUrl,
      })),
    };
  },

  async checkDatabaseHealth(): Promise<void> {
    await dashboardRepository.pingDatabase();
  },
};

export default dashboardService;
