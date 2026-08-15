import test from 'node:test';
import assert from 'node:assert';
import { processStage } from '../services/content-pipeline.service.js';
import { jobRepository } from '../repositories/job.repository.js';
import { generatedContentRepository } from '../repositories/generatedContent.repository.js';
import { renderingService } from '../services/rendering.service.js';
import { systemConfigCache } from '../config/system-config.cache.js';
import { PipelineStage, Language } from '@prisma/client';
import { ValidationError } from '../errors/custom-errors.js';

test('CFG-01: Content Profile Branding, Watermark & Validation Rules Tests', async (t) => {
  const mockJobId = '00000000-0000-0000-0000-000000000001';
  const mockWorkspaceId = '00000000-0000-0000-0000-000000000002';

  await t.test('RenderingImage: should pass brandingRules and watermarkRules text to renderingService.renderImage', async () => {
    let capturedOptions: any = null;

    const origGetJob = jobRepository.getById;
    const origTransition = jobRepository.transitionJobStage;
    const origRenderImage = renderingService.renderImage;

    try {
      jobRepository.getById = async () => ({
        id: mockJobId,
        workspaceId: mockWorkspaceId,
        pipelineStage: PipelineStage.RenderingImage,
        generatedText: 'Inspiring Quote',
        configSnapshot: {
          templateVersionId: '00000000-0000-0000-0000-000000000003',
          brandingRules: { text: 'CUSTOM_BRAND_RULE' },
          watermarkRules: { text: '@custom_watermark_rule' },
          language: Language.English,
        },
        contentProfile: {
          language: Language.English,
          templateVersionId: '00000000-0000-0000-0000-000000000003',
          brandingRules: { text: 'FALLBACK_BRAND' },
          watermarkRules: { text: '@fallback_watermark' },
        },
      } as any);

      jobRepository.transitionJobStage = async (id: string, stage: PipelineStage, data: any) => ({
        id,
        pipelineStage: stage,
        ...data,
      } as any);

      renderingService.renderImage = async (id: string, text: string, options: any) => {
        capturedOptions = options;
        return 'https://cloudinary.com/rendered.png';
      };

      await processStage(mockJobId, PipelineStage.RenderingImage);

      assert(capturedOptions !== null, 'renderImage should have been called');
      assert.strictEqual(capturedOptions.branding, 'CUSTOM_BRAND_RULE', 'Should use brandingRules.text');
      assert.strictEqual(capturedOptions.watermark, '@custom_watermark_rule', 'Should use watermarkRules.text');
    } finally {
      jobRepository.getById = origGetJob;
      jobRepository.transitionJobStage = origTransition;
      renderingService.renderImage = origRenderImage;
    }
  });

  await t.test('Validating: should reject content matching profile-specific validationRules.bannedWords', async () => {
    const origGetJob = jobRepository.getById;
    const origTransition = jobRepository.transitionJobStage;
    const origFindByHash = generatedContentRepository.findByTextHash;
    const origGetConfig = systemConfigCache.get;

    try {
      systemConfigCache.get = (async () => ['systembannedword']) as any;
      generatedContentRepository.findByTextHash = async () => null;
      jobRepository.transitionJobStage = async (id, stage, data) => ({ id, pipelineStage: stage, ...data } as any);

      jobRepository.getById = async () => ({
        id: mockJobId,
        workspaceId: mockWorkspaceId,
        pipelineStage: PipelineStage.Validating,
        generatedText: 'This text contains forbiddenwordhere in the sentence',
        configSnapshot: {
          validationRules: {
            bannedWords: ['forbiddenwordhere'],
          },
        },
        contentProfile: {},
      } as any);

      await assert.rejects(
        async () => {
          await processStage(mockJobId, PipelineStage.Validating);
        },
        (err: any) => {
          assert(err instanceof ValidationError, 'Should throw ValidationError');
          assert(err.message.includes('profanity'), 'Should reject text containing banned word');
          return true;
        }
      );
    } finally {
      jobRepository.getById = origGetJob;
      jobRepository.transitionJobStage = origTransition;
      generatedContentRepository.findByTextHash = origFindByHash;
      systemConfigCache.get = origGetConfig;
    }
  });

  await t.test('Validating: base system profanity list is still enforced when validationRules is empty', async () => {
    const origGetJob = jobRepository.getById;
    const origTransition = jobRepository.transitionJobStage;
    const origFindByHash = generatedContentRepository.findByTextHash;
    const origGetConfig = systemConfigCache.get;

    try {
      systemConfigCache.get = (async () => ['shit', 'fuck']) as any;
      generatedContentRepository.findByTextHash = async () => null;
      jobRepository.transitionJobStage = async (id, stage, data) => ({ id, pipelineStage: stage, ...data } as any);

      jobRepository.getById = async () => ({
        id: mockJobId,
        workspaceId: mockWorkspaceId,
        pipelineStage: PipelineStage.Validating,
        generatedText: 'This is a shit quote text',
        configSnapshot: {
          validationRules: {},
        },
        contentProfile: {},
      } as any);

      await assert.rejects(
        async () => {
          await processStage(mockJobId, PipelineStage.Validating);
        },
        (err: any) => {
          assert(err instanceof ValidationError, 'Should throw ValidationError');
          return true;
        }
      );
    } finally {
      jobRepository.getById = origGetJob;
      jobRepository.transitionJobStage = origTransition;
      generatedContentRepository.findByTextHash = origFindByHash;
      systemConfigCache.get = origGetConfig;
    }
  });

  await t.test('Validating: should reject text exceeding validationRules.maxLength', async () => {
    const origGetJob = jobRepository.getById;
    const origTransition = jobRepository.transitionJobStage;
    const origFindByHash = generatedContentRepository.findByTextHash;

    try {
      generatedContentRepository.findByTextHash = async () => null;
      jobRepository.transitionJobStage = async (id, stage, data) => ({ id, pipelineStage: stage, ...data } as any);

      jobRepository.getById = async () => ({
        id: mockJobId,
        workspaceId: mockWorkspaceId,
        pipelineStage: PipelineStage.Validating,
        generatedText: 'A'.repeat(150),
        configSnapshot: {
          validationRules: {
            maxLength: 100,
          },
        },
        contentProfile: {},
      } as any);

      await assert.rejects(
        async () => {
          await processStage(mockJobId, PipelineStage.Validating);
        },
        (err: any) => {
          assert(err instanceof ValidationError, 'Should throw ValidationError');
          assert(err.message.includes('maximum length'), 'Should mention maximum length violation');
          return true;
        }
      );
    } finally {
      jobRepository.getById = origGetJob;
      jobRepository.transitionJobStage = origTransition;
      generatedContentRepository.findByTextHash = origFindByHash;
    }
  });
});
