import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/db.js';
import publishingService from '../services/publishing.service.js';
import { PublishRecordStatus } from '@prisma/client';

export const publishingHistoryController = {
  /**
   * Lists publishing record history with filters, pagination, and sorting.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId as string;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const skip = (page - 1) * limit;

      const platform = req.query.platform as string;
      const channelId = req.query.channelId as string;
      const status = req.query.status as string;
      const contentTypeSnapshot = req.query.contentTypeSnapshot as string;

      const whereClause: Record<string, any> = { workspaceId };
      
      if (platform) whereClause.platform = platform;
      if (channelId) whereClause.channelId = channelId;
      if (status) whereClause.status = status as PublishRecordStatus;
      if (contentTypeSnapshot) whereClause.contentTypeSnapshot = contentTypeSnapshot;

      // Handle search queries
      const search = req.query.search as string;
      if (search) {
        whereClause.OR = [
          { errorDetails: { contains: search, mode: 'insensitive' } },
          { platformPostId: { contains: search, mode: 'insensitive' } },
          { publishedUrl: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        prisma.publishingRecord.findMany({
          where: whereClause,
          include: {
            channel: { select: { name: true } },
            platformConnection: { select: { id: true, scopes: true, healthStatus: true } },
            generatedContent: { select: { text: true, imageUrl: true, videoUrl: true, caption: true } }
          },
          orderBy: { publishedAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.publishingRecord.count({ where: whereClause }),
      ]);

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
   * Retrieves detail logs for a specific publishing record.
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId as string;
      const record = await prisma.publishingRecord.findFirst({
        where: { id: req.params.id as string, workspaceId },
        include: {
          channel: true,
          platformConnection: { select: { id: true, scopes: true, healthStatus: true } },
          generatedContent: true,
          job: true,
        }
      });

      if (!record) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Publishing record not found.' }
        });
        return;
      }

      res.json({
        success: true,
        data: record,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Action: republish generated content using a selected channel connection.
   */
  async republish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId as string;
      const { generatedContentId, channelId } = req.body;

      await publishingService.republishContent(generatedContentId, channelId, workspaceId);

      res.json({
        success: true,
        data: {},
        meta: { message: 'Republish triggered successfully.' }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Action: manually retry a failed publishing record.
   */
  async retry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId as string;
      const { id } = req.params;

      await publishingService.retryPublishRecord(id as string, workspaceId);

      res.json({
        success: true,
        data: {},
        meta: { message: 'Retry publishing completed successfully.' }
      });
    } catch (error) {
      next(error);
    }
  }
};

export default publishingHistoryController;
