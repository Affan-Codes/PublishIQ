import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import util from 'util';
import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { cloudinaryStorageProvider } from '../providers/storage/cloudinary.provider.js';

const execFilePromise = util.promisify(execFile);
const ffmpegPath = ffmpegInstaller.path;

export type AnimationPreset =
  | 'None'
  | 'SlowZoomIn'
  | 'SlowZoomOut'
  | 'PanLeft'
  | 'PanRight'
  | 'PanUp'
  | 'PanDown';

export interface VideoRenderOptions {
  foregroundImagePathOrUrl?: string | undefined;
  animationPreset?: AnimationPreset | undefined;
  storageFolder?: string | undefined;
}

/**
 * NOTE ON PREVIEW STALENESS:
 * Animation preview clips for the Content Profile UI are generated ahead-of-time
 * via `npm run generate:animation-previews`. Whenever the underlying FFmpeg filter graph,
 * zoom increment formula, CRF/preset values, or overscan logic changes for any preset,
 * maintainers must re-run that script to update the preview assets in Cloudinary/SystemConfig.
 */

/**
 * Builds the dynamic zoompan filter expression for a given preset and clip duration.
 * Uses dynamic increment computation: (targetZoom - 1.0) / totalFrames.
 */
export function buildZoompanExpression(
  preset: AnimationPreset,
  durationSeconds: number,
  targetZoom: number = 1.10
): string | null {
  const framesCount = durationSeconds * 25; // 25 fps
  const inc = (targetZoom - 1.0) / framesCount;

  switch (preset) {
    case 'SlowZoomIn':
      return `zoompan=z='min(zoom+${inc},${targetZoom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${framesCount}:s=1080x1920:fps=25`;
    case 'SlowZoomOut':
      return `zoompan=z='max(${targetZoom}-(${inc}*(on-1)),1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${framesCount}:s=1080x1920:fps=25`;
    case 'PanLeft':
      return `zoompan=z=1.0:x='(iw-1080)*(1-on/${framesCount})':y='(ih-1920)/2':d=${framesCount}:s=1080x1920:fps=25`;
    case 'PanRight':
      return `zoompan=z=1.0:x='(iw-1080)*(on/${framesCount})':y='(ih-1920)/2':d=${framesCount}:s=1080x1920:fps=25`;
    case 'PanUp':
      return `zoompan=z=1.0:x='(iw-1080)/2':y='(ih-1920)*(1-on/${framesCount})':d=${framesCount}:s=1080x1920:fps=25`;
    case 'PanDown':
      return `zoompan=z=1.0:x='(iw-1080)/2':y='(ih-1920)*(on/${framesCount})':d=${framesCount}:s=1080x1920:fps=25`;
    case 'None':
    default:
      return null;
  }
}

/**
 * Builds the complete FFmpeg command argument array for single or layered rendering.
 */
export function buildFFmpegArgs(params: {
  localImagePath: string;
  localForegroundPath?: string | undefined;
  localAudioPath: string;
  durationSeconds: number;
  animationPreset?: AnimationPreset | undefined;
  tempOutputPath: string;
}): string[] {
  const { localImagePath, localForegroundPath, localAudioPath, durationSeconds, animationPreset, tempOutputPath } = params;

  if (localForegroundPath) {
    // Two-input Layered Composition (AQL-06, AQL-10)
    const zoompan = buildZoompanExpression(animationPreset || 'None', durationSeconds);
    const filterComplex = zoompan
      ? `[0:v] scale=2160:3840:flags=lanczos, ${zoompan} [bg]; [1:v] scale=1080:1920:flags=lanczos [fg]; [bg][fg] overlay=0:0:format=auto, format=yuv420p [outv]`
      : `[0:v] scale=1080:1920:flags=lanczos [bg]; [1:v] scale=1080:1920:flags=lanczos [fg]; [bg][fg] overlay=0:0:format=auto, format=yuv420p [outv]`;

    // CRITICAL FIX: When zoompan is used, do NOT loop the input image with -loop 1 before zoompan.
    // zoompan takes 1 image frame and generates the full animated frame sequence (d=duration*fps).
    // Looping the input causes zoompan to reset its zoom/pan state on every single input frame, making it static.
    const bgInputArgs = zoompan
      ? ['-i', localImagePath]
      : ['-loop', '1', '-t', durationSeconds.toString(), '-i', localImagePath];

    return [
      '-y',
      ...bgInputArgs,
      '-loop', '1',
      '-t', durationSeconds.toString(),
      '-i', localForegroundPath,
      '-i', localAudioPath,
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-map', '2:a',
      '-c:v', 'libx264',
      '-crf', '18',
      '-preset', 'slow',
      '-pix_fmt', 'yuv420p',
      '-r', '25',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      tempOutputPath,
    ];
  } else {
    // Single-input Flat Composition (AQL-10 feature-off fallback with quality improvements)
    return [
      '-y',
      '-loop', '1',
      '-t', durationSeconds.toString(),
      '-i', localImagePath,
      '-i', localAudioPath,
      '-vf', 'scale=1080:1920:flags=lanczos,format=yuv420p',
      '-c:v', 'libx264',
      '-crf', '18',
      '-preset', 'slow',
      '-pix_fmt', 'yuv420p',
      '-r', '25',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      tempOutputPath,
    ];
  }
}

/**
 * Helper to stream a remote URL asset into a temporary scratch file on disk.
 */
async function downloadToScratch(url: string, prefix: string): Promise<string> {
  const scratchDir = env.TEMP_RENDER_DIR;
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }

  const parsedUrl = url.split('?')[0] || url;
  const ext = path.extname(parsedUrl) || '.tmp';
  const tempPath = path.join(scratchDir, `scratch_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);

  logger.debug({ url, tempPath }, 'Downloading remote media asset into scratch space for FFmpeg');

  const response = await axios.get(url, { responseType: 'stream' });
  const writer = fs.createWriteStream(tempPath);

  await new Promise<void>((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', (err) => {
      writer.close();
      reject(err);
    });
  });

  return tempPath;
}

/**
 * Resolves static local paths if given a relative filename or disk path inside TEMP_RENDER_DIR.
 */
function resolveLocalPath(pathOrUrl: string): string {
  if (path.isAbsolute(pathOrUrl) && fs.existsSync(pathOrUrl)) {
    return pathOrUrl;
  }
  return path.resolve(env.TEMP_RENDER_DIR, pathOrUrl);
}

export const videoService = {
  /**
   * Generates a vertical MP4 video from image(s) and background music with high-quality animation,
   * uploads the result to Cloudinary, and cleans up all local scratch files in a finally block.
   */
  async renderVideo(
    jobId: string,
    imagePathOrUrl: string,
    audioPathOrUrl: string,
    durationSeconds: number,
    options?: VideoRenderOptions
  ): Promise<string> {
    logger.info(
      { jobId, durationSeconds, imagePathOrUrl, foregroundUrl: options?.foregroundImagePathOrUrl, audioPathOrUrl, preset: options?.animationPreset },
      'Compiling video using FFmpeg with Cloudinary storage'
    );

    const tempFilesToCleanup: string[] = [];

    const scratchDir = env.TEMP_RENDER_DIR;
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }

    try {
      // 1. Prepare main/background image input
      let localImagePath: string;
      if (imagePathOrUrl.startsWith('http://') || imagePathOrUrl.startsWith('https://')) {
        localImagePath = await downloadToScratch(imagePathOrUrl, `${jobId}_img`);
        tempFilesToCleanup.push(localImagePath);
      } else {
        localImagePath = resolveLocalPath(imagePathOrUrl);
        if (!fs.existsSync(localImagePath)) {
          throw new Error(`Rendered image file not found on disk at: ${localImagePath}`);
        }
      }

      // 2. Prepare foreground image input if layered mode
      let localForegroundPath: string | undefined;
      const fgUrl = options?.foregroundImagePathOrUrl;
      if (fgUrl) {
        if (fgUrl.startsWith('http://') || fgUrl.startsWith('https://')) {
          localForegroundPath = await downloadToScratch(fgUrl, `${jobId}_fg`);
          tempFilesToCleanup.push(localForegroundPath);
        } else {
          localForegroundPath = resolveLocalPath(fgUrl);
          if (!fs.existsSync(localForegroundPath)) {
            throw new Error(`Rendered foreground image file not found on disk at: ${localForegroundPath}`);
          }
        }
      }

      // 3. Prepare audio input
      let localAudioPath: string;
      if (audioPathOrUrl.startsWith('http://') || audioPathOrUrl.startsWith('https://')) {
        localAudioPath = await downloadToScratch(audioPathOrUrl, `${jobId}_audio`);
        tempFilesToCleanup.push(localAudioPath);
      } else {
        localAudioPath = resolveLocalPath(audioPathOrUrl);
        if (!fs.existsSync(localAudioPath)) {
          throw new Error(`Background music track file not found on disk at: ${localAudioPath}`);
        }
      }

      // 4. Define temporary output MP4 path
      const tempOutputPath = path.join(scratchDir, `${jobId}_render_${Date.now()}.mp4`);
      tempFilesToCleanup.push(tempOutputPath);

      // 5. Build FFmpeg command arguments
      const args = buildFFmpegArgs({
        localImagePath,
        localForegroundPath,
        localAudioPath,
        durationSeconds,
        animationPreset: options?.animationPreset,
        tempOutputPath,
      });

      logger.debug({ ffmpegPath, args }, 'Executing FFmpeg process for video compilation');
      const { stdout, stderr } = await execFilePromise(ffmpegPath, args);
      logger.trace({ stdout, stderr }, 'FFmpeg output logs');

      if (!fs.existsSync(tempOutputPath)) {
        throw new Error(`FFmpeg finished but output video file missing at: ${tempOutputPath}`);
      }

      // 6. Read compiled MP4 file buffer and upload to Cloudinary
      logger.info({ tempOutputPath }, 'FFmpeg video compilation successful. Uploading compiled video to Cloudinary...');
      const videoBuffer = fs.readFileSync(tempOutputPath);
      const folder = options?.storageFolder || 'videos';
      const relativePath = `${folder}/${jobId}_render.mp4`;
      const { url: secureUrl } = await cloudinaryStorageProvider.save(videoBuffer, relativePath);

      logger.info({ jobId, secureUrl }, 'Video compiled and stored on Cloudinary successfully');
      return secureUrl;
    } catch (err: any) {
      logger.error({ jobId, err: err.message }, 'FFmpeg video compilation failed');
      throw new Error(`FFmpeg compilation error: ${err.message}`);
    } finally {
      // 7. Unconditionally delete all scratch files
      for (const tempFile of tempFilesToCleanup) {
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
            logger.debug({ tempFile }, 'Cleaned up temporary scratch file after video job');
          }
        } catch (cleanupErr: any) {
          logger.warn({ tempFile, err: cleanupErr.message }, 'Failed to delete temporary scratch file');
        }
      }
    }
  }
};

export default videoService;
