import { GeneratedContent, Prisma, PublishStatus, Language } from '@prisma/client';
import { prisma } from '../database/db.js';

export interface GeneratedContentFilters {
  contentProfileId?: string;
  publishStatus?: PublishStatus;
  language?: Language;
  contentTypeId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const generatedContentRepository = {
  db: prisma,

  async getById(id: string): Promise<GeneratedContent | null> {
    return prisma.generatedContent.findUnique({
      where: { id },
      include: {
        contentProfile: {
          include: {
            contentType: true,
          },
        },
      },
    });
  },

  async list(
    workspaceId: string,
    filters: GeneratedContentFilters
  ): Promise<{ items: GeneratedContent[]; total: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.GeneratedContentWhereInput = {
      workspaceId,
    };

    if (filters.contentProfileId) {
      where.contentProfileId = filters.contentProfileId;
    }
    if (filters.publishStatus) {
      where.publishStatus = filters.publishStatus;
    }
    if (filters.language) {
      where.language = filters.language;
    }
    if (filters.contentTypeId) {
      where.contentTypeId = filters.contentTypeId;
    }

    if (filters.search) {
      where.OR = [
        { text: { contains: filters.search, mode: 'insensitive' } },
        { caption: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.generatedContent.findMany({
        where,
        include: {
          contentProfile: {
            include: {
              contentType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.generatedContent.count({ where }),
    ]);

    return { items, total };
  },

  async create(data: Prisma.GeneratedContentUncheckedCreateInput): Promise<GeneratedContent> {
    return prisma.generatedContent.create({
      data,
    });
  },

  async update(id: string, data: Prisma.GeneratedContentUncheckedUpdateInput): Promise<GeneratedContent> {
    return prisma.generatedContent.update({
      where: { id },
      data,
    });
  },

  async delete(id: string): Promise<GeneratedContent> {
    return prisma.generatedContent.delete({
      where: { id },
    });
  },

  async findByTextHash(workspaceId: string, textHash: string): Promise<GeneratedContent | null> {
    return prisma.generatedContent.findFirst({
      where: {
        workspaceId,
        textHash,
      },
    });
  },

  async findByJobId(jobId: string): Promise<GeneratedContent | null> {
    return prisma.generatedContent.findFirst({
      where: {
        jobId,
      },
    });
  },

  async getByIdWithJob(id: string, workspaceId: string): Promise<any> {
    return prisma.generatedContent.findFirst({
      where: { id, workspaceId },
      include: { job: true },
    });
  },
};

export default generatedContentRepository;

