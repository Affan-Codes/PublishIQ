import test from 'node:test';
import assert from 'node:assert/strict';
import { processStage, clearBackgroundAssetCache } from '../services/content-pipeline.service.js';
import { jobRepository } from '../repositories/job.repository.js';
import { assetRepository } from '../repositories/asset.repository.js';
import { geminiProvider } from '../providers/ai/gemini.provider.js';
import { systemConfigCache } from '../config/system-config.cache.js';
import { PipelineStage, AssetType, AssetStatus, LicenseStatus } from '@prisma/client';

test('Background Image Pipeline: ResolvingBackground Stage Tests', async (t) => {
  const mockWorkspaceId = '00000000-0000-0000-0000-000000000001';
  const mockJobId = '00000000-0000-0000-0000-000000000002';
  const mockPromptVersionId = '00000000-0000-0000-0000-000000000003';
  const mockTemplateVersionId = '00000000-0000-0000-0000-000000000004';
  const mockContentTypeId = '00000000-0000-0000-0000-000000000005';

  const mockBackgroundAssets = [
    {
      id: '00000000-0000-0000-0000-000000000010',
      workspaceId: mockWorkspaceId,
      name: 'Calm Nature Background',
      type: AssetType.Background,
      status: AssetStatus.Active,
      licenseStatus: LicenseStatus.Confirmed,
      filePath: 'https://res.cloudinary.com/demo/image/upload/v1/nature.jpg',
      metadata: { mood: 'Calm', style: 'Photo', theme: 'Nature', orientation: 'portrait' },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '00000000-0000-0000-0000-000000000020',
      workspaceId: mockWorkspaceId,
      name: 'Dark Texture Background',
      type: AssetType.Background,
      status: AssetStatus.Active,
      licenseStatus: LicenseStatus.Confirmed,
      filePath: 'https://res.cloudinary.com/demo/image/upload/v1/texture.jpg',
      metadata: { mood: 'Dark', style: 'Texture', theme: 'Abstract', orientation: 'portrait' },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '00000000-0000-0000-0000-000000000099',
      workspaceId: mockWorkspaceId,
      name: 'Untrusted Domain Background',
      type: AssetType.Background,
      status: AssetStatus.Active,
      licenseStatus: LicenseStatus.Confirmed,
      filePath: 'https://evil.site/malicious.jpg',
      metadata: { mood: 'Dark' },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const origGet = systemConfigCache.get;
  const origGetById = jobRepository.getById;
  const origTransitionJobStage = jobRepository.transitionJobStage;
  const origAssetGetById = assetRepository.getById;
  const origAssetList = assetRepository.list;

  t.beforeEach(() => {
    clearBackgroundAssetCache();
    systemConfigCache.get = (async (key?: string) => {
      if (key === 'background_catalog.max_size') return 40;
      if (key === 'retry_limit.background_ai_selection') return 2;
      return { defaultWatermark: '@publishiq' };
    }) as any;
  });

  t.afterEach(() => {
    systemConfigCache.get = origGet;
    jobRepository.getById = origGetById;
    jobRepository.transitionJobStage = origTransitionJobStage;
    assetRepository.getById = origAssetGetById;
    assetRepository.list = origAssetList;
  });

  await t.test('Off mode / empty rules: short-circuits as no-op and transitions stage', async () => {
    let transitionedStage: any = null;

    jobRepository.getById = async () => ({
      id: mockJobId,
      workspaceId: mockWorkspaceId,
      stage: PipelineStage.ResolvingBackground,
      configSnapshot: {
        backgroundSelectionRules: { selectionMode: 'Off' },
      },
      contentProfile: {
        id: 'profile-1',
        name: 'Test Profile',
        workspaceId: mockWorkspaceId,
        language: 'English',
        tone: 'Calm',
        writingStyle: 'Poetic',
        promptVariables: {},
        brandingRules: {},
        watermarkRules: {},
        backgroundSelectionRules: {},
        captionStrategy: {},
        hashtagStrategy: {},
        musicSelectionRules: {},
        renderingConfiguration: {},
        validationRules: {},
        contentTypeId: mockContentTypeId,
        promptVersionId: mockPromptVersionId,
        templateVersionId: mockTemplateVersionId,
        status: 'Active',
      },
    }) as any;

    jobRepository.transitionJobStage = async (_jobId, stage) => {
      transitionedStage = stage;
      return {} as any;
    };

    await processStage(mockJobId, PipelineStage.ResolvingBackground);
    assert.equal(transitionedStage, PipelineStage.ResolvingBackground);
  });

  await t.test('Manual mode: successfully resolves active confirmed Cloudinary asset', async () => {
    let capturedUpdates: any = null;
    let transitionedStage: any = null;

    jobRepository.getById = async () => ({
      id: mockJobId,
      workspaceId: mockWorkspaceId,
      stage: PipelineStage.ResolvingBackground,
      configSnapshot: {
        backgroundSelectionRules: {
          selectionMode: 'Manual',
          manualAssetId: '00000000-0000-0000-0000-000000000010',
        },
      },
      contentProfile: {
        id: 'profile-1',
        name: 'Test Profile',
        workspaceId: mockWorkspaceId,
        language: 'English',
        tone: 'Calm',
        writingStyle: 'Poetic',
        promptVariables: {},
        brandingRules: {},
        watermarkRules: {},
        backgroundSelectionRules: {},
        captionStrategy: {},
        hashtagStrategy: {},
        musicSelectionRules: {},
        renderingConfiguration: {},
        validationRules: {},
        contentTypeId: mockContentTypeId,
        promptVersionId: mockPromptVersionId,
        templateVersionId: mockTemplateVersionId,
        status: 'Active',
      },
    }) as any;

    assetRepository.getById = async (id: string) => {
      return mockBackgroundAssets.find((a) => a.id === id) as any;
    };

    jobRepository.transitionJobStage = async (_jobId, stage, updates) => {
      transitionedStage = stage;
      capturedUpdates = updates;
      return {} as any;
    };

    await processStage(mockJobId, PipelineStage.ResolvingBackground);
    assert.equal(transitionedStage, PipelineStage.ResolvingBackground);
    const snapshot = capturedUpdates?.configSnapshot as Record<string, any>;
    assert.equal(snapshot.selectedBackgroundAssetId, '00000000-0000-0000-0000-000000000010');
    assert.equal(snapshot.selectedBackgroundFilePath, 'https://res.cloudinary.com/demo/image/upload/v1/nature.jpg');
  });

  await t.test('Manual mode: rejects asset from untrusted domain with zero fallback', async () => {
    jobRepository.getById = async () => ({
      id: mockJobId,
      workspaceId: mockWorkspaceId,
      stage: PipelineStage.ResolvingBackground,
      configSnapshot: {
        backgroundSelectionRules: {
          selectionMode: 'Manual',
          manualAssetId: '00000000-0000-0000-0000-000000000099',
        },
      },
      contentProfile: {
        id: 'profile-1',
        name: 'Test Profile',
        workspaceId: mockWorkspaceId,
        language: 'English',
        tone: 'Calm',
        writingStyle: 'Poetic',
        promptVariables: {},
        brandingRules: {},
        watermarkRules: {},
        backgroundSelectionRules: {},
        captionStrategy: {},
        hashtagStrategy: {},
        musicSelectionRules: {},
        renderingConfiguration: {},
        validationRules: {},
        contentTypeId: mockContentTypeId,
        promptVersionId: mockPromptVersionId,
        templateVersionId: mockTemplateVersionId,
        status: 'Active',
      },
    }) as any;

    assetRepository.getById = async (id: string) => {
      return mockBackgroundAssets.find((a) => a.id === id) as any;
    };

    await assert.rejects(async () => {
      await processStage(mockJobId, PipelineStage.ResolvingBackground);
    }, /trusted Cloudinary/i);
  });

  await t.test('AI mode: resolves initial valid AI selection immediately', async () => {
    let capturedUpdates: any = null;

    jobRepository.getById = async () => ({
      id: mockJobId,
      workspaceId: mockWorkspaceId,
      stage: PipelineStage.ResolvingBackground,
      configSnapshot: {
        backgroundSelectionRules: {
          selectionMode: 'AI',
          mood: 'Dark',
        },
        aiSelectedBackgroundAssetId: '00000000-0000-0000-0000-000000000020',
      },
      contentProfile: {
        id: 'profile-1',
        name: 'Test Profile',
        workspaceId: mockWorkspaceId,
        language: 'English',
        tone: 'Dark',
        writingStyle: 'Poetic',
        promptVariables: {},
        brandingRules: {},
        watermarkRules: {},
        backgroundSelectionRules: {},
        captionStrategy: {},
        hashtagStrategy: {},
        musicSelectionRules: {},
        renderingConfiguration: {},
        validationRules: {},
        contentTypeId: mockContentTypeId,
        promptVersionId: mockPromptVersionId,
        templateVersionId: mockTemplateVersionId,
        status: 'Active',
      },
    }) as any;

    assetRepository.list = async () => mockBackgroundAssets as any;
    jobRepository.transitionJobStage = async (_jobId, _stage, updates) => {
      capturedUpdates = updates;
      return {} as any;
    };

    await processStage(mockJobId, PipelineStage.ResolvingBackground);
    const snapshot = capturedUpdates?.configSnapshot as Record<string, any>;
    assert.equal(snapshot.selectedBackgroundAssetId, '00000000-0000-0000-0000-000000000020');
    assert.equal(snapshot.selectedBackgroundFilePath, 'https://res.cloudinary.com/demo/image/upload/v1/texture.jpg');
  });

  await t.test('AI mode: recovers via selectBestBackgroundMatch when initial selection was missing or invalid', async () => {
    let capturedUpdates: any = null;
    const origSelectMatch = geminiProvider.selectBestBackgroundMatch;

    geminiProvider.selectBestBackgroundMatch = async () => '00000000-0000-0000-0000-000000000010';

    try {
      jobRepository.getById = async () => ({
        id: mockJobId,
        workspaceId: mockWorkspaceId,
        stage: PipelineStage.ResolvingBackground,
        configSnapshot: {
          backgroundSelectionRules: { selectionMode: 'AI' },
          generatedText: 'Peace begins with a smile.',
          aiSelectedBackgroundAssetId: 'invalid-non-matching-id',
        },
        contentProfile: {
          id: 'profile-1',
          name: 'Test Profile',
          workspaceId: mockWorkspaceId,
          language: 'English',
          tone: 'Calm',
          writingStyle: 'Poetic',
          promptVariables: {},
          brandingRules: {},
          watermarkRules: {},
          backgroundSelectionRules: {},
          captionStrategy: {},
          hashtagStrategy: {},
          musicSelectionRules: {},
          renderingConfiguration: {},
          validationRules: {},
          contentTypeId: mockContentTypeId,
          promptVersionId: mockPromptVersionId,
          templateVersionId: mockTemplateVersionId,
          status: 'Active',
        },
      }) as any;

      assetRepository.list = async () => mockBackgroundAssets as any;
      jobRepository.transitionJobStage = async (_jobId, _stage, updates) => {
        capturedUpdates = updates;
        return {} as any;
      };

      await processStage(mockJobId, PipelineStage.ResolvingBackground);
      const snapshot = capturedUpdates?.configSnapshot as Record<string, any>;
      assert.equal(snapshot.selectedBackgroundAssetId, '00000000-0000-0000-0000-000000000010');
      assert.equal(snapshot.selectedBackgroundFilePath, 'https://res.cloudinary.com/demo/image/upload/v1/nature.jpg');
    } finally {
      if (origSelectMatch) {
        geminiProvider.selectBestBackgroundMatch = origSelectMatch;
      }
    }
  });

  await t.test('AI mode: throws clean error with zero fallback when candidates are empty', async () => {
    jobRepository.getById = async () => ({
      id: mockJobId,
      workspaceId: mockWorkspaceId,
      stage: PipelineStage.ResolvingBackground,
      configSnapshot: {
        backgroundSelectionRules: { selectionMode: 'AI' },
      },
      contentProfile: {
        id: 'profile-1',
        name: 'Test Profile',
        workspaceId: mockWorkspaceId,
        language: 'English',
        tone: 'Calm',
        writingStyle: 'Poetic',
        promptVariables: {},
        brandingRules: {},
        watermarkRules: {},
        backgroundSelectionRules: {},
        captionStrategy: {},
        hashtagStrategy: {},
        musicSelectionRules: {},
        renderingConfiguration: {},
        validationRules: {},
        contentTypeId: mockContentTypeId,
        promptVersionId: mockPromptVersionId,
        templateVersionId: mockTemplateVersionId,
        status: 'Active',
      },
    }) as any;

    assetRepository.list = async () => [];

    await assert.rejects(async () => {
      await processStage(mockJobId, PipelineStage.ResolvingBackground);
    }, /No eligible background assets/i);
  });

  await t.test('Stage Idempotency: re-running ResolvingBackground preserves existing selection without re-executing', async () => {
    let capturedUpdates: any = null;

    jobRepository.getById = async () => ({
      id: mockJobId,
      workspaceId: mockWorkspaceId,
      stage: PipelineStage.ResolvingBackground,
      configSnapshot: {
        backgroundSelectionRules: { selectionMode: 'Manual', manualAssetId: '00000000-0000-0000-0000-000000000010' },
        selectedBackgroundAssetId: '00000000-0000-0000-0000-000000000010',
        selectedBackgroundFilePath: 'https://res.cloudinary.com/demo/image/upload/v1/nature.jpg',
      },
      contentProfile: {
        id: 'profile-1',
        name: 'Test Profile',
        workspaceId: mockWorkspaceId,
        language: 'English',
        tone: 'Calm',
        writingStyle: 'Poetic',
        promptVariables: {},
        brandingRules: {},
        watermarkRules: {},
        backgroundSelectionRules: {},
        captionStrategy: {},
        hashtagStrategy: {},
        musicSelectionRules: {},
        renderingConfiguration: {},
        validationRules: {},
        contentTypeId: mockContentTypeId,
        promptVersionId: mockPromptVersionId,
        templateVersionId: mockTemplateVersionId,
        status: 'Active',
      },
    }) as any;

    jobRepository.transitionJobStage = async (_jobId, _stage, updates) => {
      capturedUpdates = updates;
      return {} as any;
    };

    await processStage(mockJobId, PipelineStage.ResolvingBackground);
    assert.equal(capturedUpdates?.configSnapshot?.selectedBackgroundAssetId, '00000000-0000-0000-0000-000000000010');
    assert.equal(capturedUpdates?.configSnapshot?.selectedBackgroundFilePath, 'https://res.cloudinary.com/demo/image/upload/v1/nature.jpg');
  });
});
