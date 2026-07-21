import { Prisma, Job, JobType, PipelineStage, GeneratedContent, PublishStatus, DomainEvent, Notification, PublishingRecord, PublishRecordStatus } from '@prisma/client';
import { prisma } from '../database/db.js';
import { eventBus } from '../events/event-bus.js';

export type JobWithRelations = Prisma.JobGetPayload<{
  include: {
    channel: true;
    contentProfile: true;
  };
}>;

export const jobRepository = {
  db: prisma,

  async getById(id: string): Promise<JobWithRelations | null> {
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
    const postCommitCallbacks: (() => Promise<void>)[] = [];

    const job = await prisma.$transaction(async (tx) => {
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
          const notificationMessage = eventData.payload.message || `Job transitioned to ${stage}: ${updates.failureReason || ''}`;
          
          const notification = await tx.notification.create({
            data: {
              workspaceId: updatedJob.workspaceId,
              domainEventId: domainEvent.id,
              message: notificationMessage,
            },
          });

          postCommitCallbacks.push(async () => {
            await eventBus.emitDomainEvent('NotificationCreated', notification);
          });
        }

        postCommitCallbacks.push(async () => {
          await eventBus.emitDomainEvent(eventData.type, domainEvent);
        });
      }

      return updatedJob;
    });

    for (const cb of postCommitCallbacks) {
      await cb();
    }

    return job;
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

