import { Request, Response, NextFunction } from 'express';
import schedulerService from '../services/scheduler.service.js';

export const schedulerController = {
  /**
   * Retrieves all upcoming repeatable runs from BullMQ.
   */
  async listUpcoming(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await schedulerService.listUpcomingRuns();
      res.json({
        success: true,
        data: list,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },
};

export default schedulerController;
