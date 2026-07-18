import { PipelineStage, PublishStatus, Job, Asset } from '@prisma/client';
import { jobRepository } from '../repositories/job.repository.js';
import { geminiProvider } from '../providers/ai/gemini.provider.js';
import { renderingService } from './rendering.service.js';
import { videoService } from './video.service.js';
import { publishingService } from './publishing.service.js';
import { systemConfigCache } from '../config/system-config.cache.js';
import { getNormalizedHash } from '../utils/normalization.js';
import { logger } from '../utils/logger.js';
import { ValidationError, NotFoundError, ExternalProviderError } from '../errors/custom-errors.js';
import { prisma } from '../database/db.js';

export interface PipelineOptions {
  onStageComplete?: (stage: PipelineStage) => Promise<void>;
}

/**
 * Orchestrates a single stage in the content pipeline.
 */
async function processStage(jobId: string, stage: PipelineStage): Promise<void> {
  const job = await jobRepository.getById(jobId);
  if (!job) {
    throw new NotFoundError(`Job not found: ${jobId}`);
  }

  logger.info({ jobId, stage }, 'Processing pipeline stage');

  switch (stage) {
    case PipelineStage.GeneratingContent: {
      const profile = job.contentProfile;
      if (!profile) {
        throw new ValidationError('Job is missing a Content Profile snapshot.');
      }

      const promptVersion = await prisma.promptVersion.findUnique({
        where: { id: profile.promptVersionId }
      });
      const contentType = await prisma.contentType.findUnique({
        where: { id: profile.contentTypeId }
      });

      if (!promptVersion) {
        throw new ValidationError(`Prompt version not found: ${profile.promptVersionId}`);
      }

      // Generate content via Gemini AI provider
      const variables = profile.promptVariables as Record<string, any> || {};
      const aiResponse = await geminiProvider.generate(
        {
          body: promptVersion.body,
          versionNumber: promptVersion.versionNumber,
        },
        {
          contentType: contentType?.name || '',
          language: profile.language,
          tone: profile.tone,
          style: profile.writingStyle,
          ...variables,
        }
      );

      // Store generated text in job record
      await jobRepository.transitionJobStage(jobId, stage, {
        generatedText: aiResponse.text,
        caption: aiResponse.metadata?.caption || '',
        hashtags: aiResponse.metadata?.hashtags || [],
      });
      break;
    }

    case PipelineStage.Validating: {
      const text = job.generatedText || '';

      // Check empty
      if (!text.trim()) {
        throw new ValidationError('Generated text content is empty.');
      }

      // Profanity filtering check
      const profanityList = ['swearword1', 'swearword2']; // basic profanity stub
      const containsProfanity = profanityList.some((word) => text.toLowerCase().includes(word));
      if (containsProfanity) {
        throw new ValidationError('Generated text contains filtered profanity words.');
      }

      // Normalized Hash duplicate check
      const normalizedHash = getNormalizedHash(text);
      const duplicateContent = await prisma.generatedContent.findFirst({
        where: {
          textHash: normalizedHash,
          workspaceId: job.workspaceId,
        },
      });

      if (duplicateContent) {
        throw new ValidationError(`Duplicate content detected. Hash match: ${normalizedHash}`);
      }

      await jobRepository.transitionJobStage(jobId, stage, {});
      break;
    }

    case PipelineStage.RenderingImage: {
      const text = job.generatedText || '';
      const profile = job.contentProfile;
      if (!profile) {
        throw new ValidationError('Job is missing a Content Profile snapshot.');
      }

      // Render vertical PNG via Playwright
      const imageUrl = await renderingService.renderImage(jobId, text, {
        language: profile.language,
        branding: (profile.renderingConfiguration as any)?.branding || 'PUBLISHIQ',
        watermark: (profile.renderingConfiguration as any)?.watermark || '@publishiq',
      });

      await jobRepository.transitionJobStage(jobId, stage, {
        imageUrl,
      }, {
        type: 'ImageGenerated',
        payload: { jobId, imageUrl },
      });
      break;
    }

    case PipelineStage.AttachingMusic: {
      const profile = job.contentProfile;
      if (!profile) {
        throw new ValidationError('Job is missing a Content Profile snapshot.');
      }

      const selectionRules = profile.musicSelectionRules as Record<string, any> || {};
      const mood = selectionRules.mood || 'Inspiring';
      const genre = selectionRules.genre || 'Acoustic';

      // Load matching music assets from the database
      const matchedAssets = await prisma.asset.findMany({
        where: {
          workspaceId: job.workspaceId,
          type: 'Music',
          status: 'Active',
          licenseStatus: 'Confirmed',
          metadata: {
            path: ['mood'],
            equals: mood,
          },
        },
      });

      // Fallback to any active licensed track if no direct matches found to avoid pipeline block,
      // but if we want strict enforcement, throw a validation error.
      if (matchedAssets.length === 0) {
        throw new ValidationError(`No music track matches profile selection rules: ${JSON.stringify(selectionRules)}`);
      }

      // Pick the first matched asset
      const selectedAsset = matchedAssets[0]!;
      logger.info({ jobId, assetId: selectedAsset.id }, 'Music track selected successfully');

      // Store the selected music asset file path in configSnapshot (since no direct music column exists)
      const updatedSnapshot = {
        ...(job.configSnapshot as Record<string, any> || {}),
        selectedMusicAssetId: selectedAsset.id,
        selectedMusicFilePath: selectedAsset.filePath,
      };

      await jobRepository.transitionJobStage(jobId, stage, {
        configSnapshot: updatedSnapshot,
      });
      break;
    }

    case PipelineStage.RenderingVideo: {
      if (!job.imageUrl) {
        throw new ValidationError('Image URL is missing before video generation.');
      }

      // Load selected music file path from the configSnapshot
      const snapshot = job.configSnapshot as Record<string, any> || {};
      const musicFilePath = snapshot.selectedMusicFilePath;
      if (!musicFilePath) {
        throw new ValidationError('No music track was selected or stored in the snapshot.');
      }

      // Load duration from system configurations
      const durationVal = await systemConfigCache.get<number>('default_video_duration_seconds');
      const duration = typeof durationVal === 'number' ? durationVal : 15;

      // Render the video using FFmpeg
      const videoUrl = await videoService.renderVideo(jobId, job.imageUrl, musicFilePath, duration);

      await jobRepository.transitionJobStage(jobId, stage, {
        videoUrl,
      }, {
        type: 'VideoGenerated',
        payload: { jobId, videoUrl },
      });
      break;
    }

    case PipelineStage.GeneratingCaption: {
      if (!job.caption) {
        const text = job.generatedText || '';
        const fallbackCaption = `💡 Daily Wisdom:\n\n"${text}"\n\nFollow for more!`;
        await jobRepository.transitionJobStage(jobId, stage, {
          caption: fallbackCaption,
        });
      } else {
        await jobRepository.transitionJobStage(jobId, stage, {});
      }
      break;
    }

    case PipelineStage.GeneratingHashtags: {
      if (!job.hashtags) {
        const fallbackHashtags = ['wisdom', 'quotes', 'daily', 'motivation'];
        await jobRepository.transitionJobStage(jobId, stage, {
          hashtags: fallbackHashtags,
        });
      } else {
        await jobRepository.transitionJobStage(jobId, stage, {});
      }
      break;
    }

    case PipelineStage.Publishing: {
      // Trigger the publishing service orchestration
      await publishingService.publishJobContent(jobId);
      break;
    }

    default:
      break;
  }
}

/**
 * Runs the content pipeline stages for a Job.
 */
export async function runContentPipeline(jobId: string, options?: PipelineOptions): Promise<void> {
  let job: any = await jobRepository.getById(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  logger.info({ jobId }, 'Starting content pipeline execution');

  // Generation stages sequence
  const generationStages: PipelineStage[] = [
    PipelineStage.GeneratingContent,
    PipelineStage.Validating,
    PipelineStage.RenderingImage,
    PipelineStage.AttachingMusic,
    PipelineStage.RenderingVideo,
    PipelineStage.GeneratingCaption,
    PipelineStage.GeneratingHashtags,
  ];

  // Set the job to Running stage initially if starting from fresh
  if (!job.pipelineStage || job.pipelineStage === PipelineStage.Draft) {
    job = await jobRepository.transitionJobStage(job.id, PipelineStage.Running, {}, {
      type: 'JobRunning',
      payload: { jobId: job.id, message: 'Content pipeline execution started' },
    });
  }

  let startIndex = 0;
  if (
    job.pipelineStage &&
    job.pipelineStage !== PipelineStage.Running &&
    job.pipelineStage !== PipelineStage.Draft &&
    job.pipelineStage !== PipelineStage.Publishing
  ) {
    const lastStageIndex = generationStages.indexOf(job.pipelineStage);
    if (lastStageIndex !== -1) {
      startIndex = lastStageIndex;
      logger.info({ jobId, resumeStage: job.pipelineStage }, 'Resuming job pipeline from last stage');
    }
  }

  try {
    // 1. Run Generation & Media Rendering Phase
    if (job.pipelineStage !== PipelineStage.Publishing && job.pipelineStage !== PipelineStage.Completed) {
      for (let i = startIndex; i < generationStages.length; i++) {
        const stage = generationStages[i]!;

        job = await jobRepository.transitionJobStage(job.id, stage, {}, {
          type: `${stage}Started`,
          payload: { jobId: job.id, message: `Pipeline stage ${stage} started` },
        });

        if (stage === PipelineStage.GeneratingContent) {
          let attempts = 0;
          const maxDuplicateRetriesVal = await systemConfigCache.get<number>('retry_limit.duplicate_regeneration');
          const maxDuplicateRetries = typeof maxDuplicateRetriesVal === 'number' ? maxDuplicateRetriesVal : 5;

          while (true) {
            try {
              await processStage(job.id, PipelineStage.GeneratingContent);
              await processStage(job.id, PipelineStage.Validating);
              i++; // skip validating stage execution in the next outer iteration
              break;
            } catch (err: any) {
              if (err instanceof ValidationError && err.message.includes('Duplicate content detected')) {
                attempts++;
                if (attempts >= maxDuplicateRetries) {
                  throw new ValidationError(
                    `Validation failed: Duplicate content detected. Automatically regenerated ${attempts} times but could not produce unique content.`
                  );
                }
                logger.warn({ jobId, attempts }, 'Duplicate content detected. Triggering automatic regeneration...');
                
                await jobRepository.transitionJobStage(job.id, PipelineStage.Draft, {
                  generatedText: null,
                  caption: null,
                  hashtags: null,
                });
                continue;
              }
              throw err;
            }
          }
        } else {
          await processStage(job.id, stage);
        }

        if (options?.onStageComplete) {
          await options.onStageComplete(stage);
        }
      }

      // Save/persist the generated content preview
      const finalizedJob = await jobRepository.getById(job.id);
      if (!finalizedJob) throw new Error('Job not found after pipeline execution');

      let genContent = await prisma.generatedContent.findFirst({
        where: { jobId: finalizedJob.id }
      });

      if (!genContent) {
        genContent = await jobRepository.saveGeneratedContent({
          workspaceId: finalizedJob.workspaceId,
          jobId: finalizedJob.id,
          contentProfileId: finalizedJob.contentProfileId || '',
          promptVersionId: finalizedJob.contentProfile?.promptVersionId || '',
          templateVersionId: finalizedJob.contentProfile?.templateVersionId || '',
          language: finalizedJob.contentProfile?.language || 'English',
          contentTypeId: finalizedJob.contentProfile?.contentTypeId || '',
          text: finalizedJob.generatedText || '',
          imageUrl: finalizedJob.imageUrl,
          videoUrl: finalizedJob.videoUrl,
          caption: finalizedJob.caption,
          hashtags: finalizedJob.hashtags,
          publishStatus: PublishStatus.Unpublished,
        });

        // Save normalized hash for duplicate checks
        const normalizedHash = getNormalizedHash(finalizedJob.generatedText || '');
        await prisma.generatedContent.update({
          where: { id: genContent.id },
          data: { textHash: normalizedHash }
        });
      }
    }

    // 2. Check Hold Condition (Manual / Hybrid)
    const finalizedJob = await jobRepository.getById(job.id);
    if (!finalizedJob) throw new Error('Job not found');

    const channel = finalizedJob.channelId ? await prisma.channel.findUnique({
      where: { id: finalizedJob.channelId },
    }) : null;

    const automationMode = channel?.automationMode || 'Manual';
    const snapshot = finalizedJob.configSnapshot as Record<string, any> || {};
    const isApproved = snapshot.isApproved === true;

    if ((automationMode === 'Hybrid' || automationMode === 'Manual') && !isApproved) {
      await jobRepository.transitionJobStage(job.id, PipelineStage.Queued, {
        failedAt: null,
        failureReason: null,
        failureStage: null,
      }, {
        type: 'ApprovalRequired',
        payload: { jobId: job.id, message: `Content generated. Waiting for operator ${automationMode === 'Hybrid' ? 'approval' : 'manual publish'}.` },
      });
      logger.info({ jobId: job.id, automationMode }, 'Pipeline held at Queued stage pending approval');
      return; // Stop worker execution here
    }

    // 3. Run Publishing Phase
    job = await jobRepository.transitionJobStage(job.id, PipelineStage.Publishing, {}, {
      type: `${PipelineStage.Publishing}Started`,
      payload: { jobId: job.id, message: 'Publishing media to target platforms' }
    });

    await processStage(job.id, PipelineStage.Publishing);

    if (options?.onStageComplete) {
      await options.onStageComplete(PipelineStage.Publishing);
    }

    // Pipeline completed successfully!
    await jobRepository.transitionJobStage(job.id, PipelineStage.Completed, {
      failedAt: null,
      failureReason: null,
      failureStage: null,
    }, {
      type: 'JobCompleted',
      payload: { jobId: job.id, message: 'Job completed and published successfully' },
    });

    logger.info({ jobId: job.id }, 'Job execution completed and marked as Completed');
  } catch (err: any) {
    const failedStage = job.pipelineStage || PipelineStage.GeneratingContent;
    logger.error({ jobId: job.id, stage: failedStage, err }, 'Content pipeline stage failed');

    const failureReason = err.message || 'Unknown error occurred during pipeline execution';
    const retryCount = (job.retryCount || 0) + 1;

    await jobRepository.transitionJobStage(job.id, PipelineStage.Failed, {
      failedAt: new Date(),
      failureReason,
      failureStage: failedStage.toString(),
      retryCount,
    }, {
      type: 'JobFailed',
      payload: {
        jobId: job.id,
        stage: failedStage,
        message: `Pipeline failed at stage ${failedStage}: ${failureReason}`,
        retryCount,
      },
    });
  }
}
