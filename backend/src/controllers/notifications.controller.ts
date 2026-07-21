import { Request, Response, NextFunction } from 'express';
import notificationService from '../services/notification.service.js';

export const notificationsController = {
  /**
   * Establishes a Server-Sent Events (SSE) connection stream for real-time notifications.
   */
  async sseStream(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const workspaceId = req.workspaceId as string;
      notificationService.registerClient(res, workspaceId);

      // Send initial connect signal
      res.write(`event: connect\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`);

      // Set up a keep-alive ping interval to prevent connection timeout
      const pingInterval = setInterval(() => {
        res.write(': ping\n\n');
      }, 30000);

      req.on('close', () => {
        clearInterval(pingInterval);
        notificationService.unregisterClient(res);
        res.end();
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Lists all in-app notifications for the workspace, paginated.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId as string;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const skip = (page - 1) * limit;

      const { items, total } = await notificationService.listNotifications(workspaceId, skip, limit);

      res.json({
        success: true,
        data: items,
        meta: {
          total,
          page,
          limit,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Marks a single notification as read.
   */
  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspaceId as string;

      const notification = await notificationService.markAsRead(id as string, workspaceId);

      res.json({
        success: true,
        data: notification,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Marks all notifications in the workspace as read.
   */
  async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId as string;

      await notificationService.markAllAsRead(workspaceId);

      res.json({
        success: true,
        data: {},
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },
};

export default notificationsController;
