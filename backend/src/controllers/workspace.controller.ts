import { Request, Response, NextFunction } from 'express';
import workspaceService from '../services/workspace.service.js';

export const workspaceController = {
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspace = await workspaceService.getWorkspaceById(req.params.id as string);
      res.json({
        success: true,
        data: workspace,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await workspaceService.listWorkspaces();
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
      const { name } = req.body;
      const workspace = await workspaceService.createWorkspace(name);
      res.status(201).json({
        success: true,
        data: workspace,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.body;
      const workspace = await workspaceService.updateWorkspace(req.params.id as string, name);
      res.json({
        success: true,
        data: workspace,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspace = await workspaceService.deleteWorkspace(req.params.id as string);
      res.json({
        success: true,
        data: workspace,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },
};

export default workspaceController;
