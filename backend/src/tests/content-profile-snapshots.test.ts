import test from 'node:test';
import assert from 'node:assert';
import {
  ContentProfileCreateSchema,
  BrandingRulesSchema,
  WatermarkRulesSchema,
  CaptionStrategySchema,
  HashtagStrategySchema,
  MusicSelectionRulesSchema,
  RenderingConfigurationSchema,
  ValidationRulesSchema,
} from '../schemas/content-profile.schema.js';
import { createContentProfileSnapshot } from '../utils/profile-snapshot.js';
import { ContentProfileStatus, Language } from '@prisma/client';

test('CFG-10 & CFG-20: Content Profile Strict Schemas and Config Snapshotting Tests', async (t) => {
  await t.test('CFG-20: Strict sub-schemas should reject unrecognized properties', () => {
    // BrandingRulesSchema rejects unknown property
    const invalidBranding = BrandingRulesSchema.safeParse({
      text: 'My Brand',
      unknownField: 'bad',
    });
    assert.strictEqual(invalidBranding.success, false, 'BrandingRulesSchema should reject unknown property');

    // WatermarkRulesSchema rejects unknown property
    const invalidWatermark = WatermarkRulesSchema.safeParse({
      text: '@watermark',
      invalidKey: 123,
    });
    assert.strictEqual(invalidWatermark.success, false, 'WatermarkRulesSchema should reject unknown property');

    // ValidationRulesSchema rejects unknown property
    const invalidValidation = ValidationRulesSchema.safeParse({
      bannedWords: ['spam'],
      unknownRule: true,
    });
    assert.strictEqual(invalidValidation.success, false, 'ValidationRulesSchema should reject unknown property');
  });

  await t.test('CFG-20: Valid sub-schemas should parse successfully with strict validation', () => {
    const validBranding = BrandingRulesSchema.safeParse({
      text: 'PUBLISHIQ',
      position: 'bottom-right',
      color: '#FFFFFF',
      opacity: 0.8,
    });
    assert.strictEqual(validBranding.success, true);

    const validMusic = MusicSelectionRulesSchema.safeParse({
      mood: 'Calm',
      genre: 'Acoustic',
      minDurationSeconds: 10,
      maxDurationSeconds: 60,
    });
    assert.strictEqual(validMusic.success, true);
  });

  await t.test('CFG-10: createContentProfileSnapshot accurately preserves all 8 JSON fields and behavioral attributes', () => {
    const mockProfile = {
      id: '00000000-0000-0000-0000-000000000001',
      workspaceId: '00000000-0000-0000-0000-000000000002',
      name: 'Test Profile',
      status: ContentProfileStatus.Active,
      contentTypeId: '00000000-0000-0000-0000-000000000003',
      promptVersionId: '00000000-0000-0000-0000-000000000004',
      templateVersionId: '00000000-0000-0000-0000-000000000005',
      language: Language.Hindi,
      tone: 'Inspirational',
      writingStyle: 'Poetic',
      promptVariables: { author: 'Rumi' },
      brandingRules: { text: 'BRAND_TEXT', position: 'top-left' as const },
      watermarkRules: { text: '@wm', position: 'bottom-left' as const },
      captionStrategy: { template: 'Quote: {{text}}' },
      hashtagStrategy: { tags: ['quote', 'daily'], mode: 'append' as const },
      musicSelectionRules: { mood: 'Calm', genre: 'Acoustic' },
      renderingConfiguration: { resolution: '1080x1920' as const, fps: 30 },
      validationRules: { bannedWords: ['testbad'], maxLength: 300 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const snapshot = createContentProfileSnapshot(mockProfile, { bullJobId: 'job-123' });

    assert.strictEqual(snapshot.promptVersionId, mockProfile.promptVersionId);
    assert.strictEqual(snapshot.templateVersionId, mockProfile.templateVersionId);
    assert.strictEqual(snapshot.language, Language.Hindi);
    assert.strictEqual(snapshot.tone, 'Inspirational');
    assert.strictEqual(snapshot.writingStyle, 'Poetic');
    assert.deepStrictEqual(snapshot.promptVariables, { author: 'Rumi' });
    assert.deepStrictEqual(snapshot.brandingRules, { text: 'BRAND_TEXT', position: 'top-left' });
    assert.deepStrictEqual(snapshot.watermarkRules, { text: '@wm', position: 'bottom-left' });
    assert.deepStrictEqual(snapshot.captionStrategy, { template: 'Quote: {{text}}' });
    assert.deepStrictEqual(snapshot.hashtagStrategy, { tags: ['quote', 'daily'], mode: 'append' });
    assert.deepStrictEqual(snapshot.musicSelectionRules, { mood: 'Calm', genre: 'Acoustic' });
    assert.deepStrictEqual(snapshot.renderingConfiguration, { resolution: '1080x1920', fps: 30 });
    assert.deepStrictEqual(snapshot.validationRules, { bannedWords: ['testbad'], maxLength: 300 });
    assert.strictEqual(snapshot.bullJobId, 'job-123');
  });

  await t.test('createContentProfileSnapshot preserves templateDefinition when templateVersion relation is populated', () => {
    const mockDef = {
      category: 'CodeAnalogy',
      layout: { contentAlign: 'left', verticalAnchor: 'center', maxContentWidthPx: 900, blockGapPx: 32 },
    };

    const profileWithTemplate = {
      id: '00000000-0000-0000-0000-000000000001',
      promptVersionId: '00000000-0000-0000-0000-000000000004',
      templateVersionId: '00000000-0000-0000-0000-000000000005',
      language: Language.English,
      tone: 'Inspiring',
      writingStyle: 'Poetic',
      templateVersion: {
        id: '00000000-0000-0000-0000-000000000005',
        definition: mockDef,
      },
    } as any;

    const snapshot = createContentProfileSnapshot(profileWithTemplate);
    assert.deepStrictEqual(snapshot.templateDefinition, mockDef, 'Must snapshot templateDefinition from templateVersion');
  });
});
