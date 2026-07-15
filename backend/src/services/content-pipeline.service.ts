import { PipelineStage, PublishStatus } from '@prisma/client';
import { jobRepository } from '../repositories/job.repository.js';
import { geminiProvider } from '../providers/ai/gemini.provider.js';
import { localDiskStorageProvider } from '../providers/storage/local-disk.provider.js';
import { youtubeAdapter } from '../providers/publishing/youtube.provider.js';
import { instagramAdapter } from '../providers/publishing/instagram.provider.js';
import { logger } from '../utils/logger.js';
import { ValidationError, ExternalProviderError } from '../errors/custom-errors.js';

export interface PipelineOptions {
  onStageComplete?: (stage: PipelineStage) => Promise<void>;
}

async function processStage(jobId: string, stage: PipelineStage): Promise<void> {
  const job = await jobRepository.getById(jobId);
  if (!job) throw new Error('Job not found inside processStage');

  switch (stage) {
    case PipelineStage.GeneratingContent: {
      let generatedText = '';
      try {
        if (job.contentProfile?.promptVersionId) {
          const promptVersion = await jobRepository.getPromptVersionById(job.contentProfile.promptVersionId);
          if (promptVersion) {
            const aiResponse = await geminiProvider.generate(
              { body: promptVersion.body, versionNumber: promptVersion.versionNumber },
              (job.contentProfile.promptVariables as Record<string, unknown>) || {}
            );
            generatedText = aiResponse.text;
          }
        }
      } catch (error) {
        logger.warn({ jobId, error }, 'AI generation failed, using fallback content for testing');
      }

      if (!generatedText) {
        generatedText = 'Simplicity is the ultimate sophistication. - Leonardo da Vinci';
      }

      await jobRepository.transitionJobStage(jobId, stage, {
        generatedText,
      }, {
        type: 'ContentGenerated',
        payload: { jobId, text: generatedText },
      });
      break;
    }

    case PipelineStage.Validating: {
      const text = job.generatedText || '';
      if (!text || text.trim() === '') {
        throw new ValidationError('Validation failed: Empty output generated.');
      }
      if (text.length > 500) {
        throw new ValidationError('Validation failed: Length exceeds maximum limit.');
      }

      if (text.toLowerCase().includes('profanity')) {
        throw new ValidationError('Validation failed: Content contains prohibited terms.');
      }

      const hashCount = await jobRepository.getDuplicateHashCount(text.trim());
      if (hashCount > 0) {
        throw new ValidationError('Validation failed: Duplicate content detected.');
      }

      break;
    }

    case PipelineStage.GeneratingImage: {
      const mockPngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      const relativeImagePath = `images/${jobId}_render.png`;
      const imagePath = await localDiskStorageProvider.save(mockPngBuffer, relativeImagePath);

      await jobRepository.transitionJobStage(jobId, stage, {
        imageUrl: imagePath,
      }, {
        type: 'ImageGenerated',
        payload: { jobId, imageUrl: imagePath },
      });
      break;
    }

    case PipelineStage.GeneratingVideo: {
      const mockMp4Buffer = Buffer.from('MOCK_MP4_VIDEO_STREAM');
      const relativeVideoPath = `videos/${jobId}_render.mp4`;
      const videoPath = await localDiskStorageProvider.save(mockMp4Buffer, relativeVideoPath);

      await jobRepository.transitionJobStage(jobId, stage, {
        videoUrl: videoPath,
      }, {
        type: 'VideoGenerated',
        payload: { jobId, videoUrl: videoPath },
      });
      break;
    }

    case PipelineStage.SelectingMusic: {
      break;
    }

    case PipelineStage.GeneratingCaption: {
      const text = job.generatedText || '';
      const caption = `💡 Daily Wisdom:\n\n"${text}"\n\nFollow for more!`;
      await jobRepository.transitionJobStage(jobId, stage, {
        caption,
      });
      break;
    }

    case PipelineStage.GeneratingHashtags: {
      const hashtags = ['wisdom', 'quotes', 'daily', 'motivation'];
      await jobRepository.transitionJobStage(jobId, stage, {
        hashtags,
      });
      break;
    }

    case PipelineStage.Queued: {
      break;
    }

    case PipelineStage.Publishing: {
      const connections = await jobRepository.getChannelPlatformConnections(job.channelId || '');

      if (connections.length === 0) {
        logger.warn({ jobId }, 'No platform connections configured for publishing. Skipping external publish.');
        break;
      }

      for (const conn of connections) {
        const adapter = conn.platformConnection.platform === 'YouTube' 
          ? youtubeAdapter 
          : instagramAdapter;

        const contentData = {
          text: job.generatedText || '',
          imageUrl: job.imageUrl,
          videoUrl: job.videoUrl,
          caption: job.caption,
          hashtags: job.hashtags,
        };

        const violations = adapter.validate(contentData);
        if (violations.length > 0) {
          throw new ValidationError(
            `Platform limit violations on ${adapter.platform}: ${violations.map((v) => v.message).join(', ')}`
          );
        }

        const result = await adapter.publish(contentData, {
          accessTokenEnc: conn.platformConnection.accessTokenEnc,
          refreshTokenEnc: conn.platformConnection.refreshTokenEnc,
          expiresAt: conn.platformConnection.expiresAt,
        });

        if (!result.success) {
          throw new ExternalProviderError(adapter.platform, result.errorMessage || 'Publishing failed');
        }

        await jobRepository.createPublishingRecord({
          workspaceId: job.workspaceId,
          jobId: job.id,
          channelId: job.channelId || '',
          platformConnectionId: conn.platformConnectionId,
          contentTypeSnapshot: job.contentProfile?.contentTypeId || 'unknown',
          status: 'Success',
          platformResponse: result.platformResponse || {},
          publishedAt: new Date(),
        });
      }

      await jobRepository.saveGeneratedContent({
        workspaceId: job.workspaceId,
        jobId: job.id,
        contentProfileId: job.contentProfileId || '',
        promptVersionId: job.contentProfile?.promptVersionId || '',
        templateVersionId: job.contentProfile?.templateVersionId || '',
        language: job.contentProfile?.language || 'English',
        contentTypeId: job.contentProfile?.contentTypeId || '',
        text: job.generatedText || '',
        imageUrl: job.imageUrl,
        videoUrl: job.videoUrl,
        caption: job.caption,
        hashtags: job.hashtags,
        publishStatus: PublishStatus.Published,
      });

      break;
    }

    default:
      break;
  }
}

export async function runContentPipeline(jobId: string, options?: PipelineOptions): Promise<void> {
  const job = await jobRepository.getById(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  logger.info({ jobId }, 'Starting content pipeline execution');

  const stages: PipelineStage[] = [
    PipelineStage.GeneratingContent,
    PipelineStage.Validating,
    PipelineStage.GeneratingImage,
    PipelineStage.GeneratingVideo,
    PipelineStage.SelectingMusic,
    PipelineStage.GeneratingCaption,
    PipelineStage.GeneratingHashtags,
    PipelineStage.Queued,
    PipelineStage.Publishing,
  ];

  let startIndex = 0;
  if (job.pipelineStage && job.pipelineStage !== PipelineStage.Draft) {
    const lastStageIndex = stages.indexOf(job.pipelineStage);
    if (lastStageIndex !== -1) {
      startIndex = lastStageIndex;
      logger.info({ jobId, resumeStage: job.pipelineStage }, 'Resuming job pipeline from last stage');
    }
  }

  try {
    for (let i = startIndex; i < stages.length; i++) {
      const stage = stages[i]!;

      await jobRepository.transitionJobStage(job.id, stage, {}, {
        type: `${stage}Started`,
        payload: { jobId: job.id, message: `Pipeline stage ${stage} started` },
      });

      await processStage(job.id, stage);

      if (options?.onStageComplete) {
        await options.onStageComplete(stage);
      }
    }

    await jobRepository.transitionJobStage(job.id, PipelineStage.Published, {
      failedAt: null,
      failureReason: null,
      failureStage: null,
    }, {
      type: 'PublishSucceeded',
      payload: { jobId: job.id, message: 'Content published successfully' },
    });

    logger.info({ jobId }, 'Content pipeline execution completed successfully');
  } catch (err: any) {
    const failedStage = job.pipelineStage || PipelineStage.GeneratingContent;
    logger.error({ jobId, stage: failedStage, err }, 'Content pipeline stage failed');

    const failureReason = err.message || 'Unknown error occurred during pipeline execution';
    const retryCount = (job.retryCount || 0) + 1;

    await jobRepository.transitionJobStage(job.id, PipelineStage.Failed, {
      failedAt: new Date(),
      failureReason,
      failureStage: failedStage.toString(),
      retryCount,
    }, {
      type: 'PublishFailed',
      payload: {
        jobId: job.id,
        stage: failedStage,
        message: `Publish failed at stage ${failedStage}: ${failureReason}`,
        retryCount,
      },
    });
  }
}
