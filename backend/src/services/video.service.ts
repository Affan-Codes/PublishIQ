import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import util from 'util';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { localDiskStorageProvider } from '../providers/storage/local-disk.provider.js';

const execFilePromise = util.promisify(execFile);
const ffmpegPath = ffmpegInstaller.path;

export const videoService = {
  /**
   * Generates a vertical MP4 video from a static image and background music with a zoom animation.
   */
  async renderVideo(
    jobId: string,
    imagePathOrUrl: string,
    audioPathOrUrl: string,
    durationSeconds: number
  ): Promise<string> {
    logger.info({ jobId, durationSeconds }, 'Compiling video using FFmpeg');

    // Resolve static local file paths from URL / media paths
    const localImagePath = resolveLocalPath(imagePathOrUrl);
    const localAudioPath = resolveLocalPath(audioPathOrUrl);

    if (!fs.existsSync(localImagePath)) {
      throw new Error(`Rendered image file not found on disk at: ${localImagePath}`);
    }
    if (!fs.existsSync(localAudioPath)) {
      throw new Error(`Background music track file not found on disk at: ${localAudioPath}`);
    }

    // Create target directory if it doesn't exist
    const outputDir = path.join(env.MEDIA_ROOT, 'videos');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const relativePath = `videos/${jobId}_render.mp4`;
    const localOutputPath = path.join(env.MEDIA_ROOT, relativePath);

    // Build FFmpeg command arguments.
    // We loop the image, load the audio, apply zoompan filter for a subtle zoom,
    // transcode to H.264 (yuv420p for standard compatibility), AAC audio,
    // and limit the duration.
    const framesCount = durationSeconds * 25; // 25 fps
    const args = [
      '-y', // Overwrite output
      '-loop', '1',
      '-t', durationSeconds.toString(),
      '-i', localImagePath,
      '-i', localAudioPath,
      '-vf', `zoompan=z='min(zoom+0.0005,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${framesCount}:s=1080x1920,format=yuv420p`,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-r', '25',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      localOutputPath,
    ];

    try {
      logger.debug({ ffmpegPath, args }, 'Executing FFmpeg process');
      const { stdout, stderr } = await execFilePromise(ffmpegPath, args);
      logger.trace({ stdout, stderr }, 'FFmpeg output logs');
      logger.info({ localOutputPath }, 'Video generated and saved successfully');

      return `/media/videos/${jobId}_render.mp4`;
    } catch (err: any) {
      logger.error({ jobId, err }, 'FFmpeg video compilation failed');
      throw new Error(`FFmpeg compilation error: ${err.message}`);
    }
  }
};

/**
 * Resolves static media URLs or relative paths to their absolute disk path inside MEDIA_ROOT.
 */
function resolveLocalPath(pathOrUrl: string): string {
  if (path.isAbsolute(pathOrUrl) && fs.existsSync(pathOrUrl)) {
    return pathOrUrl;
  }

  // Handle URL format: /media/images/xxx.png or images/xxx.png
  let relative = pathOrUrl;
  if (pathOrUrl.startsWith('/media/')) {
    relative = pathOrUrl.replace('/media/', '');
  } else if (pathOrUrl.startsWith('media/')) {
    relative = pathOrUrl.replace('media/', '');
  }

  return path.resolve(env.MEDIA_ROOT, relative);
}

export default videoService;
