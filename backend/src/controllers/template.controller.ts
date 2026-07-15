import { Request, Response, NextFunction } from 'express';
import templateService from '../services/template.service.js';

export const templateController = {
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await templateService.getTemplateById(req.params.id as string);
      res.json({
        success: true,
        data: template,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId!;
      const list = await templateService.listTemplates(workspaceId);
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
      const { name, notes, componentPath, componentSource } = req.body;
      const template = await templateService.createTemplate({
        workspaceId,
        name,
        notes,
        componentPath,
        componentSource,
      });
      res.status(201).json({
        success: true,
        data: template,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, notes, status } = req.body;
      const template = await templateService.updateTemplate(req.params.id as string, {
        name,
        notes,
        status,
      });
      res.json({
        success: true,
        data: template,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async listVersions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const versions = await templateService.listVersions(req.params.id as string);
      res.json({
        success: true,
        data: versions,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async getVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const version = await templateService.getVersionDetails(
        req.params.id as string,
        parseInt(req.params.versionNumber as string, 10)
      );
      res.json({
        success: true,
        data: version,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async createVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { componentPath, componentSource, notes } = req.body;
      const version = await templateService.createVersion(
        req.params.id as string,
        componentPath,
        componentSource,
        notes
      );
      res.status(201).json({
        success: true,
        data: version,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async rollbackVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const versionNumber = parseInt(req.params.versionNumber as string, 10);
      const version = await templateService.rollbackVersion(req.params.id as string, versionNumber);
      res.json({
        success: true,
        data: version,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },
};

export default templateController;
