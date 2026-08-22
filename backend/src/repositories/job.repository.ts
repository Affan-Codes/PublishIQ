import { Prisma, Job, JobType, PipelineStage, GeneratedContent, PublishStatus, DomainEvent, Notification, PublishingRecord, PublishRecordStatus, Platform } from '@prisma/client';
import { prisma } from '../database/db.js';
import { broadcastDomainEvent, localEventBus } from '../events/event-bus.js';
import { logger } from '../utils/logger.js';

export type JobWithRelations = Prisma.JobGetPayload<{
  include: {
    channel: true;
    contentProfile: true;
  };
}>;

export const jobRepository = {
  db: prisma,

  async getById(id: string, workspaceId?: string): Promise<JobWithRelations | null> {
    if (workspaceId) {
      return prisma.job.findFirst({
        where: { id, workspaceId },
        include: {
          channel: true,
          contentProfile: true,
        },
      });
    }
    return prisma.job.findUnique({
      where: { id },
      include: {
        channel: true,
        contentProfile: true,
      },
    });
  },

  async getPromptVersionById(id: string) {
    return prisma.promptVersion.findUnique({
      where: { id },
    });
  },

  async findByBullJobId(bullJobId: string): Promise<JobWithRelations | null> {
    return prisma.job.findFirst({
      where: {
        configSnapshot: {
          path: ['bullJobId'],
          equals: bullJobId,
        },
      },
      include: {
        channel: true,
        contentProfile: true,
      },
    });
  },

  async getChannelPlatformConnections(channelId: string) {
    return prisma.channelPlatformConnection.findMany({
      where: { channelId },
      include: { platformConnection: true },
    });
  },

  async createPublishingRecord(data: {
    workspaceId: string;
    jobId: string;
    channelId: string;
    platformConnectionId: string;
    contentTypeSnapshot: string;
    status: PublishRecordStatus;
    platform: Platform;
    platformResponse?: any;
    publishedAt: Date;
  }): Promise<PublishingRecord> {
    return prisma.publishingRecord.create({
      data: {
        workspaceId: data.workspaceId,
        jobId: data.jobId,
        channelId: data.channelId,
        platformConnectionId: data.platformConnectionId,
        contentTypeSnapshot: data.contentTypeSnapshot,
        status: data.status,
        platform: data.platform,
        platformResponse: data.platformResponse || undefined,
        publishedAt: data.publishedAt,
      },
    });
  },

  async createJob(data: {
    workspaceId: string;
    jobType: JobType;
    channelId?: string;
    contentProfileId?: string;
    pipelineStage?: PipelineStage;
    configSnapshot?: any;
    generatedText?: string | null;
    imageUrl?: string | null;
    videoUrl?: string | null;
    caption?: string | null;
    hashtags?: any;
  }): Promise<Job> {
    return prisma.job.create({
      data: {
        workspaceId: data.workspaceId,
        jobType: data.jobType,
        channelId: data.channelId ?? null,
        contentProfileId: data.contentProfileId ?? null,
        pipelineStage: data.pipelineStage ?? null,
        configSnapshot: data.configSnapshot ?? null,
        generatedText: data.generatedText ?? null,
        imageUrl: data.imageUrl ?? null,
        videoUrl: data.videoUrl ?? null,
        caption: data.caption ?? null,
        hashtags: data.hashtags ?? null,
      },
    });
  },

  /**
   * Updates the job stage, saves outputs/errors, and writes a domain event inside a transaction.
   * Runs notification events post-commit.
   */
  async transitionJobStage(
    jobId: string,
    stage: PipelineStage,
    updates: Partial<Omit<Job, 'id' | 'createdAt' | 'updatedAt'>>,
    eventData?: { type: string; payload: any }
  ): Promise<Job> {
    let retries = 3;
    let lastErr: any;
    let committedJob: Job | null = null;
    const postCommitCallbacks: (() => Promise<void>)[] = [];

    while (retries > 0) {
      postCommitCallbacks.length = 0; // Clear any callbacks from previous failed attempt

      try {
        committedJob = await prisma.$transaction(
          async (tx) => {
            const dataUpdate: Record<string, any> = {};
            for (const [key, val] of Object.entries(updates)) {
              if (val !== undefined) {
                dataUpdate[key] = val;
              }
            }
            dataUpdate.pipelineStage = stage;

            const updatedJob = await tx.job.update({
              where: { id: jobId },
              data: dataUpdate,
            });

            if (eventData) {
              const domainEvent = await tx.domainEvent.create({
                data: {
                  workspaceId: updatedJob.workspaceId,
                  jobId: updatedJob.id,
                  type: eventData.type,
                  payload: eventData.payload,
                },
              });

              const notifyWorthy = ['PublishFailed', 'JobFailed', 'TokenExpiring', 'ApprovalRequired'].includes(eventData.type) 
                || stage === PipelineStage.Failed;
                
              if (notifyWorthy) {
                const notificationMessage = eventData.payload?.message || `Job transitioned to ${stage}: ${updates.failureReason || ''}`;
                
                const notification = await tx.notification.create({
                  data: {
                    workspaceId: updatedJob.workspaceId,
                    domainEventId: domainEvent.id,
                    message: notificationMessage,
                  },
                });

                postCommitCallbacks.push(async () => {
                  localEventBus.emit('NotificationCreated', notification);
                });
              }

              // HIGH-01 & HIGH-02: Broadcast the already-persisted domainEvent without inserting a duplicate DB row
              postCommitCallbacks.push(async () => {
                await broadcastDomainEvent(domainEvent);
              });
            }

            return updatedJob;
          },
          {
            maxWait: 15000, // 15 seconds to acquire connection from pool
            timeout: 30000, // 30 seconds max transaction execution duration
          }
        );

        break; // Transaction successfully committed
      } catch (err: any) {
        lastErr = err;
        retries--;
        if (retries > 0) {
          logger.warn({ jobId, stage, err: err.message, remainingRetries: retries }, 'Database transaction lock acquisition failed, retrying transitionJobStage...');
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    if (!committedJob) {
      throw lastErr;
    }

    // Execute post-commit callbacks outside transaction loop; handle errors gracefully so they don't break the committed job
    for (const cb of postCommitCallbacks) {
      try {
        await cb();
      } catch (cbErr: any) {
        logger.error({ jobId, stage, err: cbErr }, 'Error executing post-commit callback in transitionJobStage');
      }
    }

    return committedJob;
  },

  async saveGeneratedContent(data: {
    workspaceId: string;
    jobId: string;
    contentProfileId: string;
    promptVersionId: string;
    templateVersionId: string;
    language: any;
    contentTypeId: string;
    text: string;
    blocks?: any;
    textHash?: string | null;
    imageUrl?: string | null;
    videoUrl?: string | null;
    caption?: string | null;
    hashtags?: any;
    publishStatus: PublishStatus;
  }): Promise<GeneratedContent> {
    return prisma.generatedContent.create({
      data: {
        workspaceId: data.workspaceId,
        jobId: data.jobId,
        contentProfileId: data.contentProfileId,
        promptVersionId: data.promptVersionId,
        templateVersionId: data.templateVersionId,
        language: data.language,
        contentTypeId: data.contentTypeId,
        text: data.text,
        blocks: data.blocks ?? undefined,
        textHash: data.textHash ?? null,
        imageUrl: data.imageUrl ?? null,
        videoUrl: data.videoUrl ?? null,
        caption: data.caption ?? null,
        hashtags: data.hashtags ?? null,
        publishStatus: data.publishStatus,
      },
    });
  },

  async getJobGroupingsByWorkspace(workspaceId: string) {
    return prisma.job.groupBy({
      by: ['jobType', 'pipelineStage'],
      where: { workspaceId },
      _count: {
        id: true,
      },
    });
  },

  async getJobForPublishing(id: string) {
    return prisma.job.findUnique({
      where: { id },
      include: {
        channel: {
          include: {
            contentProfile: {
              include: {
                contentType: true
              }
            },
            platformConnections: {
              include: {
                platformConnection: true
              }
            }
          }
        }
      }
    });
  },

  async list(
    workspaceId: string,
    filters: {
      jobType?: JobType;
      pipelineStage?: PipelineStage;
      channelId?: string;
      page?: number;
      limit?: number;
    }
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
};

export default jobRepository;

