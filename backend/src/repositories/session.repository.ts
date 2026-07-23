import { Session, User } from '@prisma/client';
import { prisma } from '../database/db.js';
import crypto from 'crypto';

export type SessionWithUser = Session & {
  user: User;
};

const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const sessionRepository = {
  async getById(id: string): Promise<SessionWithUser | null> {
    const hashed = hashToken(id);
    return prisma.session.findFirst({
      where: {
        OR: [
          { tokenHash: hashed },
          { id: id },
        ],
      },
      include: {
        user: true,
      },
    });
  },

  async create(userId: string, expiresAt: Date): Promise<Session> {
    const rawId = crypto.randomUUID();
    const tokenHash = hashToken(rawId);
    return prisma.session.create({
      data: {
        id: rawId,
        userId,
        tokenHash,
        expiresAt,
      },
    });
  },

  async touch(id: string, expiresAt: Date): Promise<Session> {
    const hashed = hashToken(id);
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Session not found: ${id}`);
    }
    return prisma.session.update({
      where: { id: existing.id },
      data: { expiresAt },
    });
  },

  async delete(id: string): Promise<Session> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Session not found: ${id}`);
    }
    return prisma.session.delete({
      where: { id: existing.id },
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
