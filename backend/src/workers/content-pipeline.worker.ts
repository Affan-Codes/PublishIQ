import { Worker, Job } from 'bullmq';
import { env } from '../config/env.js';
import { getRedisInstance } from '../database/redis.js';
import { logger } from '../utils/logger.js';
import { runContentPipeline } from '../services/content-pipeline.service.js';

const QUEUE_NAME = `${env.QUEUE_PREFIX}:content-pipeline`;
const connection = getRedisInstance();

export const contentPipelineProcessor = async (job: Job<{ jobId: string }>) => {
  logger.info({ jobId: job.data.jobId, bullJobId: job.id }, 'Processing Content Pipeline Job');
  
  await runContentPipeline(job.data.jobId, {
    onStageComplete: async (stage) => {
      await job.updateProgress({ stage });
      logger.info({ jobId: job.data.jobId, stage }, 'Content pipeline stage completed');
    },
  });
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
