import test from 'node:test';
import assert from 'node:assert/strict';
import { RenderingConfigurationSchema } from '../schemas/content-profile.schema.js';
import { RENDER_FPS } from '../services/video.service.js';
import { OUTPUT_WIDTH, OUTPUT_HEIGHT } from '../services/background-geometry.js';

test('Rendering Configuration Fixed Standards Tests (P0-03, P0-04)', async (t) => {
  await t.test('RENDER_FPS is authoritative 60 FPS constant', () => {
    assert.strictEqual(RENDER_FPS, 60, 'RENDER_FPS must be fixed at 60');
  });

  await t.test('Output dimensions are authoritative 1080x1920 vertical canvas', () => {
    assert.strictEqual(OUTPUT_WIDTH, 1080, 'OUTPUT_WIDTH must be 1080');
    assert.strictEqual(OUTPUT_HEIGHT, 1920, 'OUTPUT_HEIGHT must be 1920');
  });

  await t.test('RenderingConfigurationSchema rejects configurable fps and resolution', () => {
    const valid = { animation: { preset: 'PanLeft' } };
    assert.ok(RenderingConfigurationSchema.safeParse(valid).success);

    const withFps = { fps: 30, animation: { preset: 'None' } };
    assert.strictEqual(
      RenderingConfigurationSchema.safeParse(withFps).success,
      false,
      'RenderingConfigurationSchema must reject configurable fps'
    );

    const withResolution = { resolution: '1080x1920', animation: { preset: 'None' } };
    assert.strictEqual(
      RenderingConfigurationSchema.safeParse(withResolution).success,
      false,
      'RenderingConfigurationSchema must reject configurable resolution'
    );
  });
});
