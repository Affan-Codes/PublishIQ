import { prisma } from '../database/db.js';

export const logRepository = {
  async deleteLogsOlderThan(date: Date): Promise<{ count: number }> {
    return prisma.log.deleteMany({
      where: {
        createdAt: { lt: date },
      },
    });
  },
};

export default logRepository;
