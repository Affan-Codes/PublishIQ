import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/db.js';
import { getRedisInstance } from '../database/redis.js';
import { contentPipelineQueue } from '../jobs/index.js';
import { PipelineStage, PublishRecordStatus } from '@prisma/client';

export const dashboardController = {
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId as string;

      // 1. Core counters
      const [
        totalChannels,
        totalGenerations,
        totalPublishSuccess,
        totalPublishFailure,
        platformConnections,
      ] = await Promise.all([
        prisma.channel.count({ where: { workspaceId } }),
        prisma.generatedContent.count({ where: { workspaceId } }),
        prisma.publishingRecord.count({ where: { workspaceId, status: PublishRecordStatus.Success } }),
        prisma.publishingRecord.count({ where: { workspaceId, status: PublishRecordStatus.Failure } }),
        prisma.platformConnection.findMany({
          where: { workspaceId },
          select: { platform: true, healthStatus: true, status: true },
        }),
      ]);

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

      // 3. Failed pipeline jobs list (top 5 recent)
      const failedJobs = await prisma.job.findMany({
        where: {
          workspaceId,
          pipelineStage: PipelineStage.Failed,
        },
        include: {
          channel: { select: { name: true } }
        },
        orderBy: { failedAt: 'desc' },
        take: 5,
      });

      // 4. Recent activity log (top 5 recent publications or runs)
      const recentPublications = await prisma.publishingRecord.findMany({
        where: { workspaceId },
        include: {
          channel: { select: { name: true } },
          generatedContent: { select: { text: true } }
        },
        orderBy: { publishedAt: 'desc' },
        take: 5,
      });

      // 5. System Health status check
      let dbHealth = 'Healthy';
      try {
        await prisma.$queryRaw`SELECT 1`;
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
