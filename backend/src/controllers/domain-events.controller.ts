import { Request, Response, NextFunction } from 'express';
import domainEventService from '../services/domainEvent.service.js';

export const domainEventsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId as string;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const type = req.query.type as string | undefined;
      const jobId = req.query.jobId as string | undefined;
      const search = req.query.search as string | undefined;

      const fromStr = (req.query.from || req.query.startDate) as string | undefined;
      const toStr = (req.query.to || req.query.endDate) as string | undefined;

      const startDate = fromStr ? new Date(fromStr) : undefined;
      const endDate = toStr ? new Date(toStr) : undefined;

      const result = await domainEventService.listDomainEvents(workspaceId, {
        page,
        limit,
        type,
        jobId,
        search,
        startDate,
        endDate,
      });

      res.json({
        success: true,
        data: result.items,
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId as string;
      const id = req.params.id as string;

      const event = await domainEventService.getDomainEventById(id, workspaceId);

      res.json({
        success: true,
        data: event,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },
};

export default domainEventsController;
