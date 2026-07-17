import { Worker, Job } from 'bullmq';
import { env } from '../config/env.js';
import { getRedisInstance } from '../database/redis.js';
import { logger } from '../utils/logger.js';
import { runContentPipeline } from '../services/content-pipeline.service.js';
import { prisma } from '../database/db.js';
import { ValidationError, NotFoundError } from '../errors/custom-errors.js';

const QUEUE_NAME = `${env.QUEUE_PREFIX}:content-pipeline`;
const connection = getRedisInstance();

/**
 * Classifies whether an error is retryable (network/DB glitches) or non-retryable (validation failures).
 */
function isRetryableError(err: any): boolean {
  if (err instanceof ValidationError || err instanceof NotFoundError) {
    return false;
  }
  // If the error message indicates validation failed or duplicate content detected, do not retry
  if (err.message && (err.message.includes('Validation failed') || err.message.includes('Duplicate content'))) {
    return false;
  }
  return true;
}

export const contentPipelineProcessor = async (job: Job<{ jobId?: string; channelId?: string; isScheduled?: boolean }>) => {
  let dbJobId = job.data.jobId;

  // Handle scheduled Repeatable execution
  if (!dbJobId && job.data.channelId) {
    const channelId = job.data.channelId;
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: { contentProfile: true },
    });

    if (!channel) {
      logger.error({ channelId }, 'Channel not found during scheduled processor run');
      return;
    }

    if (channel.status === 'Disabled') {
      logger.info({ channelId }, 'Channel is disabled. Skipping scheduled execution.');
      return;
    }

    const profile = channel.contentProfile;
    if (!profile) {
      logger.error({ channelId }, 'Content Profile not found for channel during scheduled run');
      return;
    }

    // Create a database Job record in Draft stage for this scheduled trigger
    const newDbJob = await prisma.job.create({
      data: {
        workspaceId: channel.workspaceId,
        jobType: 'ContentPipeline',
        channelId: channel.id,
        contentProfileId: profile.id,
        pipelineStage: 'Draft',
        configSnapshot: {
          promptVersionId: profile.promptVersionId,
          templateVersionId: profile.templateVersionId,
        },
      },
    });

    dbJobId = newDbJob.id;
    logger.info({ channelId, jobId: dbJobId }, 'Created new database Job for scheduled execution');
  }

  if (!dbJobId) {
    throw new ValidationError('Job data must contain either jobId or channelId');
  }

  logger.info({ jobId: dbJobId, bullJobId: job.id }, 'Processing Content Pipeline Job');
  
  try {
    await runContentPipeline(dbJobId, {
      onStageComplete: async (stage) => {
        await job.updateProgress({ stage });
        logger.info({ jobId: dbJobId, stage }, 'Content pipeline stage completed');
      },
    });
  } catch (err: any) {
    if (isRetryableError(err)) {
      // Re-throw to trigger BullMQ's native retry backoff mechanism
      logger.warn({ jobId: dbJobId, bullJobId: job.id, err: err.message }, 'Retryable error encountered, re-throwing to BullMQ');
      throw err;
    } else {
      // Non-retryable error: We log and resolve the job successfully in BullMQ to avoid retrying
      logger.error({ jobId: dbJobId, bullJobId: job.id, err: err.message }, 'Non-retryable error encountered. Mark processed in BullMQ.');
      return;
    }
  }
};

export function startContentPipelineWorker(concurrency: number = 2): Worker {
  logger.info({ QUEUE_NAME, concurrency }, 'Starting Content Pipeline Worker');
  
  const worker = new Worker(QUEUE_NAME, contentPipelineProcessor, {
    connection: connection as any,
    concurrency,
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.data?.jobId, bullJobId: job?.id, err }, 'Content Pipeline Job failed');
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job?.data?.jobId, bullJobId: job?.id }, 'Content Pipeline Job completed');
  });

  return worker;
}
