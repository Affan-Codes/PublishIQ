import { Router, Request, Response, NextFunction } from 'express';
import { dashboardRepository } from '../repositories/dashboard.repository.js';
import { getRedisInstance } from '../database/redis.js';
import { requireAuth } from '../middlewares/auth.js';
import os from 'os';

const router = Router();

/**
 * Public, unauthenticated liveness check.
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  res.json({
    success: true,
    data: {
      status: 'UP',
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * Authenticated system diagnostics/metrics check.
 */
router.get('/health/diagnostics', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Check PostgreSQL health and measure latency
    const dbStart = Date.now();
    await dashboardRepository.pingDatabase();
    const dbLatencyMs = Date.now() - dbStart;
    const dbStatus = 'healthy';

    // 2. Check Redis health
    const redis = getRedisInstance();
    const redisStart = Date.now();
    const pingResult = await redis.ping();
    const redisLatencyMs = Date.now() - redisStart;
    const redisStatus = pingResult === 'PONG' ? 'healthy' : 'unhealthy';

    // 3. Collect OS/Process metrics
    const memoryUsage = process.memoryUsage();
    const systemUptime = os.uptime();
    const processUptime = process.uptime();
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();

    res.json({
      success: true,
      data: {
        status: 'UP',
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        redis: {
          status: redisStatus,
          latencyMs: redisLatencyMs,
        },
        system: {
          uptimeSeconds: systemUptime,
          freeMemoryBytes: freeMemory,
          totalMemoryBytes: totalMemory,
          memoryUsagePercentage: ((1 - freeMemory / totalMemory) * 100).toFixed(2) + '%',
        },
        process: {
          uptimeSeconds: processUptime,
          memoryUsage: {
            rss: memoryUsage.rss,
            heapTotal: memoryUsage.heapTotal,
            heapUsed: memoryUsage.heapUsed,
            external: memoryUsage.external,
          },
        },
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
