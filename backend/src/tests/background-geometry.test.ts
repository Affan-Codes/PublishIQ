import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCoverFit,
  computePanOverscan,
  OUTPUT_WIDTH,
  OUTPUT_HEIGHT,
  DEFAULT_PAN_OVERSCAN_FACTOR,
} from '../services/background-geometry.js';

describe('Background Geometry Math Unit Tests (MQA-09)', () => {
  const testMatrix = [
    // Portrait
    { name: 'Exact Output Portrait (1080x1920)', width: 1080, height: 1920 },
    { name: 'Standard HD Portrait (720x1280)', width: 720, height: 1280 },
    { name: '2K Portrait (1440x2560)', width: 1440, height: 2560 },
    { name: 'Tall Portrait (1000x2500)', width: 1000, height: 2500 },

    // Landscape
    { name: 'Standard Full HD Landscape (1920x1080)', width: 1920, height: 1080 },
    { name: '2K Landscape (2560x1440)', width: 2560, height: 1440 },
    { name: '4K Landscape (3840x2160)', width: 3840, height: 2160 },
    { name: 'Low-res Landscape (640x360)', width: 640, height: 360 },

    // Square
    { name: 'Standard Square (1080x1080)', width: 1080, height: 1080 },
    { name: 'High-res Square (2048x2048)', width: 2048, height: 2048 },
    { name: 'Small Square (500x500)', width: 500, height: 500 },

    // Extreme Aspect Ratios
    { name: 'Ultra-wide Panorama (4000x1000)', width: 4000, height: 1000 },
    { name: 'Ultra-tall Skyscraper (1000x4000)', width: 1000, height: 4000 },
  ];

  describe('computeCoverFit', () => {
    testMatrix.forEach(({ name, width, height }) => {
      it(`should compute valid cover-fit for ${name}`, () => {
        const result = computeCoverFit(width, height);

        // 1. Dimensions must be >= 1080x1920
        assert.ok(
          result.coveredWidth >= OUTPUT_WIDTH,
          `coveredWidth (${result.coveredWidth}) must be >= ${OUTPUT_WIDTH}`
        );
        assert.ok(
          result.coveredHeight >= OUTPUT_HEIGHT,
          `coveredHeight (${result.coveredHeight}) must be >= ${OUTPUT_HEIGHT}`
        );

        // 2. Dimensions must be even integers for FFmpeg x264 codec
        assert.equal(result.coveredWidth % 2, 0, `coveredWidth (${result.coveredWidth}) must be even`);
        assert.equal(result.coveredHeight % 2, 0, `coveredHeight (${result.coveredHeight}) must be even`);

        // 3. Aspect ratio must be preserved without stretching
        const sourceAspect = width / height;
        const coveredAspect = result.coveredWidth / result.coveredHeight;
        const aspectDiff = Math.abs(sourceAspect - coveredAspect);
        assert.ok(
          aspectDiff < 0.01,
          `Covered aspect ratio (${coveredAspect}) drifted from source (${sourceAspect}) by ${aspectDiff}`
        );

        // 4. At least one dimension must match or be within 2px of the required scale
        const scaleX = result.coveredWidth / width;
        const scaleY = result.coveredHeight / height;
        assert.ok(scaleX >= result.coverScale - 0.001);
        assert.ok(scaleY >= result.coverScale - 0.001);
      });
    });

    it('should reject non-positive dimensions', () => {
      assert.throws(() => computeCoverFit(0, 1920), /Invalid background dimensions/);
      assert.throws(() => computeCoverFit(1080, -500), /Invalid background dimensions/);
    });
  });

  describe('computePanOverscan', () => {
    testMatrix.forEach(({ name, width, height }) => {
      it(`should compute positive maxPanX and maxPanY with 1.15 overscan for ${name}`, () => {
        const result = computePanOverscan(width, height, OUTPUT_WIDTH, OUTPUT_HEIGHT, DEFAULT_PAN_OVERSCAN_FACTOR);

        // 1. Scaled dimensions must strictly exceed 1080x1920
        assert.ok(
          result.scaledWidth > OUTPUT_WIDTH,
          `scaledWidth (${result.scaledWidth}) must be > ${OUTPUT_WIDTH}`
        );
        assert.ok(
          result.scaledHeight > OUTPUT_HEIGHT,
          `scaledHeight (${result.scaledHeight}) must be > ${OUTPUT_HEIGHT}`
        );

        // 2. maxPanX and maxPanY must be strictly positive
        assert.ok(result.maxPanX > 0, `maxPanX (${result.maxPanX}) must be > 0`);
        assert.ok(result.maxPanY > 0, `maxPanY (${result.maxPanY}) must be > 0`);

        // 3. Dimensions must be even integers
        assert.equal(result.scaledWidth % 2, 0, `scaledWidth (${result.scaledWidth}) must be even`);
        assert.equal(result.scaledHeight % 2, 0, `scaledHeight (${result.scaledHeight}) must be even`);

        // 4. Aspect ratio preserved
        const sourceAspect = width / height;
        const scaledAspect = result.scaledWidth / result.scaledHeight;
        const aspectDiff = Math.abs(sourceAspect - scaledAspect);
        assert.ok(
          aspectDiff < 0.01,
          `Scaled aspect ratio (${scaledAspect}) drifted from source (${sourceAspect}) by ${aspectDiff}`
        );
      });
    });

    it('should reject overscan factors <= 1.0', () => {
      assert.throws(() => computePanOverscan(1920, 1080, 1080, 1920, 1.0), /must be strictly greater than 1.0/);
      assert.throws(() => computePanOverscan(1920, 1080, 1080, 1920, 0.9), /must be strictly greater than 1.0/);
    });
  });
});
