import { GeneratedContent, PublishStatus, JobType, PipelineStage } from '@prisma/client';
import { generatedContentRepository, GeneratedContentFilters } from '../repositories/generatedContent.repository.js';
import { jobRepository } from '../repositories/job.repository.js';
import { channelRepository } from '../repositories/channel.repository.js';
import { ValidationError, NotFoundError, ConflictError } from '../errors/custom-errors.js';
import { contentPipelineQueue } from '../jobs/index.js';
import { logger } from '../utils/logger.js';

export const generatedContentService = {
  async listGeneratedContent(
    workspaceId: string,
    filters: GeneratedContentFilters
  ): Promise<{ items: GeneratedContent[]; total: number }> {
    return generatedContentRepository.list(workspaceId, filters);
  },

  async getGeneratedContentById(id: string): Promise<GeneratedContent> {
    const content = await generatedContentRepository.getById(id);
    if (!content) {
      throw new NotFoundError('Generated Content not found');
    }
    return content;
  },

  async deleteGeneratedContent(id: string): Promise<void> {
    const content = await generatedContentRepository.getById(id);
    if (!content) {
      throw new NotFoundError('Generated Content not found');
    }

    // Block deletion if already published
    if (content.publishStatus === PublishStatus.Published) {
      throw new ConflictError('Cannot delete generated content that has already been published to a live platform.');
    }

    await generatedContentRepository.delete(id);
    logger.info({ contentId: id }, 'Deleted generated content record');
  },

  /**
   * Duplicates an existing piece of generated content into a new Content Pipeline Job.
   * Reuses the generated text to skip AI text generation but triggers validation and rendering stages.
   */
  async duplicateGeneratedContent(
    id: string,
    workspaceId: string,
    channelId: string
  ): Promise<any> {
    const content = await generatedContentRepository.getById(id);
    if (!content) {
      throw new NotFoundError('Source generated content not found');
    }

    const channel = await channelRepository.getById(channelId);
    if (!channel) {
      throw new NotFoundError('Target channel not found');
    }

    // Verify channel has content profile
    const profileId = channel.contentProfileId;
    const profile = channel.contentProfile;
    if (!profile) {
      throw new ValidationError('Channel does not have a content profile configured');
    }

    // Create the pipeline job in Draft state, prefilled with the source text
    const configSnapshot = {
      promptVersionId: profile.promptVersionId,
      templateVersionId: profile.templateVersionId,
    };

    const dbJob = await jobRepository.createJob({
      workspaceId,
      jobType: JobType.ContentPipeline,
      channelId,
      contentProfileId: profileId,
      pipelineStage: PipelineStage.Draft,
      configSnapshot,
    });

    // Save the prefilled text directly onto the Job record so that AI generation is skipped
    await jobRepository.transitionJobStage(dbJob.id, PipelineStage.Draft, {
      generatedText: content.text,
      caption: content.caption || null,
      hashtags: content.hashtags || null,
    });

    // Enqueue the job in BullMQ
    await contentPipelineQueue.add(
      'content-pipeline-job',
      { jobId: dbJob.id },
      { jobId: dbJob.id } // Use database Job ID as the BullMQ job ID for easy lookups/cancelling
    );

    logger.info({ jobId: dbJob.id, sourceContentId: id }, 'Duplicated generated content into a new job');

    return dbJob;
  },

  /**
   * Triggers fresh content generation based on the same Content Profile and settings
   * as the source content, creating a brand new job and resulting content.
   */
  async regenerateContent(id: string, workspaceId: string, channelId: string): Promise<any> {
    const content = await generatedContentRepository.getById(id);
    if (!content) {
      throw new NotFoundError('Source generated content not found');
    }

    const channel = await channelRepository.getById(channelId);
    if (!channel) {
      throw new NotFoundError('Target channel not found');
    }

    const profile = channel.contentProfile;
    if (!profile) {
      throw new ValidationError('Channel does not have a content profile configured');
    }

    // Create a brand new Job in Draft state (without prefilled text) to run AI generation fresh
    const configSnapshot = {
      promptVersionId: profile.promptVersionId,
      templateVersionId: profile.templateVersionId,
    };

    const dbJob = await jobRepository.createJob({
      workspaceId,
      jobType: JobType.ContentPipeline,
      channelId,
      contentProfileId: channel.contentProfileId,
      pipelineStage: PipelineStage.Draft,
      configSnapshot,
    });

    // Enqueue in BullMQ
    await contentPipelineQueue.add(
      'content-pipeline-job',
      { jobId: dbJob.id },
      { jobId: dbJob.id }
    );

    logger.info({ jobId: dbJob.id, sourceContentId: id }, 'Initiated fresh regeneration of content');

    return dbJob;
  }
};

export default generatedContentService;
