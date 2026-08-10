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

export const videoService = {
  /**
   * Generates a vertical MP4 video from a static image and background music with a zoom animation,
   * uploads the result to Cloudinary, and cleans up all local scratch files in a finally block.
   */
  async renderVideo(
    jobId: string,
    imagePathOrUrl: string,
    audioPathOrUrl: string,
    durationSeconds: number
  ): Promise<string> {
    logger.info({ jobId, durationSeconds, imagePathOrUrl, audioPathOrUrl }, 'Compiling video using FFmpeg with Cloudinary storage');

    const tempFilesToCleanup: string[] = [];

    const scratchDir = env.TEMP_RENDER_DIR;
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }

    try {
      // 1. Prepare image input (download to scratch if remote Cloudinary URL)
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

      // 2. Prepare audio input (download to scratch if remote Cloudinary URL)
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

      // 3. Define temporary output MP4 path in scratch directory
      const tempOutputPath = path.join(scratchDir, `${jobId}_render_${Date.now()}.mp4`);
      tempFilesToCleanup.push(tempOutputPath);

      // Build FFmpeg command arguments.
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
        tempOutputPath,
      ];

      logger.debug({ ffmpegPath, args }, 'Executing FFmpeg process for video compilation');
      const { stdout, stderr } = await execFilePromise(ffmpegPath, args);
      logger.trace({ stdout, stderr }, 'FFmpeg output logs');

      if (!fs.existsSync(tempOutputPath)) {
        throw new Error(`FFmpeg finished but output video file missing at: ${tempOutputPath}`);
      }

      // 4. Read compiled MP4 file buffer and upload to Cloudinary
      logger.info({ tempOutputPath }, 'FFmpeg video compilation successful. Uploading compiled video to Cloudinary...');
      const videoBuffer = fs.readFileSync(tempOutputPath);
      const relativePath = `videos/${jobId}_render.mp4`;
      const secureUrl = await cloudinaryStorageProvider.save(videoBuffer, relativePath);

      logger.info({ jobId, secureUrl }, 'Video compiled and stored on Cloudinary successfully');
      return secureUrl;
    } catch (err: any) {
      logger.error({ jobId, err: err.message }, 'FFmpeg video compilation failed');
      throw new Error(`FFmpeg compilation error: ${err.message}`);
    } finally {
      // 5. Unconditionally delete all scratch files created during this render job
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

/**
 * Resolves static local paths if given a relative filename or disk path inside TEMP_RENDER_DIR.
 */
function resolveLocalPath(pathOrUrl: string): string {
  if (path.isAbsolute(pathOrUrl) && fs.existsSync(pathOrUrl)) {
    return pathOrUrl;
  }
  return path.resolve(env.TEMP_RENDER_DIR, pathOrUrl);
}

export default videoService;
