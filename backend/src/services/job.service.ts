import { Job, JobType, PipelineStage, Prisma } from '@prisma/client';
import { jobRepository } from '../repositories/job.repository.js';
import { channelRepository } from '../repositories/channel.repository.js';
import { generatedContentRepository } from '../repositories/generatedContent.repository.js';
import { ValidationError, NotFoundError, ConflictError } from '../errors/custom-errors.js';
import { contentPipelineQueue } from '../jobs/index.js';
import { prisma } from '../database/db.js';
import { logger } from '../utils/logger.js';

export interface JobListFilters {
  jobType?: JobType;
  pipelineStage?: PipelineStage;
  channelId?: string;
  page?: number;
  limit?: number;
}

export const jobService = {
  async getJobById(id: string): Promise<any> {
    const job = await jobRepository.getById(id);
    if (!job) {
      throw new NotFoundError('Job not found');
    }
    return job;
  },

  async listJobs(
    workspaceId: string,
    filters: JobListFilters
  ): Promise<{ items: Job[]; total: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.JobWhereInput = {
      workspaceId,
    };

    if (filters.jobType) {
      where.jobType = filters.jobType;
    }
    if (filters.pipelineStage) {
      where.pipelineStage = filters.pipelineStage;
    }
    if (filters.channelId) {
      where.channelId = filters.channelId;
    }

    const [items, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          channel: true,
          contentProfile: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * Starts a new content pipeline job for a channel.
   * Can optionally start with duplicate content prefilled.
   */
  async createContentPipelineJob(
    workspaceId: string,
    channelId: string,
    sourceGeneratedContentId?: string
  ): Promise<Job> {
    const channel = await channelRepository.getById(channelId);
    if (!channel) {
      throw new NotFoundError('Channel not found');
    }

    const profile = channel.contentProfile;
    if (!profile) {
      throw new ValidationError('Channel does not have a content profile configured');
    }

    const configSnapshot = {
      promptVersionId: profile.promptVersionId,
      templateVersionId: profile.templateVersionId,
    };

    // Create the job record in Draft
    const dbJob = await jobRepository.createJob({
      workspaceId,
      jobType: JobType.ContentPipeline,
      channelId,
      contentProfileId: channel.contentProfileId,
      pipelineStage: PipelineStage.Draft,
      configSnapshot,
    });

    if (sourceGeneratedContentId) {
      const sourceContent = await generatedContentRepository.getById(sourceGeneratedContentId);
      if (!sourceContent) {
        throw new NotFoundError('Source generated content not found');
      }

      // Prefill generated text to skip generation stage
      await jobRepository.transitionJobStage(dbJob.id, PipelineStage.Draft, {
        generatedText: sourceContent.text,
        caption: sourceContent.caption || null,
        hashtags: sourceContent.hashtags || null,
      });
    }

    // Add to BullMQ queue
    await contentPipelineQueue.add(
      'content-pipeline-job',
      { jobId: dbJob.id },
      { jobId: dbJob.id }
    );

    logger.info({ jobId: dbJob.id, channelId }, 'Created and enqueued content pipeline job');
    return dbJob;
  },

  /**
   * Retries a failed job.
   */
  async retryJob(id: string, workspaceId: string): Promise<Job> {
    const job = await jobRepository.getById(id);
    if (!job) {
      throw new NotFoundError('Job not found');
    }

    if (job.pipelineStage !== PipelineStage.Failed) {
      throw new ConflictError('Only failed jobs can be retried');
    }

    const channel = await channelRepository.getById(job.channelId || '');
    if (!channel) {
      throw new NotFoundError('Channel associated with the job was not found');
    }

    const profile = channel.contentProfile;
    if (!profile) {
      throw new ValidationError('Channel content profile not found');
    }

    // Check config snapshot to determine if we can resume or if we must start fresh
    const snapshot = job.configSnapshot as Record<string, any> | null;
    const isSnapshotMatching =
      snapshot &&
      snapshot.promptVersionId === profile.promptVersionId &&
      snapshot.templateVersionId === profile.templateVersionId;

    if (isSnapshotMatching) {
      // Snapshot matches! We can resume from the last failed stage
      logger.info({ jobId: id }, 'Config snapshot matches channel profile. Resuming from last failed stage.');
      
      const failedStage = job.failureStage ? (job.failureStage as PipelineStage) : PipelineStage.GeneratingContent;
      
      // Update job to be in the last completed/progress stage instead of Failed
      await jobRepository.transitionJobStage(id, failedStage, {
        failedAt: null,
        failureReason: null,
        failureStage: null,
      });
    } else {
      // Snapshot mismatch! Reset the job and run from scratch
      logger.info({ jobId: id }, 'Config snapshot mismatch. Resetting job to Draft and running from scratch.');
      
      const configSnapshot = {
        promptVersionId: profile.promptVersionId,
        templateVersionId: profile.templateVersionId,
      };

      await jobRepository.transitionJobStage(id, PipelineStage.Draft, {
        generatedText: null,
        imageUrl: null,
        videoUrl: null,
        caption: null,
        hashtags: null,
        failedAt: null,
        failureReason: null,
        failureStage: null,
        configSnapshot,
      });
    }

    // Enqueue back into BullMQ
    await contentPipelineQueue.add(
      'content-pipeline-job',
      { jobId: id },
      { jobId: id }
    );

    return jobRepository.getById(id) as Promise<Job>;
  },

  /**
   * Cancels a job if it is waiting in the queue.
   */
  async cancelJob(id: string, workspaceId: string): Promise<Job> {
    const job = await jobRepository.getById(id);
    if (!job) {
      throw new NotFoundError('Job not found');
    }

    if (
      job.pipelineStage === PipelineStage.Completed ||
      job.pipelineStage === PipelineStage.Failed ||
      job.pipelineStage === PipelineStage.Archived
    ) {
      throw new ConflictError('Cannot cancel a job that is already completed, failed, or archived');
    }

    // Remove from BullMQ queue if present
    const bullJob = await contentPipelineQueue.getJob(id);
    if (bullJob) {
      await bullJob.remove();
      logger.info({ jobId: id }, 'Removed job from BullMQ queue');
    }

    // Mark as Archived in the database
    const updatedJob = await jobRepository.transitionJobStage(id, PipelineStage.Archived, {
      failureReason: 'Cancelled by operator',
      failedAt: new Date(),
    }, {
      type: 'JobFailed',
      payload: { jobId: id, message: 'Job cancelled by operator' },
    });

    return updatedJob;
  },

  /**
   * Approves a Hybrid job waiting at Queued stage, transitioning it to Completed.
   */
  async approveJob(id: string, workspaceId: string): Promise<Job> {
    const job = await jobRepository.getById(id);
    if (!job) {
      throw new NotFoundError('Job not found');
    }

    if (job.pipelineStage !== PipelineStage.Queued) {
      throw new ConflictError('Only jobs in Queued stage (pending approval) can be approved');
    }

    // Transition database Job to Completed
    const updatedJob = await jobRepository.transitionJobStage(id, PipelineStage.Completed, {
      failedAt: null,
      failureReason: null,
      failureStage: null,
    }, {
      type: 'JobCompleted',
      payload: { jobId: id, message: 'Content approved and job completed' },
    });

    // Mark the generated content status as Published to reflect successful completion
    await prisma.generatedContent.updateMany({
      where: { jobId: id, workspaceId },
      data: {
        publishStatus: 'Published',
      },
    });

    return updatedJob;
  },

  /**
   * Rejects a Hybrid job waiting at Queued stage, transitioning it to Failed.
   */
  async rejectJob(id: string, workspaceId: string): Promise<Job> {
    const job = await jobRepository.getById(id);
    if (!job) {
      throw new NotFoundError('Job not found');
    }

    if (job.pipelineStage !== PipelineStage.Queued) {
      throw new ConflictError('Only jobs in Queued stage can be rejected');
    }

    // Transition database Job to Failed
    const updatedJob = await jobRepository.transitionJobStage(id, PipelineStage.Failed, {
      failedAt: new Date(),
      failureReason: 'Rejected by operator',
      failureStage: PipelineStage.Queued.toString(),
    }, {
      type: 'JobFailed',
      payload: { jobId: id, stage: PipelineStage.Queued, message: 'Job rejected by operator' },
    });

    return updatedJob;
  }
};

export default jobService;
