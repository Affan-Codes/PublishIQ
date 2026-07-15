import { ContentType, ContentTypeStatus } from '@prisma/client';
import { prisma } from '../database/db.js';

export const contentTypeRepository = {
  async getById(id: string): Promise<ContentType | null> {
    return prisma.contentType.findUnique({
      where: { id },
    });
  },

  async list(workspaceId: string): Promise<ContentType[]> {
    return prisma.contentType.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
  },

  async create(data: {
    workspaceId: string;
    name: string;
    status: ContentTypeStatus;
  }): Promise<ContentType> {
    return prisma.contentType.create({
      data,
    });
  },

  async update(
    id: string,
    data: {
      name?: string;
      status?: ContentTypeStatus;
    }
  ): Promise<ContentType> {
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.status !== undefined) updateData.status = data.status;

    return prisma.contentType.update({
      where: { id },
      data: updateData,
    });
  },

  async delete(id: string): Promise<ContentType> {
    return prisma.contentType.delete({
      where: { id },
    });
  },
};

export default contentTypeRepository;
