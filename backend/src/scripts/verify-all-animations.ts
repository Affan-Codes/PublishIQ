import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { buildFFmpegArgs, AnimationPreset, RENDER_FPS } from '../services/video.service.js';
import { createDirectionalFixtureBMP } from '../tests/fixtures/directional-fixture.js';
import { probeMedia, formatReportTable } from './diagnose-render-quality.js';

const execFilePromise = util.promisify(execFile);
const ffmpegPath = ffmpegInstaller.path;
const ffprobePath = ffprobeInstaller.path;

const PRESETS: AnimationPreset[] = [
  'None',
  'SlowZoomIn',
  'SlowZoomOut',
  'PanLeft',
  'PanRight',
  'PanUp',
  'PanDown',
];

async function createSilentAudio(outputPath: string, durationSeconds: number): Promise<void> {
  const args = [
    '-y',
    '-f', 'lavfi',
    '-i', 'anullsrc=r=44100:cl=stereo',
    '-t', durationSeconds.toString(),
    '-c:a', 'aac',
    outputPath,
  ];
  await execFilePromise(ffmpegPath, args);
}

async function createSampleForeground(outputPath: string): Promise<void> {
  // Generates a 1080x1920 transparent PNG with white test text
  const args = [
    '-y',
    '-f', 'lavfi',
    '-i', 'color=c=black@0.0:s=1080x1920:d=1',
    '-vframes', '1',
    outputPath,
  ];
  await execFilePromise(ffmpegPath, args);
}

export async function runAnimationVerification(outDir: string = './scratch/animation_verification'): Promise<void> {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const fixtureBmp = path.join(outDir, 'directional_fixture_1200x1600.bmp');
  createDirectionalFixtureBMP(fixtureBmp, 1200, 1600);

  const durationSeconds = 3;
  const audioPath = path.join(outDir, 'test_audio.aac');
  const fgPath = path.join(outDir, 'test_fg.png');

  await createSilentAudio(audioPath, durationSeconds);
  await createSampleForeground(fgPath);

  console.log(`\n=== Generating All 7 Animation Presets (${durationSeconds}s @ ${RENDER_FPS}fps) ===\n`);

  const generatedFiles: string[] = [];

  for (const preset of PRESETS) {
    const mp4Out = path.join(outDir, `${preset}.mp4`);
    const args = buildFFmpegArgs({
      localImagePath: fixtureBmp,
      localForegroundPath: fgPath,
      localAudioPath: audioPath,
      durationSeconds,
      animationPreset: preset,
      backgroundWidth: 1200,
      backgroundHeight: 1600,
      tempOutputPath: mp4Out,
    });

    console.log(`Rendering preset: ${preset} -> ${mp4Out}`);
    await execFilePromise(ffmpegPath, args);
    generatedFiles.push(mp4Out);
  }

  console.log('\n=== Probing Output Video Files with FFprobe ===\n');
  const reports = [];
  const detailedStats: Array<{
    preset: string;
    r_frame_rate: string;
    avg_frame_rate: string;
    nb_frames: string | number;
    duration: string | number;
    time_base: string;
  }> = [];

  for (let i = 0; i < generatedFiles.length; i++) {
    const file = generatedFiles[i]!;
    const preset = PRESETS[i]!;
    const report = await probeMedia(file);
    reports.push(report);

    // Query ffprobe stream details
    const probeArgs = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      file,
    ];
    const { stdout } = await execFilePromise(ffprobePath, probeArgs);
    const data = JSON.parse(stdout);
    const vStream = data.streams?.find((s: any) => s.codec_type === 'video') || {};

    detailedStats.push({
      preset,
      r_frame_rate: vStream.r_frame_rate || 'N/A',
      avg_frame_rate: vStream.avg_frame_rate || 'N/A',
      nb_frames: vStream.nb_frames || report.video?.frameCount || 'N/A',
      duration: vStream.duration || report.durationSeconds || 'N/A',
      time_base: vStream.time_base || 'N/A',
    });
  }

  console.log(formatReportTable(reports));
  console.log('\n=== Detailed Animation Timing & Frame Rate Stream Metrics ===\n');
  console.table(detailedStats);
  console.log(`\nAll 7 animation clips generated successfully in: ${path.resolve(outDir)}\n`);
}

if (process.argv[1]?.includes('verify-all-animations')) {
  runAnimationVerification().catch((err) => {
    console.error('Verification run failed:', err);
    process.exit(1);
  });
}
