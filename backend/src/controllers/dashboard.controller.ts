import { Request, Response, NextFunction } from 'express';
import { dashboardRepository } from '../repositories/dashboard.repository.js';
import { getRedisInstance } from '../database/redis.js';
import { contentPipelineQueue } from '../jobs/index.js';

export const dashboardController = {
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId as string;

      // 1. Core counters & aggregates via dashboardRepository
      const [
        totalChannels,
        totalGenerations,
        totalPublishSuccess,
        totalPublishFailure,
        platformConnections,
        failedJobs,
        recentPublications,
      ] = await dashboardRepository.getDashboardData(workspaceId);

      // Calculate success rate
      const totalPublishes = totalPublishSuccess + totalPublishFailure;
      const successRate = totalPublishes > 0 ? Math.round((totalPublishSuccess / totalPublishes) * 100) : 100;

      // 2. Queue metrics from BullMQ
      let queueCounts = { active: 0, waiting: 0, delayed: 0, failed: 0, completed: 0 };
      try {
        const counts = await contentPipelineQueue.getJobCounts();
        queueCounts = {
          active: counts.active || 0,
          waiting: counts.waiting || 0,
          delayed: counts.delayed || 0,
          failed: counts.failed || 0,
          completed: counts.completed || 0,
        };
      } catch (err) {
        // Fallback if Redis/BullMQ is in a detached testing state
      }

      // 3. System Health status check
      let dbHealth = 'Healthy';
      try {
        await dashboardRepository.pingDatabase();
      } catch (err) {
        dbHealth = 'Unhealthy';
      }

      let redisHealth = 'Healthy';
      try {
        const redis = getRedisInstance();
        const pong = await redis.ping();
        if (pong !== 'PONG') redisHealth = 'Unhealthy';
      } catch (err) {
        redisHealth = 'Unhealthy';
      }

      res.json({
        success: true,
        data: {
          counters: {
            totalChannels,
            totalGenerations,
            totalPublishSuccess,
            totalPublishFailure,
            successRate,
          },
          queues: queueCounts,
          failedJobs,
          recentPublications,
          connections: platformConnections,
          health: {
            database: dbHealth,
            redis: redisHealth,
          }
        },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  }
};

export default dashboardController;

