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

  async create(name: string): Promise<Workspace> {
    return prisma.workspace.create({
      data: { name },
    });
  },
};

export default workspaceRepository;
