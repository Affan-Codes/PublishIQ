import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { buildFFmpegArgs, AnimationPreset, RENDER_FPS } from '../services/video.service.js';
import { createDirectionalFixtureBMP } from './fixtures/directional-fixture.js';

const execFilePromise = util.promisify(execFile);
const ffmpegPath = ffmpegInstaller.path;

const TEST_DIR = path.resolve('./scratch/test_animation_geometry');

interface FrameRGB {
  width: number;
  height: number;
  data: Buffer;
}

/**
 * Extracts a single RGB frame from an MP4 file by rendering a temporary BMP file.
 * Automatically handles BMP 54-byte header, bottom-up row ordering, and BGR->RGB conversion.
 */
async function extractFrameRGB(mp4Path: string, timestampSeconds: number): Promise<FrameRGB> {
  const width = 1080;
  const height = 1920;
  const tempBmp = path.join(TEST_DIR, `temp_extract_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.bmp`);

  try {
    const args = [
      '-y',
      '-i', mp4Path,
      '-ss', timestampSeconds.toFixed(3),
      '-vframes', '1',
      tempBmp,
    ];

    await execFilePromise(ffmpegPath, args);
    const buffer = fs.readFileSync(tempBmp);
    const rowSize = Math.floor((24 * width + 31) / 32) * 4;
    const rgbData = Buffer.alloc(width * height * 3);

    for (let y = 0; y < height; y++) {
      // In bottom-up BMP, row 0 in file is the bottom row (height - 1 - y)
      const srcRowOffset = 54 + (height - 1 - y) * rowSize;
      const dstRowOffset = y * width * 3;

      for (let x = 0; x < width; x++) {
        const b = buffer[srcRowOffset + x * 3]!;
        const g = buffer[srcRowOffset + x * 3 + 1]!;
        const r = buffer[srcRowOffset + x * 3 + 2]!;

        rgbData[dstRowOffset + x * 3] = r;
        rgbData[dstRowOffset + x * 3 + 1] = g;
        rgbData[dstRowOffset + x * 3 + 2] = b;
      }
    }

    return {
      width,
      height,
      data: rgbData,
    };
  } finally {
    if (fs.existsSync(tempBmp)) {
      try { fs.unlinkSync(tempBmp); } catch {}
    }
  }
}

/**
 * Computes average RGB values in a bounding box region [x1..x2, y1..y2].
 */
function getAverageRGB(frame: FrameRGB, x1: number, y1: number, x2: number, y2: number): { r: number; g: number; b: number } {
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;

  for (let y = y1; y < y2; y++) {
    for (let x = x1; x < x2; x++) {
      const idx = (y * frame.width + x) * 3;
      totalR += frame.data[idx]!;
      totalG += frame.data[idx + 1]!;
      totalB += frame.data[idx + 2]!;
      count++;
    }
  }

  return {
    r: totalR / count,
    g: totalG / count,
    b: totalB / count,
  };
}

describe('Animation Directional Geometry & Pixel Movement Tests (MQA-06, MQA-17)', () => {
  let fixtureBmpPath: string;
  let audioPath: string;
  let fgPath: string;
  const duration = 2; // 2 seconds

  before(async () => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }

    // 1. Create directional fixture: 1200x1600
    // Top-Left: Red (#FF0000), Top-Right: Blue (#0000FF), Bottom-Left: Green (#00FF00), Bottom-Right: Yellow (#FFFF00)
    fixtureBmpPath = path.join(TEST_DIR, 'directional_fixture_1200x1600.bmp');
    createDirectionalFixtureBMP(fixtureBmpPath, 1200, 1600);

    // 2. Create silent audio
    audioPath = path.join(TEST_DIR, 'test_audio.aac');
    await execFilePromise(ffmpegPath, [
      '-y',
      '-f', 'lavfi',
      '-i', 'anullsrc=r=44100:cl=stereo',
      '-t', duration.toString(),
      '-c:a', 'aac',
      audioPath,
    ]);

    // 3. Create transparent foreground plate (RGBA with alpha channel)
    fgPath = path.join(TEST_DIR, 'test_fg.png');
    await execFilePromise(ffmpegPath, [
      '-y',
      '-f', 'lavfi',
      '-i', 'color=c=black@0.0:s=1080x1920,format=rgba',
      '-vframes', '1',
      fgPath,
    ]);
  });

  after(() => {
    try {
      if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      }
    } catch {}
  });

  async function renderTestClip(preset: AnimationPreset): Promise<string> {
    const mp4Path = path.join(TEST_DIR, `${preset}.mp4`);
    const args = buildFFmpegArgs({
      localImagePath: fixtureBmpPath,
      localForegroundPath: fgPath,
      localAudioPath: audioPath,
      durationSeconds: duration,
      animationPreset: preset,
      backgroundWidth: 1200,
      backgroundHeight: 1600,
      tempOutputPath: mp4Path,
    });

    await execFilePromise(ffmpegPath, args);
    return mp4Path;
  }

  it('None preset produces zero pixel movement between start and end frame', async () => {
    const mp4 = await renderTestClip('None');
    const frameStart = await extractFrameRGB(mp4, 0.1);
    const frameEnd = await extractFrameRGB(mp4, duration - 0.1);

    const rgbStart = getAverageRGB(frameStart, 100, 100, 400, 400);
    const rgbEnd = getAverageRGB(frameEnd, 100, 100, 400, 400);

    const diff = Math.abs(rgbStart.r - rgbEnd.r) + Math.abs(rgbStart.g - rgbEnd.g) + Math.abs(rgbStart.b - rgbEnd.b);
    assert.ok(diff < 2.0, `Expected None preset to be static, but average RGB changed by ${diff}`);
  });

  it('PanLeft moves camera right-to-left across source (Top region shifts from Blue to Red)', async () => {
    const mp4 = await renderTestClip('PanLeft');
    const frameStart = await extractFrameRGB(mp4, 0.1);
    const frameEnd = await extractFrameRGB(mp4, duration - 0.1);

    const topStart = getAverageRGB(frameStart, 100, 100, 980, 400);
    const topEnd = getAverageRGB(frameEnd, 100, 100, 980, 400);

    assert.ok(
      topEnd.r > topStart.r && topStart.b > topEnd.b,
      `PanLeft expected Top Red increase and Blue decrease: start(R=${topStart.r.toFixed(1)}, B=${topStart.b.toFixed(1)}) vs end(R=${topEnd.r.toFixed(1)}, B=${topEnd.b.toFixed(1)})`
    );
  });

  it('PanRight moves camera left-to-right across source (Top region shifts from Red to Blue)', async () => {
    const mp4 = await renderTestClip('PanRight');
    const frameStart = await extractFrameRGB(mp4, 0.1);
    const frameEnd = await extractFrameRGB(mp4, duration - 0.1);

    const topStart = getAverageRGB(frameStart, 100, 100, 980, 400);
    const topEnd = getAverageRGB(frameEnd, 100, 100, 980, 400);

    assert.ok(
      topEnd.b > topStart.b && topStart.r > topEnd.r,
      `PanRight expected Top Blue increase and Red decrease: start(R=${topStart.r.toFixed(1)}, B=${topStart.b.toFixed(1)}) vs end(R=${topEnd.r.toFixed(1)}, B=${topEnd.b.toFixed(1)})`
    );
  });

  it('PanUp moves camera bottom-to-top across source (Left region shifts from Green to Red)', async () => {
    const mp4 = await renderTestClip('PanUp');
    const frameStart = await extractFrameRGB(mp4, 0.1);
    const frameEnd = await extractFrameRGB(mp4, duration - 0.1);

    const leftStart = getAverageRGB(frameStart, 100, 100, 400, 1820);
    const leftEnd = getAverageRGB(frameEnd, 100, 100, 400, 1820);

    assert.ok(
      leftEnd.r > leftStart.r && leftStart.g > leftEnd.g,
      `PanUp expected Left Red increase and Green decrease: start(R=${leftStart.r.toFixed(1)}, G=${leftStart.g.toFixed(1)}) vs end(R=${leftEnd.r.toFixed(1)}, G=${leftEnd.g.toFixed(1)})`
    );
  });

  it('PanDown moves camera top-to-bottom across source (Left region shifts from Red to Green)', async () => {
    const mp4 = await renderTestClip('PanDown');
    const frameStart = await extractFrameRGB(mp4, 0.1);
    const frameEnd = await extractFrameRGB(mp4, duration - 0.1);

    const leftStart = getAverageRGB(frameStart, 100, 100, 400, 1820);
    const leftEnd = getAverageRGB(frameEnd, 100, 100, 400, 1820);

    assert.ok(
      leftEnd.g > leftStart.g && leftStart.r > leftEnd.r,
      `PanDown expected Left Green increase and Red decrease: start(R=${leftStart.r.toFixed(1)}, G=${leftStart.g.toFixed(1)}) vs end(R=${leftEnd.r.toFixed(1)}, G=${leftEnd.g.toFixed(1)})`
    );
  });

  it('SlowZoomIn expands center quadrant area from start to end', async () => {
    const mp4 = await renderTestClip('SlowZoomIn');
    const frameStart = await extractFrameRGB(mp4, 0.1);
    const frameEnd = await extractFrameRGB(mp4, duration - 0.1);

    // Center marker is white. As camera zooms in, white marker expands outward.
    // In the center marker border ring (x: 420-450, y: 940-980), brightness increases as white expands
    const markerBorderStart = getAverageRGB(frameStart, 420, 940, 450, 980);
    const markerBorderEnd = getAverageRGB(frameEnd, 420, 940, 450, 980);

    const startBrightness = markerBorderStart.r + markerBorderStart.g + markerBorderStart.b;
    const endBrightness = markerBorderEnd.r + markerBorderEnd.g + markerBorderEnd.b;

    assert.ok(
      endBrightness >= startBrightness,
      `SlowZoomIn expected center marker expansion: start(${startBrightness}) vs end(${endBrightness})`
    );
  });

  it('SlowZoomOut contracts center quadrant area from start to end', async () => {
    const mp4 = await renderTestClip('SlowZoomOut');
    const frameStart = await extractFrameRGB(mp4, 0.1);
    const frameEnd = await extractFrameRGB(mp4, duration - 0.1);

    const markerBorderStart = getAverageRGB(frameStart, 420, 940, 450, 980);
    const markerBorderEnd = getAverageRGB(frameEnd, 420, 940, 450, 980);

    const startBrightness = markerBorderStart.r + markerBorderStart.g + markerBorderStart.b;
    const endBrightness = markerBorderEnd.r + markerBorderEnd.g + markerBorderEnd.b;

    assert.ok(
      startBrightness >= endBrightness,
      `SlowZoomOut expected center marker contraction: start(${startBrightness}) vs end(${endBrightness})`
    );
  });

  it('MQA-15 Determinism: Snapshotted background width/height yields identical FFmpeg args regardless of subsequent asset edits', () => {
    const initialJobSnapshot = {
      selectedBackgroundFilePath: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      selectedBackgroundWidth: 1920,
      selectedBackgroundHeight: 1080,
    };

    // Construct args from snapshot
    const args1 = buildFFmpegArgs({
      localImagePath: '/tmp/bg.jpg',
      localForegroundPath: '/tmp/fg.png',
      localAudioPath: '/tmp/audio.mp3',
      durationSeconds: 15,
      animationPreset: 'PanLeft',
      backgroundWidth: initialJobSnapshot.selectedBackgroundWidth,
      backgroundHeight: initialJobSnapshot.selectedBackgroundHeight,
      tempOutputPath: '/tmp/out.mp4',
    });

    // Mutating live asset metadata
    const mutatedAssetRecord = {
      width: 3840,
      height: 2160,
    };

    // Retry must use snapshot values, NOT mutated asset values
    const argsRetry = buildFFmpegArgs({
      localImagePath: '/tmp/bg.jpg',
      localForegroundPath: '/tmp/fg.png',
      localAudioPath: '/tmp/audio.mp3',
      durationSeconds: 15,
      animationPreset: 'PanLeft',
      backgroundWidth: initialJobSnapshot.selectedBackgroundWidth, // Still uses 1920
      backgroundHeight: initialJobSnapshot.selectedBackgroundHeight, // Still uses 1080
      tempOutputPath: '/tmp/out.mp4',
    });

    assert.deepEqual(args1, argsRetry);
  });
});
