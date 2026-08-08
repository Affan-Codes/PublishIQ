import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './database/db.js';
import { getValkeyInstance } from './database/valkey.js';
import { eventBus } from './events/event-bus.js';
import { logger } from './utils/logger.js';
import { systemConfigCache } from './config/system-config.cache.js';
import { featureFlagCache } from './config/feature-flag.cache.js';
import notificationService from './services/notification.service.js';
import { bootstrapWorkers, shutdownWorkers } from './workers/index.js';

async function main() {
  logger.info('Starting PublishIQ API Server...');

  // 1. Connect to Database
  await prisma.$connect();
  logger.info('Database connection established');

  // 2. Connect to Valkey
  const valkey = getValkeyInstance();
  await valkey.ping();
  logger.info('Valkey connection verified');

  // 3. Initialize EventBus as subscriber (to process SSE notification re-emits)
  await eventBus.init(true);
  notificationService.startEventListener();

  // 4. Initial cache loading
  await systemConfigCache.reload();
  await featureFlagCache.reload();

  // 5. Bootstrap BullMQ background workers
  await bootstrapWorkers();
  logger.info('Background workers initialized');

  // 6. Start listening
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 API Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        await shutdownWorkers();
        logger.info('Workers shut down');

        await prisma.$disconnect();
        logger.info('Database connection closed');
        
        await eventBus.close();
        logger.info('EventBus connection closed');
        
        const valkeyInstance = getValkeyInstance();
        await valkeyInstance.quit();
        logger.info('Valkey connection closed');
        
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
