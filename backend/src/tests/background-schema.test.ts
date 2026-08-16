import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BackgroundSelectionRulesSchema } from '../schemas/content-profile.schema.js';
import { BackgroundMetadataSchema } from '../schemas/asset.schema.js';
import { AIContentResponseSchema } from '../schemas/ai-response.schema.js';

describe('Background Schema & Validation Tests', () => {
  describe('BackgroundSelectionRulesSchema', () => {
    it('accepts empty object (Off mode default)', () => {
      const parsed = BackgroundSelectionRulesSchema.parse({});
      assert.deepEqual(parsed, {});
      assert.equal(parsed.selectionMode, undefined);
    });

    it('accepts valid Manual mode with manualAssetId', () => {
      const parsed = BackgroundSelectionRulesSchema.parse({
        selectionMode: 'Manual',
        manualAssetId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });
      assert.equal(parsed.selectionMode, 'Manual');
      assert.equal(parsed.manualAssetId, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    });

    it('rejects Manual mode when manualAssetId is missing or empty', () => {
      assert.throws(() => {
        BackgroundSelectionRulesSchema.parse({
          selectionMode: 'Manual',
        });
      }, /manualAssetId/i);

      assert.throws(() => {
        BackgroundSelectionRulesSchema.parse({
          selectionMode: 'Manual',
          manualAssetId: '   ',
        });
      }, /manualAssetId/i);
    });

    it('rejects Manual mode when manualAssetId is not a valid UUID', () => {
      assert.throws(() => {
        BackgroundSelectionRulesSchema.parse({
          selectionMode: 'Manual',
          manualAssetId: 'not-a-uuid',
        });
      }, /Invalid manualAssetId UUID format/i);
    });

    it('accepts valid AI mode with full filter criteria', () => {
      const parsed = BackgroundSelectionRulesSchema.parse({
        selectionMode: 'AI',
        mood: 'Calm',
        style: 'Photo',
        theme: 'Nature',
        tags: ['sunset', 'mountains'],
        orientation: 'portrait',
      });
      assert.equal(parsed.selectionMode, 'AI');
      assert.equal(parsed.mood, 'Calm');
      assert.equal(parsed.style, 'Photo');
      assert.equal(parsed.theme, 'Nature');
      assert.deepEqual(parsed.tags, ['sunset', 'mountains']);
      assert.equal(parsed.orientation, 'portrait');
    });

    it('accepts valid AI mode with minimal criteria', () => {
      const parsed = BackgroundSelectionRulesSchema.parse({
        selectionMode: 'AI',
      });
      assert.equal(parsed.selectionMode, 'AI');
    });

    it('rejects unknown properties due to strict schema mode', () => {
      assert.throws(() => {
        BackgroundSelectionRulesSchema.parse({
          selectionMode: 'AI',
          unknownField: 'illegal',
        });
      });
    });
  });

  describe('BackgroundMetadataSchema', () => {
    it('accepts valid background asset metadata', () => {
      const parsed = BackgroundMetadataSchema.parse({
        width: 1080,
        height: 1920,
        orientation: 'portrait',
        format: 'png',
        bytes: 2048500,
        mood: 'Inspiring',
        style: 'Photo',
        theme: 'Nature',
        tags: ['sunset', 'sky'],
      });
      assert.equal(parsed.width, 1080);
      assert.equal(parsed.height, 1920);
      assert.equal(parsed.orientation, 'portrait');
      assert.equal(parsed.format, 'png');
    });

    it('accepts empty object (default metadata)', () => {
      const parsed = BackgroundMetadataSchema.parse({});
      assert.deepEqual(parsed, {});
    });

    it('rejects invalid orientation value', () => {
      assert.throws(() => {
        BackgroundMetadataSchema.parse({
          orientation: 'diagonal',
        });
      });
    });

    it('rejects negative width or height', () => {
      assert.throws(() => {
        BackgroundMetadataSchema.parse({
          width: -100,
        });
      });
    });

    it('rejects unknown properties in strict mode', () => {
      assert.throws(() => {
        BackgroundMetadataSchema.parse({
          randomProperty: 123,
        });
      });
    });
  });

  describe('AIContentResponseSchema with Background Extension', () => {
    it('accepts AI response containing valid selectedBackgroundAssetId', () => {
      const parsed = AIContentResponseSchema.parse({
        title: 'Inspiring Work',
        quote: 'The only way to do great work is to love what you do.',
        caption: 'Daily wisdom on finding passion.',
        language: 'English',
        contentType: 'Quote',
        selectedBackgroundAssetId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });
      assert.equal(parsed.selectedBackgroundAssetId, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    });

    it('accepts AI response without selectedBackgroundAssetId', () => {
      const parsed = AIContentResponseSchema.parse({
        title: 'Inspiring Work',
        quote: 'The only way to do great work is to love what you do.',
        caption: 'Daily wisdom on finding passion.',
        language: 'English',
        contentType: 'Quote',
      });
      assert.equal(parsed.selectedBackgroundAssetId, undefined);
    });

    it('rejects invalid type in selectedBackgroundAssetId', () => {
      assert.throws(() => {
        AIContentResponseSchema.parse({
          title: 'Inspiring Work',
          quote: 'The only way to do great work is to love what you do.',
          caption: 'Daily wisdom on finding passion.',
          language: 'English',
          contentType: 'Quote',
          selectedBackgroundAssetId: 12345,
        });
      }, /expected string/i);
    });
  });
});
