import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import util from 'util';
import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { cloudinaryStorageProvider } from '../providers/storage/cloudinary.provider.js';
import {
  computeCoverFit,
  computePanOverscan,
  DEFAULT_PAN_OVERSCAN_FACTOR,
  OUTPUT_WIDTH,
  OUTPUT_HEIGHT,
} from './background-geometry.js';

const execFilePromise = util.promisify(execFile);
const ffmpegPath = ffmpegInstaller.path;

/**
 * Authoritative Render Frame Rate (MQA-10)
 * Standardized single constant threaded into every frame-rate dependent calculation.
 */
export const RENDER_FPS = 30;

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
  backgroundWidth?: number | undefined;
  backgroundHeight?: number | undefined;
  panOverscanFactor?: number | undefined;
  storageFolder?: string | undefined;
}

export interface BuildFFmpegArgsParams {
  localImagePath: string;
  localForegroundPath?: string | undefined;
  localAudioPath: string;
  durationSeconds: number;
  animationPreset?: AnimationPreset | undefined;
  backgroundWidth?: number | undefined;
  backgroundHeight?: number | undefined;
  panOverscanFactor?: number | undefined;
  tempOutputPath: string;
}

/**
 * Builds the dynamic zoompan filter expression for zoom presets (MQA-08).
 * Operates on a cover-fit scaled original asset plate.
 * Inc = (targetZoom - 1.0) / totalFrames.
 */
export function buildZoompanExpression(
  preset: AnimationPreset,
  durationSeconds: number,
  targetZoom: number = 1.10
): string | null {
  const totalFrames = durationSeconds * RENDER_FPS;
  const inc = (targetZoom - 1.0) / totalFrames;

  switch (preset) {
    case 'SlowZoomIn':
      return `zoompan=z='min(zoom+${inc},${targetZoom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}:fps=${RENDER_FPS}`;
    case 'SlowZoomOut':
      return `zoompan=z='max(${targetZoom}-(${inc}*(on-1)),1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}:fps=${RENDER_FPS}`;
    default:
      return null;
  }
}

/**
 * Builds the crop filter expression for pan presets (MQA-06 / MQA-11).
 * Operates on an overscanned scaled original asset plate using frame-based linear interpolation.
 * PanLeft: Camera moves right-to-left across source (x decreases from maxPanX to 0).
 * PanRight: Camera moves left-to-right across source (x increases from 0 to maxPanX).
 * PanUp: Camera moves bottom-to-top across source (y decreases from maxPanY to 0).
 * PanDown: Camera moves top-to-bottom across source (y increases from 0 to maxPanY).
 */
export function buildPanCropExpression(
  preset: AnimationPreset,
  durationSeconds: number,
  scaledWidth: number,
  scaledHeight: number
): string | null {
  const totalFrames = durationSeconds * RENDER_FPS;
  const maxPanX = Math.max(0, scaledWidth - OUTPUT_WIDTH);
  const maxPanY = Math.max(0, scaledHeight - OUTPUT_HEIGHT);
  const halfPanX = Math.round(maxPanX / 2);
  const halfPanY = Math.round(maxPanY / 2);

  // Duration-normalized progress calculation over [0, totalFrames - 1]
  const frameDenom = Math.max(1, totalFrames - 1);

  switch (preset) {
    case 'PanLeft':
      return `crop=w=${OUTPUT_WIDTH}:h=${OUTPUT_HEIGHT}:x='${maxPanX}*(1-n/${frameDenom})':y='${halfPanY}'`;
    case 'PanRight':
      return `crop=w=${OUTPUT_WIDTH}:h=${OUTPUT_HEIGHT}:x='${maxPanX}*(n/${frameDenom})':y='${halfPanY}'`;
    case 'PanUp':
      return `crop=w=${OUTPUT_WIDTH}:h=${OUTPUT_HEIGHT}:x='${halfPanX}':y='${maxPanY}*(1-n/${frameDenom})'`;
    case 'PanDown':
      return `crop=w=${OUTPUT_WIDTH}:h=${OUTPUT_HEIGHT}:x='${halfPanX}':y='${maxPanY}*(n/${frameDenom})'`;
    default:
      return null;
  }
}

/**
 * Builds the complete FFmpeg command argument array for single or layered rendering.
 */
export function buildFFmpegArgs(params: BuildFFmpegArgsParams): string[] {
  const {
    localImagePath,
    localForegroundPath,
    localAudioPath,
    durationSeconds,
    animationPreset,
    backgroundWidth,
    backgroundHeight,
    panOverscanFactor,
    tempOutputPath,
  } = params;

  const bgW = backgroundWidth && backgroundWidth > 0 ? backgroundWidth : OUTPUT_WIDTH;
  const bgH = backgroundHeight && backgroundHeight > 0 ? backgroundHeight : OUTPUT_HEIGHT;
  const preset = animationPreset || 'None';

  if (localForegroundPath) {
    // Two-input Layered Composition (MQA-01, MQA-05, MQA-11)
    let filterComplex: string;
    let bgInputArgs: string[];

    if (preset === 'SlowZoomIn' || preset === 'SlowZoomOut') {
      const { coveredWidth, coveredHeight } = computeCoverFit(bgW, bgH, OUTPUT_WIDTH, OUTPUT_HEIGHT);
      const zoompan = buildZoompanExpression(preset, durationSeconds);
      filterComplex = `[0:v] scale=${coveredWidth}:${coveredHeight}:flags=lanczos, ${zoompan} [bg]; [1:v] scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:flags=lanczos [fg]; [bg][fg] overlay=0:0:format=auto, format=yuv420p [outv]`;
      // Single input frame: zoompan expands 1 input image into full frame sequence (d = duration * fps)
      bgInputArgs = ['-i', localImagePath];
    } else if (preset === 'PanLeft' || preset === 'PanRight' || preset === 'PanUp' || preset === 'PanDown') {
      const { scaledWidth, scaledHeight } = computePanOverscan(
        bgW,
        bgH,
        OUTPUT_WIDTH,
        OUTPUT_HEIGHT,
        panOverscanFactor ?? DEFAULT_PAN_OVERSCAN_FACTOR
      );
      const panCrop = buildPanCropExpression(preset, durationSeconds, scaledWidth, scaledHeight);
      filterComplex = `[0:v] scale=${scaledWidth}:${scaledHeight}:flags=lanczos, ${panCrop} [bg]; [1:v] scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:flags=lanczos [fg]; [bg][fg] overlay=0:0:format=auto, format=yuv420p [outv]`;
      // Stream input frames: crop filter evaluates time-varying expressions frame by frame
      bgInputArgs = ['-loop', '1', '-t', durationSeconds.toString(), '-i', localImagePath];
    } else {
      // None (static background cover-fit centered crop)
      const { coveredWidth, coveredHeight } = computeCoverFit(bgW, bgH, OUTPUT_WIDTH, OUTPUT_HEIGHT);
      filterComplex = `[0:v] scale=${coveredWidth}:${coveredHeight}:flags=lanczos, crop=w=${OUTPUT_WIDTH}:h=${OUTPUT_HEIGHT}:x=(iw-${OUTPUT_WIDTH})/2:y=(ih-${OUTPUT_HEIGHT})/2 [bg]; [1:v] scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:flags=lanczos [fg]; [bg][fg] overlay=0:0:format=auto, format=yuv420p [outv]`;
      bgInputArgs = ['-loop', '1', '-t', durationSeconds.toString(), '-i', localImagePath];
    }

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
      '-r', RENDER_FPS.toString(),
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      tempOutputPath,
    ];
  } else {
    // Single-input Flat Composition (fallback when no separate foreground plate exists)
    return [
      '-y',
      '-loop', '1',
      '-t', durationSeconds.toString(),
      '-i', localImagePath,
      '-i', localAudioPath,
      '-vf', `scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:flags=lanczos,format=yuv420p`,
      '-c:v', 'libx264',
      '-crf', '18',
      '-preset', 'slow',
      '-pix_fmt', 'yuv420p',
      '-r', RENDER_FPS.toString(),
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
      {
        jobId,
        durationSeconds,
        imagePathOrUrl,
        foregroundUrl: options?.foregroundImagePathOrUrl,
        audioPathOrUrl,
        preset: options?.animationPreset,
        bgWidth: options?.backgroundWidth,
        bgHeight: options?.backgroundHeight,
        fps: RENDER_FPS,
      },
      'Compiling video using FFmpeg with Cloudinary storage'
    );

    const tempFilesToCleanup: string[] = [];

    const scratchDir = env.TEMP_RENDER_DIR;
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }

    try {
      // 1. Prepare main/background image input (original asset file or flat render)
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
        backgroundWidth: options?.backgroundWidth,
        backgroundHeight: options?.backgroundHeight,
        panOverscanFactor: options?.panOverscanFactor,
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
