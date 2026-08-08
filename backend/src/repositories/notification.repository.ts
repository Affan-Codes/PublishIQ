import { Notification, Prisma } from '@prisma/client';
import { prisma } from '../database/db.js';

export interface NotificationListOptions {
  status?: 'unread' | 'read' | 'all' | undefined;
  type?: string | undefined;
  search?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  skip?: number | undefined;
  take?: number | undefined;
}

export const notificationRepository = {
  async getById(id: string, workspaceId?: string): Promise<Notification | null> {
    if (workspaceId) {
      return prisma.notification.findFirst({
        where: { id, workspaceId },
        include: {
          domainEvent: true,
        },
      });
    }
    return prisma.notification.findUnique({
      where: { id },
      include: {
        domainEvent: true,
      },
    });
  },

  async findFirst(where: Prisma.NotificationWhereInput): Promise<Notification | null> {
    return prisma.notification.findFirst({
      where,
      include: {
        domainEvent: true,
      },
    });
  },

  async countUnread(workspaceId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        workspaceId,
        readAt: null,
      },
    });
  },

  async list(workspaceId: string, skip: number, take: number, options: NotificationListOptions = {}): Promise<Notification[]> {
    const where: Prisma.NotificationWhereInput = {
      workspaceId,
    };

    if (options.status === 'unread') {
      where.readAt = null;
    } else if (options.status === 'read') {
      where.readAt = { not: null };
    }

    if (options.type) {
      where.domainEvent = {
        type: options.type,
      };
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    if (options.search) {
      const query = options.search;
      where.OR = [
        { message: { contains: query, mode: 'insensitive' } },
        {
          domainEvent: {
            is: {
              type: { contains: query, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    return prisma.notification.findMany({
      where,
      include: {
        domainEvent: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  },

  async count(workspaceId: string, options: NotificationListOptions = {}): Promise<number> {
    const where: Prisma.NotificationWhereInput = {
      workspaceId,
    };

    if (options.status === 'unread') {
      where.readAt = null;
    } else if (options.status === 'read') {
      where.readAt = { not: null };
    }

    if (options.type) {
      where.domainEvent = {
        type: options.type,
      };
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    if (options.search) {
      const query = options.search;
      where.OR = [
        { message: { contains: query, mode: 'insensitive' } },
        {
          domainEvent: {
            is: {
              type: { contains: query, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    return prisma.notification.count({
      where,
    });
  },

  async create(data: Prisma.NotificationUncheckedCreateInput): Promise<Notification> {
    return prisma.notification.create({
      data,
      include: {
        domainEvent: true,
      },
    });
  },

  async update(id: string, data: Prisma.NotificationUncheckedUpdateInput): Promise<Notification> {
    return prisma.notification.update({
      where: { id },
      data,
      include: {
        domainEvent: true,
      },
    });
  },

  async delete(id: string, workspaceId: string): Promise<Notification> {
    return prisma.notification.delete({
      where: { id },
      include: {
        domainEvent: true,
      },
    });
  },

  async markAllAsRead(workspaceId: string): Promise<Prisma.BatchPayload> {
    return prisma.notification.updateMany({
      where: {
        workspaceId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  },
};

export default notificationRepository;
