import { PipelineStage, PublishStatus, Job, Asset } from '@prisma/client';
import { jobRepository } from '../repositories/job.repository.js';
import { geminiProvider } from '../providers/ai/gemini.provider.js';
import { renderingService } from './rendering.service.js';
import { videoService } from './video.service.js';
import { systemConfigCache } from '../config/system-config.cache.js';
import { getNormalizedHash } from '../utils/normalization.js';
import { logger } from '../utils/logger.js';
import { ValidationError, NotFoundError, ExternalProviderError } from '../errors/custom-errors.js';
import { prisma } from '../database/db.js';

export interface PipelineOptions {
  onStageComplete?: (stage: PipelineStage) => Promise<void>;
}

/**
 * Executes a single stage of the content pipeline.
 */
async function processStage(jobId: string, stage: PipelineStage): Promise<void> {
  const job = await jobRepository.getById(jobId);
  if (!job) throw new NotFoundError('Job not found inside processStage');

  const profile = job.contentProfile;
  if (!profile) throw new ValidationError('Job is missing content profile settings');

  switch (stage) {
    case PipelineStage.GeneratingContent: {
      // If we already have generated text (e.g. from duplication / clone), we skip generation
      if (job.generatedText) {
        logger.info({ jobId }, 'Skipping AI generation, text already prefilled from duplication/clone');
        await jobRepository.transitionJobStage(jobId, stage, {
          generatedText: job.generatedText,
        });
        break;
      }

      const promptVersion = await jobRepository.getPromptVersionById(profile.promptVersionId);
      if (!promptVersion) {
        throw new NotFoundError('Prompt version pinned to content profile not found');
      }

      // Call Gemini Provider for structured JSON response
      const variables = (profile.promptVariables as Record<string, unknown>) || {};
      const aiResponse = await geminiProvider.generate(
        { body: promptVersion.body, versionNumber: promptVersion.versionNumber },
        variables
      );

      // Save generated quote, caption, and hashtags into Job record
      await jobRepository.transitionJobStage(jobId, stage, {
        generatedText: aiResponse.text,
        caption: aiResponse.metadata?.caption,
        hashtags: aiResponse.metadata?.hashtags,
      }, {
        type: 'ContentGenerated',
        payload: { jobId, text: aiResponse.text },
      });
      break;
    }

    case PipelineStage.Validating: {
      const text = job.generatedText || '';
      if (!text || text.trim() === '') {
        throw new ValidationError('Validation failed: Empty output generated.');
      }
      if (text.length > 500) {
        throw new ValidationError('Validation failed: Quote length exceeds maximum limit of 500 characters.');
      }

      // Basic profanity check
      const lowerText = text.toLowerCase();
      const profanities = ['profanity', 'badword', 'abuse']; // extend if needed
      if (profanities.some((word) => lowerText.includes(word))) {
        throw new ValidationError('Validation failed: Content contains prohibited terms.');
      }

      // Exact duplicate detection using normalized hash
      const hash = getNormalizedHash(text);
      const duplicateCount = await prisma.generatedContent.count({
        where: {
          textHash: hash,
        },
      });

      if (duplicateCount > 0) {
        throw new ValidationError('Validation failed: Duplicate content detected.');
      }

      logger.info({ jobId }, 'Validation stage passed successfully');
      break;
    }

    case PipelineStage.RenderingImage: {
      // Get branding and watermark configurations
      const brandingRules = profile.brandingRules as Record<string, any> || {};
      const watermarkRules = profile.watermarkRules as Record<string, any> || {};

      const branding = brandingRules.logoText || profile.name || 'PUBLISHIQ';
      const watermark = watermarkRules.text || '@publishiq';

      // Call image renderer using Playwright
      const imageUrl = await renderingService.renderImage(jobId, job.generatedText || '', {
        language: profile.language,
        branding,
        watermark,
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
      // Read music selection rules (e.g. mood, genre, language)
      const selectionRules = profile.musicSelectionRules as Record<string, any> || {};
      
      // Find all active and licensed music assets
      const musicAssets = await prisma.asset.findMany({
        where: {
          workspaceId: job.workspaceId,
          type: 'Music',
          status: 'Active',
          licenseStatus: 'Confirmed',
        },
      });

      if (musicAssets.length === 0) {
        throw new ValidationError('No active, licensed music track available in the asset library.');
      }

      // Filter music assets based on profile rules
      let matchedAssets = musicAssets;
      if (selectionRules.mood) {
        matchedAssets = matchedAssets.filter((asset) => {
          const meta = asset.metadata as Record<string, any> || {};
          return String(meta.mood).toLowerCase() === String(selectionRules.mood).toLowerCase();
        });
      }
      if (selectionRules.genre) {
        matchedAssets = matchedAssets.filter((asset) => {
          const meta = asset.metadata as Record<string, any> || {};
          return String(meta.genre).toLowerCase() === String(selectionRules.genre).toLowerCase();
        });
      }

      // Fallback to any active licensed track if no direct matches found to avoid pipeline block,
      // but if we want strict enforcement, throw a validation error.
      // The PRD says: "No music track matches selection rules -> Job fails at Selecting Music".
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
      // Captions are generated in GeneratingContent and stored. Here we just format or save.
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
      // Hashtags are generated in GeneratingContent. We just verify/ensure list format.
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

  // Pipeline sequence for Milestone 6
  const stages: PipelineStage[] = [
    PipelineStage.GeneratingContent,
    PipelineStage.Validating,
    PipelineStage.RenderingImage,
    PipelineStage.AttachingMusic,
    PipelineStage.RenderingVideo,
    PipelineStage.GeneratingCaption,
    PipelineStage.GeneratingHashtags,
  ];

  // Set the job to Running stage initially
  job = await jobRepository.transitionJobStage(job.id, PipelineStage.Running, {}, {
    type: 'JobRunning',
    payload: { jobId: job.id, message: 'Content pipeline execution started' },
  });

  let startIndex = 0;
  if (job.pipelineStage && job.pipelineStage !== PipelineStage.Running && job.pipelineStage !== PipelineStage.Draft) {
    const lastStageIndex = stages.indexOf(job.pipelineStage);
    if (lastStageIndex !== -1) {
      startIndex = lastStageIndex;
      logger.info({ jobId, resumeStage: job.pipelineStage }, 'Resuming job pipeline from last stage');
    }
  }

  try {
    for (let i = startIndex; i < stages.length; i++) {
      const stage = stages[i]!;

      // Transition stage to started
      job = await jobRepository.transitionJobStage(job.id, stage, {}, {
        type: `${stage}Started`,
        payload: { jobId: job.id, message: `Pipeline stage ${stage} started` },
      });

      // Special handling for content generation + validation to enable duplicate regeneration loop
      if (stage === PipelineStage.GeneratingContent) {
        let attempts = 0;
        const maxDuplicateRetriesVal = await systemConfigCache.get<number>('retry_limit.duplicate_regeneration');
        const maxDuplicateRetries = typeof maxDuplicateRetriesVal === 'number' ? maxDuplicateRetriesVal : 5;

        while (true) {
          try {
            // Run content generation
            await processStage(job.id, PipelineStage.GeneratingContent);
            
            // Run validation immediately to check duplicates
            await processStage(job.id, PipelineStage.Validating);
            
            // If validation succeeds, break generation/validation loop!
            i++; // skip validating stage execution in the next outer iteration since we ran it here
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
              
              // Clear previous generation text/caption/hashtags to ensure a clean rerun
              await jobRepository.transitionJobStage(job.id, PipelineStage.Draft, {
                generatedText: null,
                caption: null,
                hashtags: null,
              });
              continue;
            }
            throw err; // rethrow other validation/network errors to fail the job
          }
        }
      } else {
        // Run standard stage execution
        await processStage(job.id, stage);
      }

      if (options?.onStageComplete) {
        await options.onStageComplete(stage);
      }
    }

    // Pipeline completed! Save GeneratedContent and mark job according to automation mode
    const finalizedJob = await jobRepository.getById(job.id);
    if (!finalizedJob) throw new Error('Job not found after pipeline execution');

    // Store final generated content output in the database
    await jobRepository.saveGeneratedContent({
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
      publishStatus: PublishStatus.Unpublished, // Saved as unpublished preview content
    });

    // Save hash on GeneratedContent for duplicate check
    const normalizedHash = getNormalizedHash(finalizedJob.generatedText || '');
    const genContent = await prisma.generatedContent.findFirst({
      where: { jobId: finalizedJob.id }
    });
    if (genContent) {
      await prisma.generatedContent.update({
        where: { id: genContent.id },
        data: {
          textHash: normalizedHash,
        }
      });
    }

    // Fetch the channel to decide the automation mode flow
    const channel = finalizedJob.channelId ? await prisma.channel.findUnique({
      where: { id: finalizedJob.channelId },
    }) : null;

    const automationMode = channel?.automationMode || 'Manual';

    if (automationMode === 'Hybrid') {
      // Set job final stage to Queued (operator approval pending)
      await jobRepository.transitionJobStage(job.id, PipelineStage.Queued, {
        failedAt: null,
        failureReason: null,
        failureStage: null,
      }, {
        type: 'ApprovalRequired',
        payload: { jobId: job.id, message: 'Content generated successfully. Operator approval required.' },
      });
      logger.info({ jobId: job.id }, 'Job execution held at Queued stage for Hybrid mode approval');
    } else {
      // Automatic/Manual: Complete the job immediately
      await jobRepository.transitionJobStage(job.id, PipelineStage.Completed, {
        failedAt: null,
        failureReason: null,
        failureStage: null,
      }, {
        type: 'JobCompleted',
        payload: { jobId: job.id, message: 'Content generated and job completed successfully' },
      });

      // Update generated content status to Published
      if (genContent) {
        await prisma.generatedContent.update({
          where: { id: genContent.id },
          data: {
            publishStatus: 'Published',
          }
        });
      }
      logger.info({ jobId: job.id }, 'Job execution completed and marked as Completed');
    }
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
