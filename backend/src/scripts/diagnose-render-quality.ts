import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';

const execFilePromise = util.promisify(execFile);
const ffprobePath = ffprobeInstaller.path;

export interface MediaProbeReport {
  filePath: string;
  fileSizeBytes: number;
  formatName?: string | undefined;
  durationSeconds?: number | undefined;
  bitrateKbps?: number | undefined;
  video?: {
    codec: string;
    width: number;
    height: number;
    fps: number;
    fpsFraction: string;
    pixelFormat: string;
    frameCount?: number | undefined;
    bitrateKbps?: number | undefined;
  } | undefined;
  audio?: {
    codec: string;
    sampleRate: number;
    channels: number;
    bitrateKbps?: number | undefined;
  } | undefined;
}

/**
 * Runs ffprobe to extract structural and stream metadata from an image or video file.
 */
export async function probeMedia(filePath: string): Promise<MediaProbeReport> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found for probing: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  const args = [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ];

  const { stdout } = await execFilePromise(ffprobePath, args);
  const data = JSON.parse(stdout);

  const format = data.format || {};
  const streams = data.streams || [];

  const videoStream = streams.find((s: any) => s.codec_type === 'video');
  const audioStream = streams.find((s: any) => s.codec_type === 'audio');

  let videoInfo: MediaProbeReport['video'];
  if (videoStream) {
    let fps = 0;
    const rFrameRate = videoStream.r_frame_rate || videoStream.avg_frame_rate || '0/1';
    if (rFrameRate.includes('/')) {
      const [num, den] = rFrameRate.split('/').map(Number);
      fps = den ? num / den : 0;
    } else {
      fps = Number(rFrameRate) || 0;
    }

    videoInfo = {
      codec: videoStream.codec_name,
      width: Number(videoStream.width),
      height: Number(videoStream.height),
      fps: Math.round(fps * 100) / 100,
      fpsFraction: rFrameRate,
      pixelFormat: videoStream.pix_fmt,
      frameCount: videoStream.nb_frames ? Number(videoStream.nb_frames) : undefined,
      bitrateKbps: videoStream.bit_rate ? Math.round(Number(videoStream.bit_rate) / 1000) : undefined,
    };
  }

  let audioInfo: MediaProbeReport['audio'];
  if (audioStream) {
    audioInfo = {
      codec: audioStream.codec_name,
      sampleRate: Number(audioStream.sample_rate),
      channels: Number(audioStream.channels),
      bitrateKbps: audioStream.bit_rate ? Math.round(Number(audioStream.bit_rate) / 1000) : undefined,
    };
  }

  return {
    filePath: path.resolve(filePath),
    fileSizeBytes: stat.size,
    formatName: format.format_name,
    durationSeconds: format.duration ? Number(format.duration) : undefined,
    bitrateKbps: format.bit_rate ? Math.round(Number(format.bit_rate) / 1000) : undefined,
    video: videoInfo,
    audio: audioInfo,
  };
}

export function formatReportTable(reports: MediaProbeReport[]): string {
  const lines: string[] = [];
  lines.push('| File | Resolution | FPS | Codec | PixFmt | Duration (s) | Bitrate (kbps) | Size (KB) |');
  lines.push('|---|---|---|---|---|---|---|---|');

  for (const r of reports) {
    const baseName = path.basename(r.filePath);
    const res = r.video ? `${r.video.width}x${r.video.height}` : 'N/A';
    const fps = r.video ? `${r.video.fps}` : 'N/A';
    const codec = r.video ? r.video.codec : 'N/A';
    const pixFmt = r.video ? r.video.pixelFormat : 'N/A';
    const duration = r.durationSeconds !== undefined ? r.durationSeconds.toFixed(2) : 'N/A';
    const bitrate = r.bitrateKbps !== undefined ? `${r.bitrateKbps}` : 'N/A';
    const sizeKb = Math.round(r.fileSizeBytes / 1024);

    lines.push(`| \`${baseName}\` | ${res} | ${fps} | ${codec} | ${pixFmt} | ${duration} | ${bitrate} | ${sizeKb} |`);
  }

  return lines.join('\n');
}

// CLI Execution entrypoint
if (process.argv[1]?.includes('diagnose-render-quality')) {
  const targetFiles = process.argv.slice(2);
  if (targetFiles.length === 0) {
    console.log('Usage: npx tsx src/scripts/diagnose-render-quality.ts <file1> [file2] ...');
    process.exit(0);
  }

  (async () => {
    try {
      const reports: MediaProbeReport[] = [];
      for (const file of targetFiles) {
        if (fs.existsSync(file)) {
          const report = await probeMedia(file);
          reports.push(report);
        } else {
          console.warn(`Skipping missing file: ${file}`);
        }
      }
      console.log('\n--- PublishIQ Media Quality Diagnostic Report ---\n');
      console.log(formatReportTable(reports));
      console.log('\nDetailed JSON:\n', JSON.stringify(reports, null, 2));
    } catch (err: any) {
      console.error('Diagnosis failed:', err.message);
      process.exit(1);
    }
  })();
}
