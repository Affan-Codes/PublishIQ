import { PipelineStage, PublishStatus, Job, Asset, AssetType } from '@prisma/client';
import { jobRepository } from '../repositories/job.repository.js';
import { channelRepository } from '../repositories/channel.repository.js';
import { generatedContentRepository } from '../repositories/generatedContent.repository.js';
import { contentTypeRepository } from '../repositories/contentType.repository.js';
import { contentProfileRepository } from '../repositories/contentProfile.repository.js';
import { assetRepository } from '../repositories/asset.repository.js';
import { templateRepository } from '../repositories/template.repository.js';
import { musicSelectionStateRepository } from '../repositories/musicSelectionState.repository.js';
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

// LOW-02 / CFG-15: In-memory cache for licensed music assets per workspace with 60-second TTL.
// Single-worker-process assumption: This cache relies on the single-worker deployment model.
// If worker processes are scaled horizontally across multiple instances/containers, this cache
// should be migrated to Valkey to maintain cross-process consistency.
const musicAssetCache = new Map<string, { timestamp: number; assets: Asset[] }>();

export function clearMusicAssetCache(): void {
  musicAssetCache.clear();
}

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
 * In-memory cache for background assets per workspace with 60-second TTL.
 */
const backgroundAssetCache = new Map<string, { timestamp: number; assets: Asset[] }>();

export function clearBackgroundAssetCache(): void {
  backgroundAssetCache.clear();
}

async function getCachedActiveBackgrounds(workspaceId: string): Promise<Asset[]> {
  const cached = backgroundAssetCache.get(workspaceId);
  const now = Date.now();
  if (cached && (now - cached.timestamp) < 60000) {
    return cached.assets;
  }
  const allBackgrounds = await assetRepository.list(workspaceId, AssetType.Background);
  backgroundAssetCache.set(workspaceId, { timestamp: now, assets: allBackgrounds });
  return allBackgrounds;
}

/**
 * Validates that the asset filePath is hosted on trusted Cloudinary delivery domain (BG-12).
 */
export function isTrustedCloudinaryUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('https://res.cloudinary.com/') || url.startsWith('http://res.cloudinary.com/');
}

export interface BackgroundSelectionFilterRules {
  mood?: string;
  style?: string;
  theme?: string;
  tags?: string[];
  orientation?: 'portrait' | 'landscape' | 'square';
}

/**
 * Filters active, license-confirmed background assets matching optional rules.
 */
export function selectEligibleBackgroundCandidates(
  allBackgrounds: Asset[],
  rules?: BackgroundSelectionFilterRules
): Asset[] {
  // 1. Base eligibility filter
  const baseEligible = allBackgrounds.filter((asset) => {
    if (asset.type !== AssetType.Background) return false;
    if (asset.status !== 'Active' || asset.licenseStatus !== 'Confirmed') return false;
    if (!asset.filePath || !isTrustedCloudinaryUrl(asset.filePath)) return false;
    return true;
  });

  if (!rules || Object.keys(rules).length === 0) {
    return baseEligible;
  }

  // 2. Filter by metadata rules (mood, style, theme, tags)
  const filtered = baseEligible.filter((asset) => {
    const meta = (asset.metadata as Record<string, any>) || {};

    if (rules.mood && meta.mood && meta.mood.toLowerCase() !== rules.mood.toLowerCase()) {
      return false;
    }
    if (rules.style && meta.style && meta.style.toLowerCase() !== rules.style.toLowerCase()) {
      return false;
    }
    if (rules.theme && meta.theme && meta.theme.toLowerCase() !== rules.theme.toLowerCase()) {
      return false;
    }
    if (Array.isArray(rules.tags) && rules.tags.length > 0) {
      const assetTags = Array.isArray(meta.tags) ? meta.tags.map((t: string) => String(t).toLowerCase()) : [];
      const hasOverlap = rules.tags.some((tag) => assetTags.includes(tag.toLowerCase()));
      if (!hasOverlap) {
        return false;
      }
    }
    return true;
  });

  const candidatesToConsider = filtered.length > 0 ? filtered : baseEligible;

  // 3. Soft orientation preference
  if (rules.orientation) {
    const orientationMatches = candidatesToConsider.filter((asset) => {
      const meta = (asset.metadata as Record<string, any>) || {};
      return meta.orientation === rules.orientation;
    });
    if (orientationMatches.length > 0) {
      return orientationMatches;
    }
  }

  return candidatesToConsider;
}

export function buildTruncatedBackgroundCatalog(
  candidates: Asset[],
  maxSize: number = 40
): { truncatedCandidates: Asset[]; catalogPayload: Array<{ id: string; name: string; mood?: string; style?: string; theme?: string; orientation?: string; tags?: string[] }> } {
  const sorted = [...candidates].sort((a, b) => a.id.localeCompare(b.id));
  const truncated = sorted.slice(0, maxSize);
  if (sorted.length > maxSize) {
    logger.warn({ total: sorted.length, max: maxSize }, 'Background candidates truncated to maximum catalog size');
  }
  const catalogPayload = truncated.map((c) => {
    const meta = (c.metadata as Record<string, any>) || {};
    const item: {
      id: string;
      name: string;
      mood?: string;
      style?: string;
      theme?: string;
      orientation?: string;
      tags?: string[];
    } = {
      id: c.id,
      name: c.name,
    };
    if (meta.mood) item.mood = String(meta.mood);
    if (meta.style) item.style = String(meta.style);
    if (meta.theme) item.theme = String(meta.theme);
    if (meta.orientation) item.orientation = String(meta.orientation);
    if (Array.isArray(meta.tags)) item.tags = meta.tags.map(String);
    return item;
  });
  return { truncatedCandidates: truncated, catalogPayload };
}

/**
 * Filters active, license-confirmed music assets matching mood and genre.
 * Falls back to mood-only matching if no exact mood+genre match is found.
 */
export function selectEligibleMusicCandidates(
  allMusic: Asset[],
  mood?: string,
  genre?: string
): Asset[] {
  const targetMood = mood || 'Inspiring';
  const targetGenre = genre || 'Acoustic';

  // Filter candidates that are Active and Confirmed
  const exactMatches = allMusic.filter((asset) => {
    if (asset.status !== 'Active' || asset.licenseStatus !== 'Confirmed') return false;
    const meta = (asset.metadata as Record<string, any>) || {};
    return meta.mood === targetMood && meta.genre === targetGenre;
  });

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  // Fallback to mood-only matching
  return allMusic.filter((asset) => {
    if (asset.status !== 'Active' || asset.licenseStatus !== 'Confirmed') return false;
    const meta = (asset.metadata as Record<string, any>) || {};
    return meta.mood === targetMood;
  });
}

/**
 * Orchestrates a single stage in the content pipeline.
 */
export async function processStage(jobId: string, stage: PipelineStage): Promise<void> {
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

      // MED-04 / CFG-10: Sourcing from configSnapshot as authoritative with profile fallback
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

      // Sourcing behavioral fields from snapshot with fallback
      const language = snapshot.language || profile.language;
      const tone = snapshot.tone || profile.tone;
      const style = snapshot.writingStyle || profile.writingStyle;
      const variables = (snapshot.promptVariables !== undefined ? snapshot.promptVariables : profile.promptVariables) as Record<string, any> || {};

      // PAS-01: Compute eligible music catalog to provide to Gemini
      const selectionRules = (snapshot.musicSelectionRules !== undefined ? snapshot.musicSelectionRules : profile.musicSelectionRules) as Record<string, any> || {};
      const mood = selectionRules.mood || 'Inspiring';
      const genre = selectionRules.genre || 'Acoustic';

      const allMusic = await getCachedActiveMusic(job.workspaceId);
      const eligibleCandidates = selectEligibleMusicCandidates(allMusic, mood, genre);
      const musicCatalogPayload = eligibleCandidates.map((c) => {
        const meta = (c.metadata as Record<string, any>) || {};
        return {
          id: c.id,
          name: c.name,
          mood: meta.mood || mood,
          genre: meta.genre || genre,
        };
      });

      // BG-04: Compute eligible background catalog if AI mode is enabled
      const bgSelectionRules = (snapshot.backgroundSelectionRules !== undefined ? snapshot.backgroundSelectionRules : profile.backgroundSelectionRules) as Record<string, any> || {};
      let backgroundCatalogPayload: Array<{ id: string; name: string; mood?: string; style?: string; theme?: string; orientation?: string; tags?: string[] }> = [];

      if (bgSelectionRules.selectionMode === 'AI') {
        const allBackgrounds = await getCachedActiveBackgrounds(job.workspaceId);
        const eligibleBgCandidates = selectEligibleBackgroundCandidates(allBackgrounds, {
          mood: bgSelectionRules.mood,
          style: bgSelectionRules.style,
          theme: bgSelectionRules.theme,
          tags: bgSelectionRules.tags,
          orientation: bgSelectionRules.orientation,
        });

        const maxSizeVal = await systemConfigCache.get<number>('background_catalog.max_size');
        const maxSize = typeof maxSizeVal === 'number' ? maxSizeVal : 40;
        const truncated = buildTruncatedBackgroundCatalog(eligibleBgCandidates, maxSize);
        backgroundCatalogPayload = truncated.catalogPayload;
      }

      // Generate content via Gemini AI provider
      const aiResponse = await geminiProvider.generate(
        {
          body: promptVersion.body,
          versionNumber: promptVersion.versionNumber,
        },
        {
          contentType: contentType?.name || '',
          language,
          tone,
          style,
          musicCatalog: JSON.stringify(musicCatalogPayload),
          backgroundCatalog: JSON.stringify(backgroundCatalogPayload),
          ...variables,
        }
      );

      // Persist AI-selected music and background asset ids in configSnapshot
      const aiSelectedMusicAssetId = aiResponse.metadata?.selectedMusicAssetId || null;
      const aiSelectedBackgroundAssetId = aiResponse.metadata?.selectedBackgroundAssetId || null;
      const updatedSnapshot = {
        ...snapshot,
        aiSelectedMusicAssetId,
        aiSelectedBackgroundAssetId,
      };

      // Store generated text in job record
      await jobRepository.transitionJobStage(jobId, stage, {
        generatedText: aiResponse.text,
        caption: aiResponse.metadata?.caption || '',
        hashtags: aiResponse.metadata?.hashtags || [],
        configSnapshot: updatedSnapshot,
      });
      break;
    }

    case PipelineStage.Validating: {
      const text = job.generatedText || '';

      // Check empty
      if (!text.trim()) {
        throw new ValidationError('Generated text content is empty.');
      }

      const snapshot = (job.configSnapshot as Record<string, any>) || {};
      const validationRules = (snapshot.validationRules !== undefined ? snapshot.validationRules : job.contentProfile?.validationRules) as Record<string, any> || {};

      // CFG-01: Length validation from additive validationRules if specified
      if (typeof validationRules.maxLength === 'number' && validationRules.maxLength > 0) {
        if (text.length > validationRules.maxLength) {
          throw new ValidationError(`Generated text length (${text.length}) exceeds maximum length limit (${validationRules.maxLength}).`);
        }
      }

      // Profanity filtering check
      const configProfanity = await systemConfigCache.get<string[]>('profanity_filter_words');
      const defaultProfanities = ['abuse', 'asshole', 'bitch', 'bastard', 'crap', 'cunt', 'dick', 'fuck', 'motherfucker', 'piss', 'pussy', 'shit', 'slut', 'whore'];
      const baseProfanityList = Array.isArray(configProfanity) ? configProfanity : defaultProfanities;

      // CFG-01: Additive profile-specific bannedWords merged into base profanity list
      const extraBannedWords = Array.isArray(validationRules.bannedWords) ? validationRules.bannedWords : [];
      const combinedProfanityList = [...new Set([...baseProfanityList, ...extraBannedWords])];

      const containsProfanity = combinedProfanityList.some((word) => {
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

    case PipelineStage.ResolvingBackground: {
      const profile = job.contentProfile;
      if (!profile) {
        throw new ValidationError('Job is missing a Content Profile snapshot.');
      }

      const snapshot = (job.configSnapshot as Record<string, any>) || {};

      // BG-08 / Idempotency guard for stage re-entry/retry on the same job
      if (snapshot.selectedBackgroundAssetId || snapshot.backgroundSelectionMethod === 'none') {
        logger.info({ jobId, assetId: snapshot.selectedBackgroundAssetId, method: snapshot.backgroundSelectionMethod }, 'Background already resolved for this job; skipping re-selection');
        await jobRepository.transitionJobStage(jobId, stage, {
          configSnapshot: snapshot,
        });
        break;
      }

      const backgroundRules = (snapshot.backgroundSelectionRules !== undefined ? snapshot.backgroundSelectionRules : profile.backgroundSelectionRules) as Record<string, any> || {};
      const selectionMode = backgroundRules.selectionMode;

      // BG-05: Feature-off Short-Circuit
      if (!selectionMode || selectionMode === 'Off' || selectionMode === 'none') {
        logger.info({ jobId }, 'Background selection is not configured or Off for this profile; skipping');
        const updatedSnapshot = {
          ...snapshot,
          backgroundSelectionMethod: 'none',
          selectedBackgroundAssetId: null,
          selectedBackgroundFilePath: null,
        };
        await jobRepository.transitionJobStage(jobId, stage, {
          configSnapshot: updatedSnapshot,
        });
        break;
      }

      if (selectionMode === 'Manual') {
        const manualAssetId = backgroundRules.manualAssetId;
        if (!manualAssetId) {
          throw new ValidationError('Manual background selection mode requires manualAssetId');
        }

        // Re-validate manual asset fresh from repository (BG-06)
        const asset = await assetRepository.getById(manualAssetId, job.workspaceId);
        if (!asset || asset.workspaceId !== job.workspaceId) {
          throw new ValidationError(`Manual background asset ${manualAssetId} was not found in this workspace`);
        }
        if (asset.type !== AssetType.Background) {
          throw new ValidationError(`Manual asset ${manualAssetId} is not a Background asset (found: ${asset.type})`);
        }
        if (asset.status !== 'Active') {
          throw new ValidationError(`Manual background asset ${manualAssetId} is not Active (found: ${asset.status})`);
        }
        if (asset.licenseStatus !== 'Confirmed') {
          throw new ValidationError(`Manual background asset ${manualAssetId} does not have Confirmed license status (found: ${asset.licenseStatus})`);
        }
        if (!asset.filePath || !isTrustedCloudinaryUrl(asset.filePath)) {
          throw new ValidationError(`Manual background asset ${manualAssetId} does not have a trusted Cloudinary file path`);
        }

        const updatedSnapshot = {
          ...snapshot,
          selectedBackgroundAssetId: asset.id,
          selectedBackgroundFilePath: asset.filePath,
          backgroundSelectionMethod: 'manual',
        };

        logger.info({ jobId, assetId: asset.id }, 'Manual background asset resolved successfully');
        await jobRepository.transitionJobStage(jobId, stage, {
          configSnapshot: updatedSnapshot,
        });
        break;
      }

      if (selectionMode === 'AI') {
        const allBackgrounds = await getCachedActiveBackgrounds(job.workspaceId);
        const eligibleCandidates = selectEligibleBackgroundCandidates(allBackgrounds, {
          mood: backgroundRules.mood,
          style: backgroundRules.style,
          theme: backgroundRules.theme,
          tags: backgroundRules.tags,
          orientation: backgroundRules.orientation,
        });

        if (eligibleCandidates.length === 0) {
          throw new ValidationError(`No eligible background assets match the configured selection rules: ${JSON.stringify(backgroundRules)}`);
        }

        const maxSizeVal = await systemConfigCache.get<number>('background_catalog.max_size');
        const maxSize = typeof maxSizeVal === 'number' ? maxSizeVal : 40;
        const { truncatedCandidates, catalogPayload } = buildTruncatedBackgroundCatalog(eligibleCandidates, maxSize);

        let chosenAsset: Asset | null = null;

        // Check if GeneratingContent stage previously selected a valid ID (BG-07)
        const initialSelectedId = snapshot.aiSelectedBackgroundAssetId;
        if (typeof initialSelectedId === 'string' && initialSelectedId.trim().length > 0) {
          const trimmed = initialSelectedId.trim();
          const match = truncatedCandidates.find((c) => c.id === trimmed);
          if (match) {
            chosenAsset = match;
            logger.info({ jobId, assetId: match.id }, 'AI-selected background asset from generation stage matched eligible catalog');
          } else {
            logger.warn({ jobId, initialSelectedId: trimmed }, 'AI-selected background asset ID is not in eligible candidates set; triggering bounded recovery');
          }
        }

        // Bounded retry recovery loop if initial selection was missing or invalid (BG-07)
        if (!chosenAsset) {
          const retryLimitVal = await systemConfigCache.get<number>('retry_limit.background_ai_selection');
          const maxRetries = typeof retryLimitVal === 'number' ? retryLimitVal : 2;

          let recoveryAttempts = 0;
          while (!chosenAsset && recoveryAttempts < maxRetries) {
            recoveryAttempts++;
            logger.info({ jobId, recoveryAttempts, maxRetries }, 'Executing bounded AI recovery attempt for background selection');

            const recoverySelectedId = await geminiProvider.selectBestBackgroundMatch?.(catalogPayload, {
              quote: job.generatedText || '',
              language: snapshot.language || profile.language,
              tone: snapshot.tone || profile.tone,
              style: snapshot.writingStyle || profile.writingStyle,
            });

            if (recoverySelectedId) {
              const match = truncatedCandidates.find((c) => c.id === recoverySelectedId);
              if (match) {
                chosenAsset = match;
                logger.info({ jobId, assetId: match.id, recoveryAttempts }, 'Bounded recovery AI background selection succeeded');
                break;
              }
            }
          }

          if (!chosenAsset) {
            throw new ValidationError(
              `AI background selection failed after ${recoveryAttempts} recovery attempt(s) — no valid asset was selected from ${truncatedCandidates.length} eligible candidate(s)`
            );
          }
        }

        const updatedSnapshot = {
          ...snapshot,
          selectedBackgroundAssetId: chosenAsset.id,
          selectedBackgroundFilePath: chosenAsset.filePath,
          backgroundSelectionMethod: 'ai',
        };

        logger.info({ jobId, assetId: chosenAsset.id, method: 'ai' }, 'AI background asset resolved successfully');
        await jobRepository.transitionJobStage(jobId, stage, {
          configSnapshot: updatedSnapshot,
        });
        break;
      }

      throw new ValidationError(`Unknown background selection mode: ${selectionMode}`);
    }

    case PipelineStage.RenderingImage: {
      const text = job.generatedText || '';
      const profile = job.contentProfile;
      if (!profile) {
        throw new ValidationError('Job is missing a Content Profile snapshot.');
      }

      // MED-04 / CFG-10: Use configSnapshot's pinned templateVersionId as authoritative
      const snapshot = (job.configSnapshot as Record<string, any>) || {};
      let templateVersionId = snapshot.templateVersionId;
      if (!templateVersionId) {
        logger.warn({ jobId }, 'Job configSnapshot missing templateVersionId, falling back to live contentProfile relation');
        templateVersionId = profile.templateVersionId;
      }

      const brandingRules = (snapshot.brandingRules !== undefined ? snapshot.brandingRules : profile.brandingRules) as Record<string, any> || {};
      const watermarkRules = (snapshot.watermarkRules !== undefined ? snapshot.watermarkRules : profile.watermarkRules) as Record<string, any> || {};
      const renderingConfiguration = (snapshot.renderingConfiguration !== undefined ? snapshot.renderingConfiguration : profile.renderingConfiguration) as Record<string, any> || {};

      // CFG-01: Wire brandingRules and watermarkRules text with renderingConfiguration fallback
      const brandingText = brandingRules.text || renderingConfiguration.branding || 'PUBLISHIQ';
      const watermarkText = watermarkRules.text || renderingConfiguration.watermark || '@publishiq';

      // Render vertical PNG via Playwright (passing selectedBackgroundFilePath if resolved)
      const imageUrl = await renderingService.renderImage(jobId, text, {
        language: snapshot.language || profile.language,
        branding: brandingText,
        watermark: watermarkText,
        templateVersionId,
        backgroundImageUrl: snapshot.selectedBackgroundFilePath || undefined,
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

      const snapshot = (job.configSnapshot as Record<string, any>) || {};

      // PAS-02: Idempotency guard for stage re-entry/retry on the same job
      if (snapshot.selectedMusicAssetId && snapshot.selectedMusicFilePath) {
        logger.info({ jobId, assetId: snapshot.selectedMusicAssetId }, 'Music track already attached for this job; skipping re-selection');
        await jobRepository.transitionJobStage(jobId, stage, {
          configSnapshot: snapshot,
        });
        break;
      }

      const selectionRules = (snapshot.musicSelectionRules !== undefined ? snapshot.musicSelectionRules : profile.musicSelectionRules) as Record<string, any> || {};
      const mood = selectionRules.mood || 'Inspiring';
      const genre = selectionRules.genre || 'Acoustic';

      // LOW-02: Load active licensed music assets using TTL cache
      const allMusic = await getCachedActiveMusic(job.workspaceId);

      // Filter candidates using shared helper
      const candidates = selectEligibleMusicCandidates(allMusic, mood, genre);

      if (candidates.length === 0) {
        throw new ValidationError(`No music track matches profile selection rules: ${JSON.stringify(selectionRules)}`);
      }

      const sortedCandidates = [...candidates].sort((a, b) => a.id.localeCompare(b.id));

      // PAS-01: AI-driven selection with backend candidate validation
      const aiSelectedId = snapshot.aiSelectedMusicAssetId;
      let selectedAsset: Asset | null = null;
      let selectionMethod: 'ai' | 'rotation' = 'rotation';

      if (typeof aiSelectedId === 'string' && aiSelectedId.trim().length > 0) {
        const trimmedId = aiSelectedId.trim();
        const matched = sortedCandidates.find((c) => c.id === trimmedId);
        if (matched) {
          selectedAsset = matched;
          selectionMethod = 'ai';
          logger.info({ jobId, assetId: matched.id, mood, genre }, 'AI-selected music track matched eligible catalog and was assigned');
          try {
            await musicSelectionStateRepository.upsertLastSelected(job.workspaceId, mood, genre, selectedAsset.id);
          } catch (err: any) {
            logger.warn({ jobId, err: err.message }, 'Failed to record AI music selection state');
          }
        } else {
          logger.warn(
            { jobId, aiSelectedId: trimmedId, mood, genre },
            'AI-selected music asset ID is not present in current eligible candidate set; falling back to deterministic rotation'
          );
        }
      }

      // Fallback: Deterministic rotation across eligible candidates
      if (!selectedAsset) {
        let rotationAsset = sortedCandidates[0]!;
        try {
          const lastState = await musicSelectionStateRepository.getLastSelected(job.workspaceId, mood, genre);
          if (lastState && lastState.lastSelectedAssetId) {
            const lastIdx = sortedCandidates.findIndex((c) => c.id === lastState.lastSelectedAssetId);
            if (lastIdx !== -1) {
              rotationAsset = sortedCandidates[(lastIdx + 1) % sortedCandidates.length]!;
            }
          }
          await musicSelectionStateRepository.upsertLastSelected(job.workspaceId, mood, genre, rotationAsset.id);
        } catch (err: any) {
          logger.warn({ jobId, err: err.message }, 'Failed to load/update music selection state; falling back to first candidate');
        }
        selectedAsset = rotationAsset;
        if (!aiSelectedId) {
          logger.info({ jobId, assetId: selectedAsset.id, mood, genre }, 'Music track selected successfully via deterministic rotation');
        }
      }

      // Store the selected music asset file path in configSnapshot (since no direct music column exists)
      const updatedSnapshot = {
        ...snapshot,
        selectedMusicAssetId: selectedAsset.id,
        selectedMusicFilePath: selectedAsset.filePath,
        selectedMusicMood: mood,
        selectedMusicGenre: genre,
        musicSelectionMethod: selectionMethod,
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
      const snapshot = (job.configSnapshot as Record<string, any>) || {};
      let musicFilePath = snapshot.selectedMusicFilePath;

      // CFG-04: Fallback must honor musicSelectionRules and licenseStatus === 'Confirmed'
      if (!musicFilePath || (!musicFilePath.startsWith('http://') && !musicFilePath.startsWith('https://'))) {
        const selectionRules = (snapshot.musicSelectionRules !== undefined ? snapshot.musicSelectionRules : job.contentProfile?.musicSelectionRules) as Record<string, any> || {};
        const mood = snapshot.selectedMusicMood || selectionRules.mood || 'Inspiring';
        const genre = snapshot.selectedMusicGenre || selectionRules.genre || 'Acoustic';

        const allActiveMusic = await getCachedActiveMusic(job.workspaceId);
        const eligibleCandidates = selectEligibleMusicCandidates(allActiveMusic, mood, genre);

        const validCloudinaryTrack = eligibleCandidates.find(
          (a: Asset) => a.filePath && (a.filePath.startsWith('http://') || a.filePath.startsWith('https://'))
        );

        if (validCloudinaryTrack) {
          logger.warn(
            { jobId, fallbackAssetId: validCloudinaryTrack.id, mood, genre },
            'Selected music path unusable/local; fell back to compliant active Cloudinary track'
          );
          musicFilePath = validCloudinaryTrack.filePath;
        } else {
          throw new ValidationError(
            `Previously selected music track is no longer usable and no compliant fallback candidate exists for mood: ${mood}, genre: ${genre}`
          );
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

        // CFG-10: Read from snapshot with fallback
        const snapshot = (job.configSnapshot as Record<string, any>) || {};
        const captionStrat = (snapshot.captionStrategy !== undefined ? snapshot.captionStrategy : job.contentProfile?.captionStrategy) as Record<string, any> | undefined;

        if (captionStrat?.template) {
          captionText = captionStrat.template.replace('{{text}}', text);
        } else if (captionStrat?.prefix || captionStrat?.suffix) {
          captionText = `${captionStrat.prefix || ''}${text}${captionStrat.suffix || ''}`;
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

        // CFG-10: Read from snapshot with fallback
        const snapshot = (job.configSnapshot as Record<string, any>) || {};
        const hashtagStrat = (snapshot.hashtagStrategy !== undefined ? snapshot.hashtagStrategy : job.contentProfile?.hashtagStrategy) as Record<string, any> | undefined;

        if (Array.isArray(hashtagStrat?.tags) && hashtagStrat.tags.length > 0) {
          hashtagsList = hashtagStrat.tags;
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
    PipelineStage.ResolvingBackground,
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
