import { HealthStatus, PipelineStage, PublishRecordStatus } from '@prisma/client';
import { prisma } from '../database/db.js';
import { env } from '../config/env.js';
import { jobRepository } from '../repositories/job.repository.js';
import { platformConnectionRepository } from '../repositories/platformConnection.repository.js';
import { cloudinaryStorageProvider } from '../providers/storage/cloudinary.provider.js';
import { runContentPipeline } from './content-pipeline.service.js';
import { publishingService } from './publishing.service.js';
import eventBus from '../events/event-bus.js';
import { logger } from '../utils/logger.js';

export async function runMediaCleanup(): Promise<{ cleanedJobsCount: number; deletedFilesCount: number }> {
  const retentionDays = env.MEDIA_RETENTION_DAYS;
  logger.info({ retentionDays }, 'Running background media retention cleanup task');

  const thresholdDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  // Query generated content linked to terminal jobs older than retention threshold
  const contentsToClean = await prisma.generatedContent.findMany({
    where: {
      mediaDeletedAt: null,
      job: {
        pipelineStage: {
          in: [PipelineStage.Completed, PipelineStage.Failed, PipelineStage.Archived],
        },
        updatedAt: {
          lte: thresholdDate,
        },
      },
      OR: [
        { imageUrl: { not: null } },
        { videoUrl: { not: null } },
      ],
    },
    include: {
      job: {
        include: {
          publishingRecords: true,
        },
      },
    },
  });

  let cleanedJobsCount = 0;
  let deletedFilesCount = 0;

  for (const gc of contentsToClean) {
    const job = gc.job;

    // Skip if any publishing record is non-terminal
    if (job?.publishingRecords) {
      const hasNonTerminalRecords = job.publishingRecords.some((rec) => {
        return rec.status !== PublishRecordStatus.Success && rec.status !== PublishRecordStatus.Failure;
      });

      if (hasNonTerminalRecords) {
        logger.debug({ jobId: gc.jobId }, 'Skipping media cleanup for job with non-terminal publishing records');
        continue;
      }
    }

    const jobUpdatedAt = job?.updatedAt || gc.updatedAt;
    const ageInDays = Math.floor((Date.now() - new Date(jobUpdatedAt).getTime()) / (1000 * 60 * 60 * 24));
    let filesDeletedForJob = 0;

    if (gc.imageUrl) {
      try {
        if (cloudinaryStorageProvider.delete) {
          await cloudinaryStorageProvider.delete(gc.imageUrl);
        }
        logger.info({ jobId: gc.jobId, imageUrl: gc.imageUrl, ageInDays }, 'Deleted expired job image asset');
        filesDeletedForJob++;
      } catch (err: any) {
        logger.error({ jobId: gc.jobId, imageUrl: gc.imageUrl, err: err.message }, 'Failed to delete job image asset');
      }
    }

    if (gc.videoUrl) {
      try {
        if (cloudinaryStorageProvider.delete) {
          await cloudinaryStorageProvider.delete(gc.videoUrl);
        }
        logger.info({ jobId: gc.jobId, videoUrl: gc.videoUrl, ageInDays }, 'Deleted expired job video asset');
        filesDeletedForJob++;
      } catch (err: any) {
        logger.error({ jobId: gc.jobId, videoUrl: gc.videoUrl, err: err.message }, 'Failed to delete job video asset');
      }
    }

    // Mark mediaDeletedAt and clear URLs in database
    await prisma.generatedContent.update({
      where: { id: gc.id },
      data: {
        imageUrl: null,
        videoUrl: null,
        mediaDeletedAt: new Date(),
      },
    });

    cleanedJobsCount++;
    deletedFilesCount += filesDeletedForJob;
  }

  logger.info({ cleanedJobsCount, deletedFilesCount, retentionDays }, 'Media retention cleanup completed');
  return { cleanedJobsCount, deletedFilesCount };
}

export async function runCleanup(): Promise<void> {
  logger.info('Running background data cleanup tasks');
  
  // Run media retention cleanup
  const mediaResult = await runMediaCleanup();

  logger.info({ ...mediaResult }, 'Cleanup completed successfully');
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

  // LOW-03: If failed during publishing, directly retry publishing rather than re-running the full pipeline
  if (job.failureStage === PipelineStage.Publishing || job.failureStage === 'Publishing') {
    logger.info({ jobId }, 'Job failed during Publishing stage; retrying publish stage directly');
    try {
      await publishingService.publishJobContent(jobId);
      await jobRepository.transitionJobStage(jobId, PipelineStage.Completed, {});
    } catch (err: any) {
      await jobRepository.transitionJobStage(jobId, PipelineStage.Failed, {
        failedAt: new Date(),
        failureReason: err.message,
        failureStage: 'Publishing',
      });
      throw err;
    }
  } else {
    // Restore pipeline execution from failure stage
    await runContentPipeline(jobId);
  }
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
  runMediaCleanup,
  runRetryPublish,
  runTokenRefresh,
  runHealthCheck,
};

export default maintenanceService;
