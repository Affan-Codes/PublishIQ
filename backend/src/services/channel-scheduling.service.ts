import { channelRepository } from '../repositories/channel.repository.js';
import { jobRepository } from '../repositories/job.repository.js';
import { Job, JobType, PipelineStage } from '@prisma/client';
import { ValidationError, NotFoundError } from '../errors/custom-errors.js';
import { logger } from '../utils/logger.js';

export const channelSchedulingService = {
  /**
   * Evaluates active scheduling channels and inserts a content pipeline job in Draft state.
   */
  async createScheduledJob(channelId: string): Promise<string | null> {
    const channel = await channelRepository.getById(channelId);
    if (!channel) {
      logger.error({ channelId }, 'Channel not found during scheduled processor run');
      return null;
    }

    if (channel.status === 'Disabled') {
      logger.info({ channelId }, 'Channel is disabled. Skipping scheduled execution.');
      return null;
    }

    const profile = channel.contentProfile;
    if (!profile) {
      logger.error({ channelId }, 'Content Profile not found for channel during scheduled run');
      return null;
    }

    // Create a database Job record in Draft stage for this scheduled trigger
    const newDbJob = await jobRepository.createJob({
      workspaceId: channel.workspaceId,
      jobType: JobType.ContentPipeline,
      channelId: channel.id,
      contentProfileId: profile.id,
      pipelineStage: PipelineStage.Draft,
      configSnapshot: {
        promptVersionId: profile.promptVersionId,
        templateVersionId: profile.templateVersionId,
      },
    });

    return newDbJob.id;
  }
};

export default channelSchedulingService;
