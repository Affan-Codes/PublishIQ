import { Router, Request, Response, NextFunction } from 'express';
import dashboardService from '../services/dashboard.service.js';
import { getValkeyInstance } from '../database/valkey.js';
import { contentPipelineQueue } from '../jobs/index.js';
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
    await dashboardService.checkDatabaseHealth();
    const dbLatencyMs = Date.now() - dbStart;
    const dbStatus = 'healthy';

    // 2. Check Valkey health
    const valkey = getValkeyInstance();
    const valkeyStart = Date.now();
    const pingResult = await valkey.ping();
    const valkeyLatencyMs = Date.now() - valkeyStart;
    const valkeyStatus = pingResult === 'PONG' ? 'healthy' : 'unhealthy';

    // 3. Check BullMQ pipeline worker liveness
    let workerStatus = 'unhealthy';
    let workerCount = 0;
    try {
      const workers = await contentPipelineQueue.getWorkers();
      workerCount = Array.isArray(workers) ? workers.length : 0;
      workerStatus = workerCount > 0 ? 'healthy' : 'unhealthy';
    } catch {
      workerStatus = 'unhealthy';
      workerCount = 0;
    }

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
        valkey: {
          status: valkeyStatus,
          latencyMs: valkeyLatencyMs,
        },
        worker: {
          status: workerStatus,
          count: workerCount,
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
