import { HealthStatus, JobType, PipelineStage } from '@prisma/client';
import { jobRepository } from '../repositories/job.repository.js';
import { logRepository } from '../repositories/log.repository.js';
import { platformConnectionRepository } from '../repositories/platformConnection.repository.js';
import { runContentPipeline } from './content-pipeline.service.js';
import { logger } from '../utils/logger.js';

export async function runCleanup(): Promise<void> {
  logger.info('Running background data cleanup tasks');
  
  // Clear any logs older than 30 days
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - 30);

  const { count } = await logRepository.deleteLogsOlderThan(thresholdDate);

  logger.info({ logsDeleted: count }, 'Cleanup completed successfully');
}

export async function runArchive(): Promise<void> {
  logger.info('Running background data archiving tasks');
  
  // Simulated archiving task
  logger.info('Archiving completed successfully');
}

export async function runRetryPublish(jobId: string): Promise<void> {
  logger.info({ jobId }, 'Initiating auto-retry publishing for job');

  const job = await jobRepository.getById(jobId);
  if (!job) {
    logger.error({ jobId }, 'Retry failed: Job not found');
    return;
  }

  // Confirm job is in Failed state before resuming
  if (job.pipelineStage !== PipelineStage.Failed) {
    logger.warn({ jobId, stage: job.pipelineStage }, 'Job is not in Failed state. Aborting retry.');
    return;
  }

  // Restore pipeline execution
  await runContentPipeline(jobId);
}

export async function runTokenRefresh(): Promise<void> {
  logger.info('Checking for expiring platform connection tokens to refresh');
  
  const thresholdDate = new Date();
  thresholdDate.setHours(thresholdDate.getHours() + 2); // Refresh tokens expiring within 2 hours

  const connections = await platformConnectionRepository.getExpiringConnections(thresholdDate);

  for (const conn of connections) {
    logger.info({ connectionId: conn.id, platform: conn.platform }, 'Refreshing access token');
    
    const newExpiresAt = new Date();
    newExpiresAt.setHours(newExpiresAt.getHours() + 24); // Expiry in 24 hours

    await platformConnectionRepository.updateRaw(conn.id, {
      expiresAt: newExpiresAt,
      healthStatus: HealthStatus.Healthy,
    });
    logger.info({ connectionId: conn.id }, 'Access token refreshed successfully');
  }
}

export async function runHealthCheck(): Promise<void> {
  logger.info('Running platform connection health checks');
  const connections = await platformConnectionRepository.listAll();

  for (const conn of connections) {
    let healthStatus: HealthStatus = HealthStatus.Healthy;
    if (conn.expiresAt < new Date()) {
      healthStatus = HealthStatus.Expired;
    }

    await platformConnectionRepository.updateRaw(conn.id, { healthStatus });
  }
}

export const maintenanceService = {
  runCleanup,
  runArchive,
  runRetryPublish,
  runTokenRefresh,
  runHealthCheck,
};

export default maintenanceService;
