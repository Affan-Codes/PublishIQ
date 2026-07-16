import { Request, Response, NextFunction } from 'express';
import userService from '../services/user.service.js';

export const userController = {
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.operator!.id;
      const user = await userService.getUserById(id);
      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
          workspaceId: user.workspaceId,
        },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.operator!.id;
      const { email, password } = req.body;
      const user = await userService.updateUser(id, { email, password });
      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
          workspaceId: user.workspaceId,
        },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.getUserById(req.params.id as string);
      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
          workspaceId: user.workspaceId,
        },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await userService.listUsers();
      res.json({
        success: true,
        data: list.map((user) => ({
          id: user.id,
          email: user.email,
          role: user.role,
          workspaceId: user.workspaceId,
          createdAt: user.createdAt,
        })),
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, role } = req.body;
      const user = await userService.createUser({
        email,
        password,
        role,
        workspaceId: req.workspaceId ?? null,
      });
      res.status(201).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
          workspaceId: user.workspaceId,
        },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, role } = req.body;
      const user = await userService.updateUser(req.params.id as string, {
        email,
        password,
        role,
      });
      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
          workspaceId: user.workspaceId,
        },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.deleteUser(req.params.id as string);
      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },
};

export default userController;
