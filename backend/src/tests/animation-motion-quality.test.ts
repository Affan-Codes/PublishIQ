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

const TEST_DIR = path.resolve('./scratch/test_animation_motion_quality');
const PRESETS: AnimationPreset[] = [
  'None',
  'SlowZoomIn',
  'SlowZoomOut',
  'PanLeft',
  'PanRight',
  'PanUp',
  'PanDown',
];

interface FrameSampleRGB {
  width: number;
  height: number;
  data: Buffer;
}

/**
 * Extracts a specific single RGB frame at given timestamp.
 */
async function extractFrameAtTimestamp(mp4Path: string, timestampSeconds: number): Promise<FrameSampleRGB> {
  const width = 1080;
  const height = 1920;
  const tempBmp = path.join(TEST_DIR, `sample_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.bmp`);

  try {
    await execFilePromise(ffmpegPath, [
      '-y',
      '-ss', timestampSeconds.toFixed(3),
      '-i', mp4Path,
      '-vframes', '1',
      tempBmp,
    ]);
    const buffer = fs.readFileSync(tempBmp);
    const rowSize = Math.floor((24 * width + 31) / 32) * 4;
    const rgbData = Buffer.alloc(width * height * 3);

    for (let y = 0; y < height; y++) {
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

    return { width, height, data: rgbData };
  } finally {
    if (fs.existsSync(tempBmp)) {
      try { fs.unlinkSync(tempBmp); } catch {}
    }
  }
}

/**
 * Computes average RGB values in a bounding box region [x1..x2, y1..y2].
 */
function getRegionAverageRGB(
  frame: FrameSampleRGB,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { r: number; g: number; b: number } {
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

/**
 * Extracts all decoded raw video frames at downscaled resolution for high-speed frame-to-frame difference analysis.
 */
async function extractAllRawFrames(
  mp4Path: string,
  width: number = 135,
  height: number = 240
): Promise<Buffer[]> {
  const args = [
    '-i', mp4Path,
    '-vf', `scale=${width}:${height}`,
    '-f', 'rawvideo',
    '-pix_fmt', 'rgb24',
    'pipe:1',
  ];

  const { stdout } = await execFilePromise(ffmpegPath, args, {
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  });

  const frameSizeBytes = width * height * 3;
  const numFrames = Math.floor(stdout.length / frameSizeBytes);
  const frames: Buffer[] = [];

  for (let i = 0; i < numFrames; i++) {
    frames.push(stdout.subarray(i * frameSizeBytes, (i + 1) * frameSizeBytes));
  }

  return frames;
}

/**
 * Computes average absolute pixel difference per channel [0..255].
 */
function computeFrameDifference(frameA: Buffer, frameB: Buffer): number {
  let totalDiff = 0;
  const len = frameA.length;
  for (let i = 0; i < len; i++) {
    totalDiff += Math.abs(frameA[i]! - frameB[i]!);
  }
  return totalDiff / len;
}

describe('Phase 4 — Animation Motion Quality & Frame Timing Test Suite (AEN-01 through AEN-09)', () => {
  let fixtureBmpPath: string;
  let audioPath: string;
  let fgPath: string;
  const durationSeconds = 2; // 2 seconds @ 30fps = 60 frames
  const renderedClips = new Map<AnimationPreset, string>();

  before(async () => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }

    // 1. Create directional fixture: 1200x1600 BMP
    fixtureBmpPath = path.join(TEST_DIR, 'directional_fixture_1200x1600.bmp');
    createDirectionalFixtureBMP(fixtureBmpPath, 1200, 1600);

    // 2. Create silent audio
    audioPath = path.join(TEST_DIR, 'test_audio.aac');
    await execFilePromise(ffmpegPath, [
      '-y',
      '-f', 'lavfi',
      '-i', 'anullsrc=r=44100:cl=stereo',
      '-t', durationSeconds.toString(),
      '-c:a', 'aac',
      audioPath,
    ]);

    // 3. Create transparent foreground plate
    fgPath = path.join(TEST_DIR, 'test_fg.png');
    await execFilePromise(ffmpegPath, [
      '-y',
      '-f', 'lavfi',
      '-i', 'color=c=black@0.0:s=1080x1920,format=rgba',
      '-vframes', '1',
      fgPath,
    ]);

    // 4. Pre-render all 7 preset clips
    for (const preset of PRESETS) {
      const mp4Path = path.join(TEST_DIR, `${preset}.mp4`);
      const args = buildFFmpegArgs({
        localImagePath: fixtureBmpPath,
        localForegroundPath: fgPath,
        localAudioPath: audioPath,
        durationSeconds,
        animationPreset: preset,
        backgroundWidth: 1200,
        backgroundHeight: 1600,
        tempOutputPath: mp4Path,
      });

      await execFilePromise(ffmpegPath, args);
      renderedClips.set(preset, mp4Path);
    }
  });

  after(() => {
    try {
      if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('AEN-02: Zoom Input Demuxer Regression Guard', () => {
    it('SlowZoomIn and SlowZoomOut bgInputArgs must NOT contain -framerate or -loop flags', () => {
      for (const preset of ['SlowZoomIn', 'SlowZoomOut'] as AnimationPreset[]) {
        const args = buildFFmpegArgs({
          localImagePath: '/tmp/bg.jpg',
          localForegroundPath: '/tmp/fg.png',
          localAudioPath: '/tmp/audio.aac',
          durationSeconds: 15,
          animationPreset: preset,
          tempOutputPath: '/tmp/out.mp4',
        });

        // Find the index of the first input (-i /tmp/bg.jpg)
        const bgIndex = args.indexOf('/tmp/bg.jpg');
        assert.ok(bgIndex > 0, 'Background image must be in args');

        const priorArgs = args.slice(0, bgIndex);
        assert.ok(
          !priorArgs.includes('-loop'),
          `Zoom preset ${preset} must NOT have -loop flag before background image input`
        );
        assert.ok(
          !priorArgs.includes('-framerate'),
          `Zoom preset ${preset} must NOT have -framerate flag before background image input`
        );
      }
    });

    it('Pan presets and None MUST contain explicit -framerate RENDER_FPS before background image input', () => {
      const panPresets: AnimationPreset[] = ['None', 'PanLeft', 'PanRight', 'PanUp', 'PanDown'];
      for (const preset of panPresets) {
        const args = buildFFmpegArgs({
          localImagePath: '/tmp/bg.jpg',
          localForegroundPath: '/tmp/fg.png',
          localAudioPath: '/tmp/audio.aac',
          durationSeconds: 15,
          animationPreset: preset,
          tempOutputPath: '/tmp/out.mp4',
        });

        const bgIndex = args.indexOf('/tmp/bg.jpg');
        assert.ok(bgIndex > 0, 'Background image must be in args');

        const priorArgs = args.slice(0, bgIndex);
        const framerateIdx = priorArgs.indexOf('-framerate');
        assert.ok(framerateIdx > -1, `Preset ${preset} must have -framerate flag before bg image`);
        assert.equal(
          priorArgs[framerateIdx + 1],
          RENDER_FPS.toString(),
          `Preset ${preset} -framerate must equal ${RENDER_FPS}`
        );
      }
    });
  });

  describe('AEN-09: Duplicate-Frame Detection (No 25->30 Stutter Artifacts)', () => {
    it('None preset must be static throughout (all consecutive frame deltas near zero)', async () => {
      const mp4Path = renderedClips.get('None')!;
      const frames = await extractAllRawFrames(mp4Path);
      assert.ok(frames.length >= durationSeconds * RENDER_FPS - 2, `Expected ~60 frames, got ${frames.length}`);

      for (let i = 0; i < frames.length - 1; i++) {
        const diff = computeFrameDifference(frames[i]!, frames[i + 1]!);
        assert.ok(
          diff < 0.2,
          `None preset frame ${i}->${i + 1} expected near-zero delta, got ${diff.toFixed(3)}`
        );
      }
    });

    it('Animated presets must not contain runs of consecutive duplicate frames (>2 zero-delta frames)', async () => {
      const animatedPresets: AnimationPreset[] = [
        'SlowZoomIn',
        'SlowZoomOut',
        'PanLeft',
        'PanRight',
        'PanUp',
        'PanDown',
      ];

      for (const preset of animatedPresets) {
        const mp4Path = renderedClips.get(preset)!;
        const frames = await extractAllRawFrames(mp4Path);
        assert.ok(frames.length >= durationSeconds * RENDER_FPS - 2, `Expected ~60 frames for ${preset}`);

        let consecutiveZeroDeltas = 0;
        let maxConsecutiveZeroDeltas = 0;

        for (let i = 0; i < frames.length - 1; i++) {
          const diff = computeFrameDifference(frames[i]!, frames[i + 1]!);
          // Near-zero threshold for identical duplicated frames
          if (diff < 0.05) {
            consecutiveZeroDeltas++;
            if (consecutiveZeroDeltas > maxConsecutiveZeroDeltas) {
              maxConsecutiveZeroDeltas = consecutiveZeroDeltas;
            }
          } else {
            consecutiveZeroDeltas = 0;
          }
        }

        // In a continuous animated preset at 30fps with smoothstep, motion occurs across frames.
        // At most near the extreme initial/final tick or rounding might 1-2 frames have minimal movement,
        // but never a stutter run > 2 duplicate frames.
        assert.ok(
          maxConsecutiveZeroDeltas <= 2,
          `Preset ${preset} had ${maxConsecutiveZeroDeltas} consecutive duplicate frames (expected <= 2)`
        );
      }
    });
  });

  describe('AEN-09: Frame-Jump Detection (Smooth Motion Trajectory)', () => {
    it('Animated presets must not have large discontinuous jumps relative to local frame delta', async () => {
      const animatedPresets: AnimationPreset[] = [
        'SlowZoomIn',
        'SlowZoomOut',
        'PanLeft',
        'PanRight',
        'PanUp',
        'PanDown',
      ];

      for (const preset of animatedPresets) {
        const mp4Path = renderedClips.get(preset)!;
        const frames = await extractAllRawFrames(mp4Path);

        const deltas: number[] = [];
        for (let i = 0; i < frames.length - 1; i++) {
          deltas.push(computeFrameDifference(frames[i]!, frames[i + 1]!));
        }

        // Compute average delta excluding near-zero ends
        const activeDeltas = deltas.filter((d) => d > 0.05);
        const avgDelta = activeDeltas.reduce((a, b) => a + b, 0) / activeDeltas.length;

        // Verify that no single frame-to-frame delta is a massive jump (> 3.5x average)
        for (let i = 0; i < deltas.length; i++) {
          const delta = deltas[i]!;
          assert.ok(
            delta <= avgDelta * 3.5,
            `Preset ${preset} frame ${i}->${i + 1} had jump ${delta.toFixed(2)} vs avg ${avgDelta.toFixed(2)}`
          );
        }
      }
    });
  });

  describe('AEN-09: Easing-Shape Verification (Ease-in-out Signature)', () => {
    it('Pan presets exhibit ease-in-out: rate of displacement is smaller near endpoints than middle', async () => {
      // Sample 5 points: 0%, 25%, 50%, 75%, 100%
      const t0 = 0.05;
      const t25 = 0.50;
      const t50 = 1.00;
      const t75 = 1.50;
      const t100 = 1.95;

      // PanLeft: Camera moves Right-to-Left (Top shifts from Blue to Red)
      const panLeftMp4 = renderedClips.get('PanLeft')!;
      const pl0 = await extractFrameAtTimestamp(panLeftMp4, t0);
      const pl25 = await extractFrameAtTimestamp(panLeftMp4, t25);
      const pl50 = await extractFrameAtTimestamp(panLeftMp4, t50);
      const pl75 = await extractFrameAtTimestamp(panLeftMp4, t75);
      const pl100 = await extractFrameAtTimestamp(panLeftMp4, t100);

      // Measure Red channel progression in Top region (100, 100, 980, 400)
      const r0 = getRegionAverageRGB(pl0, 100, 100, 980, 400).r;
      const r25 = getRegionAverageRGB(pl25, 100, 100, 980, 400).r;
      const r50 = getRegionAverageRGB(pl50, 100, 100, 980, 400).r;
      const r75 = getRegionAverageRGB(pl75, 100, 100, 980, 400).r;
      const r100 = getRegionAverageRGB(pl100, 100, 100, 980, 400).r;

      const deltaStart = Math.abs(r25 - r0);
      const deltaMid1 = Math.abs(r50 - r25);
      const deltaMid2 = Math.abs(r75 - r50);
      const deltaEnd = Math.abs(r100 - r75);

      // In smoothstep: [0%-25%] delta is ~15.6%, [25%-50%] delta is ~34.4%.
      // Mid delta is more than 1.5x the start delta and end delta.
      assert.ok(
        deltaStart < deltaMid1,
        `PanLeft ease-in expected start delta (${deltaStart.toFixed(1)}) < mid delta (${deltaMid1.toFixed(1)})`
      );
      assert.ok(
        deltaEnd < deltaMid2,
        `PanLeft ease-out expected end delta (${deltaEnd.toFixed(1)}) < mid delta (${deltaMid2.toFixed(1)})`
      );
    });

    it('Zoom presets exhibit ease-in-out: rate of zoom is smaller near endpoints than middle', async () => {
      const t0 = 0.05;
      const t25 = 0.50;
      const t50 = 1.00;
      const t75 = 1.50;
      const t100 = 1.95;

      const zoomInMp4 = renderedClips.get('SlowZoomIn')!;
      const z0 = await extractFrameAtTimestamp(zoomInMp4, t0);
      const z25 = await extractFrameAtTimestamp(zoomInMp4, t25);
      const z50 = await extractFrameAtTimestamp(zoomInMp4, t50);
      const z75 = await extractFrameAtTimestamp(zoomInMp4, t75);
      const z100 = await extractFrameAtTimestamp(zoomInMp4, t100);

      // Center marker border expansion (420..450, 940..980)
      const b0 = getRegionAverageRGB(z0, 420, 940, 450, 980).r;
      const b25 = getRegionAverageRGB(z25, 420, 940, 450, 980).r;
      const b50 = getRegionAverageRGB(z50, 420, 940, 450, 980).r;
      const b75 = getRegionAverageRGB(z75, 420, 940, 450, 980).r;
      const b100 = getRegionAverageRGB(z100, 420, 940, 450, 980).r;

      const deltaStart = Math.abs(b25 - b0);
      const deltaMid = Math.abs(b75 - b25) / 2;
      const deltaEnd = Math.abs(b100 - b75);

      assert.ok(
        deltaStart <= deltaMid,
        `SlowZoomIn ease-in expected start delta (${deltaStart.toFixed(1)}) <= mid delta (${deltaMid.toFixed(1)})`
      );
      assert.ok(
        deltaEnd <= deltaMid,
        `SlowZoomIn ease-out expected end delta (${deltaEnd.toFixed(1)}) <= mid delta (${deltaMid.toFixed(1)})`
      );
    });
  });

  describe('AEN-01: Pan Travel Distance Verification (No Shortfall)', () => {
    it('Pan presets reach full travel distance by final frame (no 25fps truncation shortfall)', async () => {
      // PanRight moves left to right (x goes from 0 to maxPanX)
      // At start (t=0.05), Top region is Red (start).
      // At end (t=1.95), Top region is Blue (end).
      const panRightMp4 = renderedClips.get('PanRight')!;
      const startFrame = await extractFrameAtTimestamp(panRightMp4, 0.05);
      const endFrame = await extractFrameAtTimestamp(panRightMp4, 1.95);

      const topStart = getRegionAverageRGB(startFrame, 100, 100, 980, 400);
      const topEnd = getRegionAverageRGB(endFrame, 100, 100, 980, 400);

      // Verified: start is dominantly Red, end reaches dominant Blue
      assert.ok(topStart.r > 150, `PanRight start Top should be Red (got R=${topStart.r.toFixed(1)})`);
      assert.ok(topEnd.b > 150, `PanRight end Top should be Blue (got B=${topEnd.b.toFixed(1)})`);
    });
  });

  describe('AEN-08: Determinism & Retry Behavior', () => {
    it('Repeated calls produce identical FFmpeg argument arrays and deterministic expressions', () => {
      const params = {
        localImagePath: '/tmp/test.jpg',
        localForegroundPath: '/tmp/fg.png',
        localAudioPath: '/tmp/audio.aac',
        durationSeconds: 10,
        animationPreset: 'PanLeft' as AnimationPreset,
        backgroundWidth: 1920,
        backgroundHeight: 1080,
        tempOutputPath: '/tmp/out.mp4',
      };

      const run1 = buildFFmpegArgs(params);
      const run2 = buildFFmpegArgs(params);
      assert.deepEqual(run1, run2);
    });
  });
});
