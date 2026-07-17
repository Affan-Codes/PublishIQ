import { Request, Response, NextFunction } from 'express';
import generatedContentService from '../services/generatedContent.service.js';

export const generatedContentController = {
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const content = await generatedContentService.getGeneratedContentById(req.params.id as string);
      res.json({
        success: true,
        data: content,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { contentProfileId, publishStatus, language, contentTypeId, search, page, limit } = req.query;
      
      const filters: any = {
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10,
      };

      if (contentProfileId) filters.contentProfileId = contentProfileId as string;
      if (publishStatus) filters.publishStatus = publishStatus as any;
      if (language) filters.language = language as any;
      if (contentTypeId) filters.contentTypeId = contentTypeId as string;
      if (search) filters.search = search as string;

      const result = await generatedContentService.listGeneratedContent(req.workspaceId!, filters);
      
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

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await generatedContentService.deleteGeneratedContent(req.params.id as string);
      res.json({
        success: true,
        data: {},
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async duplicate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { channelId } = req.body;
      const job = await generatedContentService.duplicateGeneratedContent(
        req.params.id as string,
        req.workspaceId!,
        channelId
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

  async regenerate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { channelId } = req.body;
      const job = await generatedContentService.regenerateContent(
        req.params.id as string,
        req.workspaceId!,
        channelId
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
};

export default generatedContentController;
