import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { buildFFmpegArgs, AnimationPreset, RENDER_FPS } from '../services/video.service.js';
import { createDirectionalFixtureBMP } from '../tests/fixtures/directional-fixture.js';
import { probeMedia, formatReportTable } from './diagnose-render-quality.js';

const execFilePromise = util.promisify(execFile);
const ffmpegPath = ffmpegInstaller.path;

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
  for (const file of generatedFiles) {
    const report = await probeMedia(file);
    reports.push(report);
  }

  console.log(formatReportTable(reports));
  console.log(`\nAll 7 animation clips generated successfully in: ${path.resolve(outDir)}\n`);
}

if (process.argv[1]?.includes('verify-all-animations')) {
  runAnimationVerification().catch((err) => {
    console.error('Verification run failed:', err);
    process.exit(1);
  });
}
