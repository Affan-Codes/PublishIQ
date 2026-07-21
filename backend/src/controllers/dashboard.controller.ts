import { Request, Response, NextFunction } from 'express';
import dashboardService from '../services/dashboard.service.js';

export const dashboardController = {
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId as string;
      const stats = await dashboardService.getDashboardStats(workspaceId);

      res.json({
        success: true,
        data: stats,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  }
};

export default dashboardController;
