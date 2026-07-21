import { prisma } from '../database/db.js';
import { PipelineStage, PublishRecordStatus } from '@prisma/client';

export const dashboardRepository = {
  async getDashboardData(workspaceId: string) {
    return Promise.all([
      prisma.channel.count({ where: { workspaceId } }),
      prisma.generatedContent.count({ where: { workspaceId } }),
      prisma.publishingRecord.count({ where: { workspaceId, status: PublishRecordStatus.Success } }),
      prisma.publishingRecord.count({ where: { workspaceId, status: PublishRecordStatus.Failure } }),
      prisma.platformConnection.findMany({
        where: { workspaceId },
        select: { platform: true, healthStatus: true, status: true },
      }),
      prisma.job.findMany({
        where: {
          workspaceId,
          pipelineStage: PipelineStage.Failed,
        },
        include: {
          channel: { select: { name: true } }
        },
        orderBy: { failedAt: 'desc' },
        take: 5,
      }),
      prisma.publishingRecord.findMany({
        where: { workspaceId },
        include: {
          channel: { select: { name: true } },
          generatedContent: { select: { text: true } }
        },
        orderBy: { publishedAt: 'desc' },
        take: 5,
      }),
    ]);
  },

  async pingDatabase(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
  }
};

export default dashboardRepository;
