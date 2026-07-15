import { Request, Response, NextFunction } from 'express';
import promptService from '../services/prompt.service.js';

export const promptController = {
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const prompt = await promptService.getPromptById(req.params.id as string);
      res.json({
        success: true,
        data: prompt,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId!;
      const list = await promptService.listPrompts(workspaceId);
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
      const { name, notes, body } = req.body;
      const prompt = await promptService.createPrompt({
        workspaceId,
        name,
        notes,
        body,
      });
      res.status(201).json({
        success: true,
        data: prompt,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, notes, status } = req.body;
      const prompt = await promptService.updatePrompt(req.params.id as string, {
        name,
        notes,
        status,
      });
      res.json({
        success: true,
        data: prompt,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async listVersions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const versions = await promptService.listVersions(req.params.id as string);
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
      const version = await promptService.getVersionDetails(
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
      const { body, notes } = req.body;
      const version = await promptService.createVersion(req.params.id as string, body, notes);
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
      const version = await promptService.rollbackVersion(req.params.id as string, versionNumber);
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

export default promptController;
