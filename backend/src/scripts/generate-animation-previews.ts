/**
 * ============================================================================
 * ANIMATION PREVIEW GENERATION SCRIPT (Ahead-of-Time Operator Task)
 * ============================================================================
 * 
 * NOTE ON PREVIEW STALENESS:
 * Animation preview clips are generated ahead-of-time and stored in
 * SystemConfiguration ('animation_preview_urls') and Cloudinary. Whenever the
 * underlying FFmpeg filter graph, zoom increment formula, CRF/preset values,
 * or overscan logic changes for any animation preset, maintainers must re-run
 * this script (via `npm run generate:animation-previews`) to update the preview
 * video assets and prevent visual drift between previews and generated jobs.
 * ============================================================================
 */

import { renderingService } from '../services/rendering.service.js';
import { videoService, AnimationPreset } from '../services/video.service.js';
import { configRepository } from '../repositories/config.repository.js';
import { workspaceRepository } from '../repositories/workspace.repository.js';
import { systemConfigCache } from '../config/system-config.cache.js';
import { logger } from '../utils/logger.js';
import {
  SAMPLE_PREVIEW_TEXT,
  SAMPLE_PREVIEW_BRANDING,
  SAMPLE_PREVIEW_WATERMARK,
  SAMPLE_PREVIEW_DURATION_SECONDS,
  SAMPLE_PREVIEW_BACKGROUND_URL,
  SAMPLE_PREVIEW_AUDIO_URL,
  DEFAULT_ANIMATION_PREVIEW_URLS,
} from '../constants/animation-previews.js';
import { prisma } from '../database/db.js';

export const PREVIEW_ANIMATION_PRESETS: Exclude<AnimationPreset, 'None'>[] = [
  'SlowZoomIn',
  'SlowZoomOut',
  'PanLeft',
  'PanRight',
  'PanUp',
  'PanDown',
];

export interface GeneratePreviewsOptions {
  workspaceId?: string;
  sampleText?: string;
  sampleBackgroundUrl?: string;
  sampleAudioUrl?: string;
  durationSeconds?: number;
}

/**
 * Generates high-fidelity demo video clips for all 6 animation presets using the real production pipeline.
 * Saves the resulting URLs to SystemConfiguration under the key 'animation_preview_urls'.
 */
export async function generateAllAnimationPreviews(options?: GeneratePreviewsOptions): Promise<Record<string, string>> {
  logger.info('Starting ahead-of-time generation for all 6 animation preset preview clips...');

  let wsId = options?.workspaceId;
  if (!wsId) {
    const ws = await workspaceRepository.getFirst();
    if (!ws) {
      throw new Error('No workspace found in the database. Ensure database has been seeded.');
    }
    wsId = ws.id;
  }

  const sampleText = options?.sampleText || SAMPLE_PREVIEW_TEXT;
  const sampleBgUrl = options?.sampleBackgroundUrl || SAMPLE_PREVIEW_BACKGROUND_URL;
  const sampleAudioUrl = options?.sampleAudioUrl || SAMPLE_PREVIEW_AUDIO_URL;
  const duration = options?.durationSeconds || SAMPLE_PREVIEW_DURATION_SECONDS;

  const previewUrls: Record<string, string> = {};

  for (const preset of PREVIEW_ANIMATION_PRESETS) {
    const previewJobId = `animation_preview_${preset.toLowerCase()}_${Date.now()}`;
    logger.info({ preset, previewJobId }, 'Generating preview video using production rendering and video pipeline');

    // 1. Render layered screenshot plates (background with pan overscan + transparent foreground)
    const renderResult = await renderingService.renderImage(previewJobId, sampleText, {
      language: 'English',
      branding: SAMPLE_PREVIEW_BRANDING,
      watermark: SAMPLE_PREVIEW_WATERMARK,
      backgroundImageUrl: sampleBgUrl,
      animationPreset: preset,
    });

    // 2. Render 5s MP4 video with real FFmpeg filter graph (zoompan + overlay + CRF 18 + slow preset + Lanczos)
    const videoUrl = await videoService.renderVideo(
      previewJobId,
      renderResult.imageUrl,
      sampleAudioUrl,
      duration,
      {
        foregroundImagePathOrUrl: renderResult.foregroundImageUrl,
        animationPreset: preset,
        storageFolder: 'animation-previews',
      }
    );

    previewUrls[preset] = videoUrl;
    logger.info({ preset, videoUrl }, 'Successfully generated and uploaded preview clip');
  }

  // 3. Persist mapping to SystemConfiguration
  await configRepository.updateSystemConfig(wsId, 'animation_preview_urls', previewUrls);
  await systemConfigCache.reload();

  logger.info({ previewUrls }, 'All 6 animation preview clips successfully generated and saved to SystemConfiguration');
  return previewUrls;
}

// Direct CLI Execution
async function main() {
  try {
    const results = await generateAllAnimationPreviews();
    console.log('\n========================================');
    console.log('ANIMATION PREVIEWS GENERATED SUCCESSFULLY:');
    console.log('========================================');
    console.log(JSON.stringify(results, null, 2));
    console.log('========================================\n');
  } catch (err: any) {
    console.error('Failed to generate animation previews:', err.message);
    process.exit(1);
  } finally {
    await renderingService.closeBrowser();
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes('generate-animation-previews')) {
  main();
}
