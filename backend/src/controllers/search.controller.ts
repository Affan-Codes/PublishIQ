import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/db.js';

export const searchController = {
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId as string;
      const query = (req.query.q as string || '').trim();

      if (!query) {
        res.json({
          success: true,
          data: {
            channels: [],
            generatedContents: [],
            jobs: [],
            publishingRecords: [],
            assets: [],
            templates: [],
            prompts: [],
            contentProfiles: [],
          },
          meta: {},
        });
        return;
      }

      // Execute database search queries in parallel for efficiency
      const [
        channels,
        generatedContents,
        jobs,
        publishingRecords,
        assets,
        templates,
        prompts,
        contentProfiles,
      ] = await Promise.all([
        prisma.channel.findMany({
          where: {
            workspaceId,
            name: { contains: query, mode: 'insensitive' },
          },
          take: 5,
        }),
        prisma.generatedContent.findMany({
          where: {
            workspaceId,
            OR: [
              { text: { contains: query, mode: 'insensitive' } },
              { caption: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: 5,
        }),
        prisma.job.findMany({
          where: {
            workspaceId,
            OR: [
              { failureReason: { contains: query, mode: 'insensitive' } },
              { generatedText: { contains: query, mode: 'insensitive' } },
              { caption: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: 5,
        }),
        prisma.publishingRecord.findMany({
          where: {
            workspaceId,
            OR: [
              { publishedUrl: { contains: query, mode: 'insensitive' } },
              { platformPostId: { contains: query, mode: 'insensitive' } },
              { errorDetails: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: 5,
        }),
        prisma.asset.findMany({
          where: {
            workspaceId,
            name: { contains: query, mode: 'insensitive' },
          },
          take: 5,
        }),
        prisma.template.findMany({
          where: {
            workspaceId,
            name: { contains: query, mode: 'insensitive' },
          },
          take: 5,
        }),
        prisma.prompt.findMany({
          where: {
            workspaceId,
            name: { contains: query, mode: 'insensitive' },
          },
          take: 5,
        }),
        prisma.contentProfile.findMany({
          where: {
            workspaceId,
            OR: [
              { tone: { contains: query, mode: 'insensitive' } },
              { writingStyle: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: 5,
        }),
      ]);

      res.json({
        success: true,
        data: {
          channels,
          generatedContents,
          jobs,
          publishingRecords,
          assets,
          templates,
          prompts,
          contentProfiles,
        },
        meta: {
          query,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

export default searchController;
