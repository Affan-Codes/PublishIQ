import { Request, Response, NextFunction } from 'express';
import contentTypeService from '../services/contentType.service.js';

export const contentTypeController = {
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contentType = await contentTypeService.getContentTypeById(req.params.id as string);
      res.json({
        success: true,
        data: contentType,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId!;
      const list = await contentTypeService.listContentTypes(workspaceId);
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
      const { name, status } = req.body;
      const contentType = await contentTypeService.createContentType({
        workspaceId,
        name,
        status,
      });
      res.status(201).json({
        success: true,
        data: contentType,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, status } = req.body;
      const contentType = await contentTypeService.updateContentType(req.params.id as string, {
        name,
        status,
      });
      res.json({
        success: true,
        data: contentType,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contentType = await contentTypeService.deleteContentType(req.params.id as string);
      res.json({
        success: true,
        data: contentType,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },
};

export default contentTypeController;
