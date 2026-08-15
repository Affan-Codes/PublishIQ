import { PipelineStage, PublishStatus, Job, Asset, AssetType } from '@prisma/client';
import { jobRepository } from '../repositories/job.repository.js';
import { channelRepository } from '../repositories/channel.repository.js';
import { generatedContentRepository } from '../repositories/generatedContent.repository.js';
import { contentTypeRepository } from '../repositories/contentType.repository.js';
import { contentProfileRepository } from '../repositories/contentProfile.repository.js';
import { assetRepository } from '../repositories/asset.repository.js';
import { templateRepository } from '../repositories/template.repository.js';
import { geminiProvider } from '../providers/ai/gemini.provider.js';
import { renderingService } from './rendering.service.js';
import { videoService } from './video.service.js';
import { publishingService } from './publishing.service.js';
import { systemConfigCache } from '../config/system-config.cache.js';
import { getNormalizedHash } from '../utils/normalization.js';
import { logger } from '../utils/logger.js';
import { ValidationError, NotFoundError, ExternalProviderError } from '../errors/custom-errors.js';

export interface PipelineOptions {
  onStageComplete?: (stage: PipelineStage) => Promise<void>;
}

// LOW-02: In-memory cache for licensed music assets per workspace with 60-second TTL
const musicAssetCache = new Map<string, { timestamp: number; assets: Asset[] }>();

async function getCachedActiveMusic(workspaceId: string): Promise<Asset[]> {
  const cached = musicAssetCache.get(workspaceId);
  const now = Date.now();
  if (cached && (now - cached.timestamp) < 60000) {
    return cached.assets;
  }
  const allMusic = await assetRepository.list(workspaceId, AssetType.Music);
  musicAssetCache.set(workspaceId, { timestamp: now, assets: allMusic });
  return allMusic;
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

      // MED-04: Use configSnapshot's pinned promptVersionId as authoritative
      const snapshot = (job.configSnapshot as Record<string, any>) || {};
      let promptVersionId = snapshot.promptVersionId;
      if (!promptVersionId) {
        logger.warn({ jobId }, 'Job configSnapshot missing promptVersionId, falling back to live contentProfile relation');
        promptVersionId = profile.promptVersionId;
      }

      const promptVersion = await jobRepository.getPromptVersionById(promptVersionId);
      const contentType = await contentTypeRepository.getById(profile.contentTypeId, job.workspaceId);

      if (!promptVersion) {
        throw new ValidationError(`Prompt version not found: ${promptVersionId}`);
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
      const configProfanity = await systemConfigCache.get<string[]>('profanity_filter_words');
      const defaultProfanities = ['abuse', 'asshole', 'bitch', 'bastard', 'crap', 'cunt', 'dick', 'fuck', 'motherfucker', 'piss', 'pussy', 'shit', 'slut', 'whore'];
      const profanityList = Array.isArray(configProfanity) ? configProfanity : defaultProfanities;
      const containsProfanity = profanityList.some((word) => {
        const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(text);
      });
      if (containsProfanity) {
        throw new ValidationError('Generated text contains filtered profanity words.');
      }

      // Normalized Hash duplicate check
      const normalizedHash = getNormalizedHash(text);
      const duplicateContent = await generatedContentRepository.findByTextHash(job.workspaceId, normalizedHash);

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

      // MED-04: Use configSnapshot's pinned templateVersionId as authoritative
      const snapshot = (job.configSnapshot as Record<string, any>) || {};
      let templateVersionId = snapshot.templateVersionId;
      if (!templateVersionId) {
        logger.warn({ jobId }, 'Job configSnapshot missing templateVersionId, falling back to live contentProfile relation');
        templateVersionId = profile.templateVersionId;
      }

      // Render vertical PNG via Playwright
      const imageUrl = await renderingService.renderImage(jobId, text, {
        language: profile.language,
        branding: (profile.renderingConfiguration as any)?.branding || 'PUBLISHIQ',
        watermark: (profile.renderingConfiguration as any)?.watermark || '@publishiq',
        templateVersionId,
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

      // LOW-02: Load active licensed music assets using TTL cache
      const allMusic = await getCachedActiveMusic(job.workspaceId);

      // Filter candidates using both mood and genre
      const exactMatches = allMusic.filter((asset) => {
        if (asset.status !== 'Active' || asset.licenseStatus !== 'Confirmed') return false;
        const meta = asset.metadata as Record<string, any> || {};
        return meta.mood === mood && meta.genre === genre;
      });

      // Fallback: if no exact combination is found, fallback to matching by mood only
      const candidates = exactMatches.length > 0
        ? exactMatches
        : allMusic.filter((asset) => {
            if (asset.status !== 'Active' || asset.licenseStatus !== 'Confirmed') return false;
            const meta = asset.metadata as Record<string, any> || {};
            return meta.mood === mood;
          });

      if (candidates.length === 0) {
        throw new ValidationError(`No music track matches profile selection rules: ${JSON.stringify(selectionRules)}`);
      }

      // Pick the first matched asset
      const selectedAsset = candidates[0]!;
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
      let musicFilePath = snapshot.selectedMusicFilePath;
      if (!musicFilePath || (!musicFilePath.startsWith('http://') && !musicFilePath.startsWith('https://'))) {
        const activeMusicAssets = await getCachedActiveMusic(job.workspaceId);
        const validCloudinaryTrack = activeMusicAssets.find((a: Asset) => a.filePath && (a.filePath.startsWith('http://') || a.filePath.startsWith('https://')));
        if (validCloudinaryTrack) {
          musicFilePath = validCloudinaryTrack.filePath;
        } else {
          throw new ValidationError('No valid Cloudinary music track available for rendering.');
        }
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
        let captionText = `💡 Daily Wisdom:\n\n"${text}"\n\nFollow for more!`;

        if (job.contentProfileId) {
          const profile = await contentProfileRepository.getById(job.contentProfileId, job.workspaceId);
          const captionStrat = profile?.captionStrategy as Record<string, any> | undefined;
          if (captionStrat?.template) {
            captionText = captionStrat.template.replace('{{text}}', text);
          } else if (captionStrat?.prefix || captionStrat?.suffix) {
            captionText = `${captionStrat.prefix || ''}${text}${captionStrat.suffix || ''}`;
          }
        }

        await jobRepository.transitionJobStage(jobId, stage, {
          caption: captionText,
        });
      } else {
        await jobRepository.transitionJobStage(jobId, stage, {});
      }
      break;
    }

    case PipelineStage.GeneratingHashtags: {
      if (!job.hashtags) {
        let hashtagsList = ['wisdom', 'quotes', 'daily', 'motivation'];

        if (job.contentProfileId) {
          const profile = await contentProfileRepository.getById(job.contentProfileId, job.workspaceId);
          const hashtagStrat = profile?.hashtagStrategy as Record<string, any> | undefined;
          if (Array.isArray(hashtagStrat?.tags) && hashtagStrat.tags.length > 0) {
            hashtagsList = hashtagStrat.tags;
          }
        }

        await jobRepository.transitionJobStage(jobId, stage, {
          hashtags: hashtagsList,
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
  const resumeStageStr = (job.pipelineStage === PipelineStage.Failed && job.failureStage)
    ? job.failureStage
    : job.pipelineStage;

  const isPublishingResume = resumeStageStr === PipelineStage.Publishing || resumeStageStr === 'Publishing';

  if (resumeStageStr && !isPublishingResume) {
    const stageIndex = generationStages.indexOf(resumeStageStr as PipelineStage);
    if (stageIndex !== -1) {
      startIndex = stageIndex;
      logger.info({ jobId, resumeStage: resumeStageStr }, 'Resuming job pipeline from stage');
    }
  }

  try {
    const completedStagesInThisRun = new Set<PipelineStage>();

    // 1. Run Generation & Media Rendering Phase (skipped if resuming from Publishing or Completed)
    if (!isPublishingResume && job.pipelineStage !== PipelineStage.Publishing && job.pipelineStage !== PipelineStage.Completed) {
      let duplicateAttempts = 0;
      const maxDuplicateRetriesVal = await systemConfigCache.get<number>('retry_limit.duplicate_regeneration');
      const maxDuplicateRetries = typeof maxDuplicateRetriesVal === 'number' ? maxDuplicateRetriesVal : 5;

      while (true) {
        try {
          for (let i = startIndex; i < generationStages.length; i++) {
            const stage = generationStages[i]!;
            if (completedStagesInThisRun.has(stage)) {
              continue;
            }

            job = await jobRepository.transitionJobStage(job.id, stage, {}, {
              type: `${stage}Started`,
              payload: { jobId: job.id, message: `Pipeline stage ${stage} started` },
            });

            await processStage(job.id, stage);
            completedStagesInThisRun.add(stage);

            if (options?.onStageComplete) {
              await options.onStageComplete(stage);
            }
          }

          // Save/persist the generated content preview
          const finalizedJob = await jobRepository.getById(job.id);
          if (!finalizedJob) throw new Error('Job not found after pipeline execution');

          const snapshot = (finalizedJob.configSnapshot as Record<string, any>) || {};
          const promptVersionId = snapshot.promptVersionId || finalizedJob.contentProfile?.promptVersionId || '';
          const templateVersionId = snapshot.templateVersionId || finalizedJob.contentProfile?.templateVersionId || '';

          let genContent = await generatedContentRepository.findByJobId(finalizedJob.id);
          const normalizedHash = getNormalizedHash(finalizedJob.generatedText || '');

          if (!genContent) {
            genContent = await jobRepository.saveGeneratedContent({
              workspaceId: finalizedJob.workspaceId,
              jobId: finalizedJob.id,
              contentProfileId: finalizedJob.contentProfileId || '',
              promptVersionId,
              templateVersionId,
              language: finalizedJob.contentProfile?.language || 'English',
              contentTypeId: finalizedJob.contentProfile?.contentTypeId || '',
              text: finalizedJob.generatedText || '',
              textHash: normalizedHash,
              imageUrl: finalizedJob.imageUrl,
              videoUrl: finalizedJob.videoUrl,
              caption: finalizedJob.caption,
              hashtags: finalizedJob.hashtags,
              publishStatus: PublishStatus.Unpublished,
            });
          } else {
            // Synchronize existing GeneratedContent with updated job fields
            await generatedContentRepository.update(genContent.id, {
              text: finalizedJob.generatedText || '',
              imageUrl: finalizedJob.imageUrl,
              videoUrl: finalizedJob.videoUrl,
              caption: finalizedJob.caption,
              hashtags: (finalizedJob.hashtags as any) ?? undefined,
              textHash: normalizedHash,
            });
          }

          break; // Successfully generated and persisted!
        } catch (err: any) {
          // CRIT-05: Handle application-level duplicate check or DB unique constraint race (P2002)
          const isDuplicate = (err instanceof ValidationError && err.message.includes('Duplicate content detected'))
            || (err?.code === 'P2002' && (err.meta?.target?.includes('textHash') || JSON.stringify(err).includes('textHash')));

          if (isDuplicate) {
            duplicateAttempts++;
            if (duplicateAttempts >= maxDuplicateRetries) {
              throw new ValidationError(
                `Validation failed: Duplicate content detected. Automatically regenerated ${duplicateAttempts} times but could not produce unique content.`
              );
            }
            logger.warn({ jobId: job.id, duplicateAttempts }, 'Duplicate content detected. Triggering automatic regeneration...');

            completedStagesInThisRun.clear();
            startIndex = 0;

            await jobRepository.transitionJobStage(job.id, PipelineStage.Draft, {
              generatedText: null,
              imageUrl: null,
              videoUrl: null,
              caption: null,
              hashtags: null,
            });
            continue;
          }
          throw err;
        }
      }
    }

    // 2. Check Hold Condition (Manual / Hybrid)
    const finalizedJob = await jobRepository.getById(job.id);
    if (!finalizedJob) throw new Error('Job not found');

    const channel = finalizedJob.channelId ? await channelRepository.getById(finalizedJob.channelId) : null;

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

    throw err;
  }
}
