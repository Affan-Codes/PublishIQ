import { Request, Response, NextFunction } from 'express';
import contentProfileService from '../services/contentProfile.service.js';
import { jobService } from '../services/job.service.js';

export const contentProfileController = {
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await contentProfileService.getProfileById(req.params.id as string, req.workspaceId!);
      res.json({
        success: true,
        data: profile,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async getReadiness(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const readiness = await contentProfileService.getProfileReadiness(
        req.params.id as string,
        req.workspaceId!
      );
      res.json({
        success: true,
        data: readiness,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async dryRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await jobService.createContentPipelineJob(
        req.workspaceId!,
        req.body?.channelId,
        req.body?.sourceGeneratedContentId,
        true,
        req.params.id as string
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

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId!;
      const list = await contentProfileService.listProfiles(workspaceId);
      res.json({
        success: true,
        data: list,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId!;
      const profile = await contentProfileService.createProfile({
        workspaceId,
        ...req.body,
      });
      res.status(201).json({
        success: true,
        data: profile,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId!;
      const profile = await contentProfileService.updateProfile(req.params.id as string, workspaceId, req.body);
      res.json({
        success: true,
        data: profile,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await contentProfileService.deleteProfile(req.params.id as string);
      res.json({
        success: true,
        data: profile,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },
};

export default contentProfileController;
