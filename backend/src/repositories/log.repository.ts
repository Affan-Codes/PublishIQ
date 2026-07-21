import { prisma } from '../database/db.js';

export const logRepository = {
  async deleteLogsOlderThan(date: Date): Promise<{ count: number }> {
    return prisma.log.deleteMany({
      where: {
        createdAt: { lt: date },
      },
    });
  },

  async createDomainEvent(data: {
    workspaceId: string;
    type: string;
    payload: any;
    jobId?: string | null;
  }) {
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

export default logRepository;
