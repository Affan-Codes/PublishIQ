import { prisma } from '../database/db.js';
import { DomainEvent, Prisma } from '@prisma/client';

export interface DomainEventListFilters {
  page?: number | undefined;
  limit?: number | undefined;
  type?: string | undefined;
  jobId?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  search?: string | undefined;
}

export const domainEventRepository = {
  async list(
    workspaceId: string,
    filters: DomainEventListFilters = {}
  ): Promise<{ items: DomainEvent[]; total: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.DomainEventWhereInput = {
      workspaceId,
    };

    if (filters.type) {
      where.type = {
        contains: filters.type,
        mode: 'insensitive',
      };
    }

    if (filters.jobId) {
      where.jobId = filters.jobId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    if (filters.search) {
      where.type = { contains: filters.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      prisma.domainEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.domainEvent.count({ where }),
    ]);

    return { items, total };
  },

  async getById(id: string, workspaceId: string): Promise<DomainEvent | null> {
    return prisma.domainEvent.findFirst({
      where: {
        id,
        workspaceId,
      },
    });
  },

  async create(data: {
    workspaceId: string;
    type: string;
    payload: any;
    jobId?: string | null;
  }): Promise<DomainEvent> {
    return prisma.domainEvent.create({
      data: {
        workspaceId: data.workspaceId,
        type: data.type,
        payload: data.payload,
        jobId: data.jobId || null,
      },
    });
  },
};

export default domainEventRepository;
