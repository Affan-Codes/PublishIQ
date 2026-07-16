import { User, Role } from '@prisma/client';
import { prisma } from '../database/db.js';

export const userRepository = {
  async getById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  },

  async getByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  },

  async create(data: {
    email: string;
    passwordHash: string;
    role: Role;
    workspaceId?: string | null;
  }): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        role: data.role,
        workspaceId: data.workspaceId ?? null,
      },
    });
  },

  async update(
    id: string,
    data: {
      email?: string;
      passwordHash?: string;
      role?: Role;
      workspaceId?: string | null;
    }
  ): Promise<User> {
    const updateData: Record<string, any> = {};
    if (data.email !== undefined) updateData.email = data.email.toLowerCase();
    if (data.passwordHash !== undefined) updateData.passwordHash = data.passwordHash;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.workspaceId !== undefined) updateData.workspaceId = data.workspaceId;

    return prisma.user.update({
      where: { id },
      data: updateData,
    });
  },

  async delete(id: string): Promise<User> {
    return prisma.user.delete({
      where: { id },
    });
  },

  async list(workspaceId?: string): Promise<User[]> {
    const options: any = {
      orderBy: { email: 'asc' },
    };
    if (workspaceId !== undefined) {
      options.where = { workspaceId };
    }
    return prisma.user.findMany(options);
  },
};

export default userRepository;
