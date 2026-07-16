import { Request, Response, NextFunction } from 'express';
import channelService from '../services/channel.service.js';

export const channelController = {
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const channel = await channelService.getChannelById(req.params.id as string);
      res.json({
        success: true,
        data: channel,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await channelService.listChannels(req.workspaceId!);
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
      const channel = await channelService.createChannel({
        workspaceId: req.workspaceId!,
        ...req.body,
      });
      res.status(201).json({
        success: true,
        data: channel,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const channel = await channelService.updateChannel(
        req.params.id as string,
        req.workspaceId!,
        req.body
      );
      res.json({
        success: true,
        data: channel,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await channelService.deleteChannel(req.params.id as string);
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
      const channel = await channelService.duplicateChannel(
        req.params.id as string,
        req.workspaceId!
      );
      res.status(201).json({
        success: true,
        data: channel,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },
};

export default channelController;
