import { Notification, Prisma } from '@prisma/client';
import { prisma } from '../database/db.js';

export const notificationRepository = {
  async getById(id: string): Promise<Notification | null> {
    return prisma.notification.findUnique({
      where: { id },
    });
  },

  async findFirst(where: Prisma.NotificationWhereInput): Promise<Notification | null> {
    return prisma.notification.findFirst({
      where,
    });
  },

  async list(workspaceId: string, skip: number, take: number): Promise<Notification[]> {
    return prisma.notification.findMany({
      where: { workspaceId },
      include: {
        domainEvent: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  },

  async count(workspaceId: string): Promise<number> {
    return prisma.notification.count({
      where: { workspaceId },
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
