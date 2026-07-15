import { prisma } from './database/db.js';
import { getRedisInstance } from './database/redis.js';
import { eventBus } from './events/event-bus.js';
import { logger } from './utils/logger.js';
import { bootstrapWorkers, shutdownWorkers } from './workers/index.js';

async function main() {
  logger.info('Starting PublishIQ Worker Engine...');

  // 1. Connect to Database
  await prisma.$connect();
  logger.info('Database connection established');

  // 2. Connect to Redis
  const redis = getRedisInstance();
  await redis.ping();
  logger.info('Redis connection verified');

  // 3. Initialize EventBus (only as publisher, no need to subscribe to events in worker)
  await eventBus.init(false);

  // 4. Bootstrap BullMQ workers
  await bootstrapWorkers();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down worker process...`);
    
    try {
      await shutdownWorkers();
      
      await prisma.$disconnect();
      logger.info('Database connection closed');
      
      await eventBus.close();
      logger.info('EventBus connection closed');
      
      const redisInstance = getRedisInstance();
      await redisInstance.quit();
      logger.info('Redis connection closed');
      
      logger.info('Worker engine shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal worker startup error');
  process.exit(1);
});
