import { HealthStatus, PipelineStage } from '@prisma/client';
import { jobRepository } from '../repositories/job.repository.js';
import { logRepository } from '../repositories/log.repository.js';
import { platformConnectionRepository } from '../repositories/platformConnection.repository.js';
import { runContentPipeline } from './content-pipeline.service.js';
import { publishingService } from './publishing.service.js';
import eventBus from '../events/event-bus.js';
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
    logger.info({ connectionId: conn.id, platform: conn.platform }, 'Proactively refreshing access token');
    
    try {
      await publishingService.refreshConnectionTokens(conn.id);
      logger.info({ connectionId: conn.id }, 'Access token proactively refreshed successfully');
    } catch (err: any) {
      logger.error({ connectionId: conn.id, err: err.message }, 'Scheduled token refresh failed');
      await platformConnectionRepository.updateRaw(conn.id, {
        healthStatus: HealthStatus.Unhealthy,
      });
      await eventBus.emitDomainEvent(
        conn.workspaceId,
        'TokenRefreshFailed',
        { connectionId: conn.id, platform: conn.platform, error: err.message }
      );
    }
  }
}

export async function runHealthCheck(): Promise<void> {
  logger.info('Running platform connection health checks');
  const connections = await platformConnectionRepository.listAll();

  for (const conn of connections) {
    try {
      await publishingService.ensureConnectionHealth(conn);
    } catch (err: any) {
      logger.warn({ connectionId: conn.id, err: err.message }, 'Platform connection health check failed');
    }
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
