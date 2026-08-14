import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs';
import { logger } from './logger.js';
import { ValidationError } from '../errors/custom-errors.js';

const execFilePromise = util.promisify(execFile);
const ffmpegPath = ffmpegInstaller.path;

/**
 * Determines the exact duration of an audio file in seconds using FFmpeg.
 */
export async function getAudioDurationInSeconds(filePath: string): Promise<number> {
  if (!fs.existsSync(filePath)) {
    throw new ValidationError(`Audio file does not exist on disk at path: ${filePath}`);
  }

  try {
    // Running ffmpeg -i <filePath> outputs format and duration info to stderr
    await execFilePromise(ffmpegPath, ['-i', filePath]);
  } catch (err: any) {
    const stderr = err.stderr || err.stdout || '';
    const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (match) {
      const hours = parseFloat(match[1] || '0');
      const minutes = parseFloat(match[2] || '0');
      const seconds = parseFloat(match[3] || '0');
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      if (totalSeconds > 0) {
        return totalSeconds;
      }
    }
  }

  throw new ValidationError('Failed to determine source audio file duration using FFmpeg.');
}

/**
 * Trims an audio file from startTime to endTime using FFmpeg.
 */
export async function trimAudioSegment(
  sourcePath: string,
  outputPath: string,
  startTime: number,
  endTime: number
): Promise<void> {
  if (!fs.existsSync(sourcePath)) {
    throw new ValidationError(`Source audio file not found at: ${sourcePath}`);
  }

  const duration = endTime - startTime;
  if (duration <= 0) {
    throw new ValidationError(`Invalid trim range: start time (${startTime}s) must be less than end time (${endTime}s).`);
  }

  logger.info({ sourcePath, outputPath, startTime, endTime, duration }, 'Trimming audio segment with FFmpeg');

  // Attempt fast audio stream copy first
  const copyArgs = [
    '-y',
    '-ss', String(startTime),
    '-t', String(duration),
    '-i', sourcePath,
    '-acodec', 'copy',
    outputPath,
  ];

  try {
    await execFilePromise(ffmpegPath, copyArgs);
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      return;
    }
  } catch (copyErr: any) {
    logger.warn({ error: copyErr.message }, 'FFmpeg stream copy failed; falling back to audio re-encoding');
  }

  // Re-encode audio to MP3 if stream-copy fails or container needs re-encoding
  const reencodeArgs = [
    '-y',
    '-ss', String(startTime),
    '-t', String(duration),
    '-i', sourcePath,
    '-acodec', 'libmp3lame',
    '-b:a', '192k',
    outputPath,
  ];

  await execFilePromise(ffmpegPath, reencodeArgs);

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new Error('FFmpeg failed to produce a valid trimmed output audio file.');
  }
}
