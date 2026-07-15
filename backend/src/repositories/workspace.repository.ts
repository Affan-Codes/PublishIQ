import { Workspace } from '@prisma/client';
import { prisma } from '../database/db.js';

export const workspaceRepository = {
  async getById(id: string): Promise<Workspace | null> {
    return prisma.workspace.findUnique({
      where: { id },
    });
  },

  async getFirst(): Promise<Workspace | null> {
    return prisma.workspace.findFirst();
  },

  async list(): Promise<Workspace[]> {
    return prisma.workspace.findMany({
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(name: string): Promise<Workspace> {
    return prisma.workspace.create({
      data: { name },
    });
  },

  async update(id: string, name: string): Promise<Workspace> {
    return prisma.workspace.update({
      where: { id },
      data: { name },
    });
  },

  async delete(id: string): Promise<Workspace> {
    return prisma.workspace.delete({
      where: { id },
    });
  },
};

export default workspaceRepository;
