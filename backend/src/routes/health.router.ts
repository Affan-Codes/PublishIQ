import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../database/db.js';
import { getRedisInstance } from '../database/redis.js';

const router = Router();

router.get('/health', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Check PostgreSQL health
    // Raw SQL is allowed here for checking database status directly
    await prisma.$queryRaw`SELECT 1`;
    const dbStatus = 'healthy';

    // 2. Check Redis health
    const redis = getRedisInstance();
    const pingResult = await redis.ping();
    const redisStatus = pingResult === 'PONG' ? 'healthy' : 'unhealthy';

    res.json({
      success: true,
      data: {
        database: dbStatus,
        redis: redisStatus,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;
