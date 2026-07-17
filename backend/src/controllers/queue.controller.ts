import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/db.js';
import { PipelineStage, JobType } from '@prisma/client';

export const queueController = {
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId!;

      // Group jobs by type and pipelineStage to compute statistics from the database
      const groupings = await prisma.job.groupBy({
        by: ['jobType', 'pipelineStage'],
        where: { workspaceId },
        _count: {
          id: true,
        },
      });

      const stats = {
        total: 0,
        waiting: 0,
        active: 0,
        delayed: 0, // In v1 database terms, delayed can be scheduled jobs or we can mock/fetch if needed
        failed: 0,
        archived: 0,
        byType: {} as Record<JobType, { waiting: number; active: number; failed: number; total: number }>,
      };

      // Define which stages map to which queue categories
      const waitingStages: PipelineStage[] = [PipelineStage.Draft, PipelineStage.Queued];
      const activeStages: PipelineStage[] = [
        PipelineStage.GeneratingContent,
        PipelineStage.Validating,
        PipelineStage.GeneratingImage,
        PipelineStage.SelectingMusic,
        PipelineStage.GeneratingVideo,
        PipelineStage.GeneratingCaption,
        PipelineStage.GeneratingHashtags,
        PipelineStage.Publishing,
      ];

      for (const group of groupings) {
        const count = group._count.id;
        const stage = group.pipelineStage;
        const type = group.jobType;

        if (!stats.byType[type]) {
          stats.byType[type] = { waiting: 0, active: 0, failed: 0, total: 0 };
        }

        stats.total += count;
        stats.byType[type].total += count;

        if (stage === PipelineStage.Failed) {
          stats.failed += count;
          stats.byType[type].failed += count;
        } else if (stage === PipelineStage.Archived) {
          stats.archived += count;
        } else if (stage && waitingStages.includes(stage)) {
          stats.waiting += count;
          stats.byType[type].waiting += count;
        } else if (stage && activeStages.includes(stage)) {
          stats.active += count;
          stats.byType[type].active += count;
        }
      }

      res.json({
        success: true,
        data: stats,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },
};

export default queueController;
