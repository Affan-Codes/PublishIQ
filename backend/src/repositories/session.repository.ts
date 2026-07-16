import { Session, User } from '@prisma/client';
import { prisma } from '../database/db.js';

export type SessionWithUser = Session & {
  user: User;
};

export const sessionRepository = {
  async getById(id: string): Promise<SessionWithUser | null> {
    return prisma.session.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });
  },

  async create(userId: string, expiresAt: Date): Promise<Session> {
    return prisma.session.create({
      data: {
        userId,
        expiresAt,
      },
    });
  },

  async touch(id: string, expiresAt: Date): Promise<Session> {
    return prisma.session.update({
      where: { id },
      data: { expiresAt },
    });
  },

  async delete(id: string): Promise<Session> {
    return prisma.session.delete({
      where: { id },
    });
  },

  async deleteExpired(): Promise<{ count: number }> {
    return prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  },
};

export default sessionRepository;
