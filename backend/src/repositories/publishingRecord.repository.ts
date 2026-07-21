import { PublishingRecord, Prisma, PublishRecordStatus } from '@prisma/client';
import { prisma } from '../database/db.js';

export const publishingRecordRepository = {
  async getById(id: string, workspaceId?: string): Promise<any | null> {
    const where: Prisma.PublishingRecordWhereInput = { id };
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }
    return prisma.publishingRecord.findUnique({
      where: { id },
      include: {
        channel: true,
        platformConnection: { select: { id: true, scopes: true, healthStatus: true } },
        generatedContent: true,
        job: true,
      },
    });
  },

  async findFirst(where: Prisma.PublishingRecordWhereInput): Promise<any | null> {
    return prisma.publishingRecord.findFirst({
      where,
      include: {
        channel: true,
        platformConnection: { select: { id: true, scopes: true, healthStatus: true } },
        generatedContent: true,
        job: true,
      },
    });
  },

  async list(
    workspaceId: string,
    filters: {
      platform?: string;
      channelId?: string;
      status?: PublishRecordStatus;
      contentTypeSnapshot?: string;
      search?: string;
      skip?: number;
      take?: number;
    }
  ): Promise<PublishingRecord[]> {
    const where: Prisma.PublishingRecordWhereInput = { workspaceId };
    
    if (filters.platform) where.platform = filters.platform as any;
    if (filters.channelId) where.channelId = filters.channelId;
    if (filters.status) where.status = filters.status;
    if (filters.contentTypeSnapshot) where.contentTypeSnapshot = filters.contentTypeSnapshot;

    if (filters.search) {
      where.OR = [
        { errorDetails: { contains: filters.search, mode: 'insensitive' } },
        { platformPostId: { contains: filters.search, mode: 'insensitive' } },
        { publishedUrl: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const options: any = {
      where,
      include: {
        channel: { select: { name: true } },
        platformConnection: { select: { id: true, scopes: true, healthStatus: true } },
        generatedContent: { select: { text: true, imageUrl: true, videoUrl: true, caption: true } },
      },
      orderBy: { publishedAt: 'desc' },
    };

    if (filters.skip !== undefined) options.skip = filters.skip;
    if (filters.take !== undefined) options.take = filters.take;

    return prisma.publishingRecord.findMany(options);
  },

  async count(
    workspaceId: string,
    filters: {
      platform?: string;
      channelId?: string;
      status?: PublishRecordStatus;
      contentTypeSnapshot?: string;
      search?: string;
      jobId?: string;
      excludeId?: string;
    }
  ): Promise<number> {
    const where: Prisma.PublishingRecordWhereInput = { workspaceId };

    if (filters.platform) where.platform = filters.platform as any;
    if (filters.channelId) where.channelId = filters.channelId;
    if (filters.status) where.status = filters.status;
    if (filters.contentTypeSnapshot) where.contentTypeSnapshot = filters.contentTypeSnapshot;
    if (filters.jobId) where.jobId = filters.jobId;
    if (filters.excludeId) where.id = { not: filters.excludeId };

    if (filters.search) {
      where.OR = [
        { errorDetails: { contains: filters.search, mode: 'insensitive' } },
        { platformPostId: { contains: filters.search, mode: 'insensitive' } },
        { publishedUrl: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return prisma.publishingRecord.count({ where });
  },

  async create(data: Prisma.PublishingRecordUncheckedCreateInput): Promise<PublishingRecord> {
    return prisma.publishingRecord.create({
      data,
    });
  },

  async update(id: string, data: Prisma.PublishingRecordUncheckedUpdateInput): Promise<PublishingRecord> {
    return prisma.publishingRecord.update({
      where: { id },
      data,
    });
  },
};

export default publishingRecordRepository;
