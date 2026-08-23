import { dashboardRepository } from '../repositories/dashboard.repository.js';
import { getValkeyInstance } from '../database/valkey.js';
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

    let activeQueue = 0;
    let waitingQueue = 0;
    let delayedQueue = 0;
    let failedQueue = 0;
    let completedQueue = 0;

    try {
      const jobCounts = await contentPipelineQueue.getJobCounts('active', 'waiting', 'delayed', 'failed', 'completed');
      activeQueue = jobCounts.active || 0;
      waitingQueue = jobCounts.waiting || 0;
      delayedQueue = jobCounts.delayed || 0;
      failedQueue = jobCounts.failed || 0;
      completedQueue = jobCounts.completed || 0;
    } catch {
      // Valkey queue count fallback
    }

    let valkeyStatus = 'Healthy';
    try {
      const valkey = getValkeyInstance();
      await valkey.ping();
    } catch {
      valkeyStatus = 'Offline';
    }

    let workerStatus = 'Offline';
    let workerCount = 0;
    try {
      const workers = await contentPipelineQueue.getWorkers();
      workerCount = Array.isArray(workers) ? workers.length : 0;
      workerStatus = workerCount > 0 ? 'Healthy' : 'Offline';
    } catch {
      workerStatus = 'Offline';
      workerCount = 0;
    }

    return {
      counters: {
        totalChannels: channelCount,
        totalGenerations: contentCount,
        totalPublishSuccess: successRecordCount,
        totalPublishFailure: failureRecordCount,
        successRate: parseFloat(successRate),
      },
      queues: {
        active: activeQueue,
        waiting: waitingQueue,
        delayed: delayedQueue,
        failed: failedQueue,
        completed: completedQueue,
      },
      connections: platformConnections.map((conn) => ({
        platform: conn.platform,
        healthStatus: conn.healthStatus,
        status: conn.status,
      })),
      failedJobs: failedJobs.map((job) => ({
        id: job.id,
        failedAt: job.failedAt ? job.failedAt.toISOString() : new Date().toISOString(),
        failureReason: job.failureReason,
        failureStage: job.failureStage,
        retryCount: job.retryCount,
        channel: job.channel ? { name: job.channel.name } : undefined,
      })),
      recentPublications: recentPublishes.map((record) => ({
        id: record.id,
        platform: record.platform,
        status: record.status,
        publishedAt: record.publishedAt.toISOString(),
        channel: record.channel ? { name: record.channel.name } : undefined,
        generatedContent: record.generatedContent ? { text: record.generatedContent.text } : undefined,
      })),
      health: {
        database: 'Healthy',
        valkey: valkeyStatus,
        worker: {
          status: workerStatus,
          count: workerCount,
        },
      },
    };
  },

  async checkDatabaseHealth(): Promise<void> {
    await dashboardRepository.pingDatabase();
  },
};

export default dashboardService;
