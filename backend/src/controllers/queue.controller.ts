import { Request, Response, NextFunction } from 'express';
import { jobService } from '../services/job.service.js';

export const queueController = {
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId!;
      const stats = await jobService.getQueueStats(workspaceId);

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
