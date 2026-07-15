import { Worker } from 'bullmq';
import { startContentPipelineWorker } from './content-pipeline.worker.js';
import { startMaintenanceWorkers } from './maintenance.worker.js';
import { logger } from '../utils/logger.js';
import { systemConfigCache } from '../config/system-config.cache.js';

let activeWorkers: Worker[] = [];

export async function bootstrapWorkers(): Promise<void> {
  logger.info('Bootstrapping workers...');

  // Initialize configurations caches before starting workers
  await systemConfigCache.reload();

  // Load concurrency from system configuration table (default is 2)
  const concurrencyVal = await systemConfigCache.get<number>('render_concurrency');
  const renderConcurrency = typeof concurrencyVal === 'number' ? concurrencyVal : 2;

  const contentPipelineWorker = startContentPipelineWorker(renderConcurrency);
  const maintenanceWorkers = startMaintenanceWorkers();

  activeWorkers = [contentPipelineWorker, ...maintenanceWorkers];
  logger.info('All workers bootstrapped successfully');
}

export async function shutdownWorkers(): Promise<void> {
  logger.info('Shutting down workers...');
  await Promise.all(activeWorkers.map((w) => w.close()));
  logger.info('All workers shut down');
}
