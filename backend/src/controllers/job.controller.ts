import { Request, Response, NextFunction } from 'express';
import jobService from '../services/job.service.js';

export const jobController = {
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await jobService.getJobById(req.params.id as string);
      res.json({
        success: true,
        data: job,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobType, pipelineStage, channelId, page, limit } = req.query;
      
      const filters: any = {
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10,
      };

      if (jobType) filters.jobType = jobType as any;
      if (pipelineStage) filters.pipelineStage = pipelineStage as any;
      if (channelId) filters.channelId = channelId as string;

      const result = await jobService.listJobs(req.workspaceId!, filters);
      
      res.json({
        success: true,
        data: result.items,
        meta: {
          total: result.total,
          page: filters.page,
          limit: filters.limit,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { channelId, sourceGeneratedContentId } = req.body;
      const job = await jobService.createContentPipelineJob(
        req.workspaceId!,
        channelId,
        sourceGeneratedContentId
      );

      res.status(201).json({
        success: true,
        data: job,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async retry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await jobService.retryJob(req.params.id as string, req.workspaceId!);
      res.json({
        success: true,
        data: job,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await jobService.cancelJob(req.params.id as string, req.workspaceId!);
      res.json({
        success: true,
        data: job,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await jobService.approveJob(req.params.id as string, req.workspaceId!);
      res.json({
        success: true,
        data: job,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await jobService.rejectJob(req.params.id as string, req.workspaceId!);
      res.json({
        success: true,
        data: job,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },
};

export default jobController;
