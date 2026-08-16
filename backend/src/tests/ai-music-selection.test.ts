import test from 'node:test';
import assert from 'node:assert/strict';
import { processStage, selectEligibleMusicCandidates, clearMusicAssetCache } from '../services/content-pipeline.service.js';
import { jobRepository } from '../repositories/job.repository.js';
import { assetRepository } from '../repositories/asset.repository.js';
import { musicSelectionStateRepository } from '../repositories/musicSelectionState.repository.js';
import { geminiProvider } from '../providers/ai/gemini.provider.js';
import { systemConfigCache } from '../config/system-config.cache.js';
import { PipelineStage, AssetType, AssetStatus, LicenseStatus } from '@prisma/client';
import { contentTypeRepository } from '../repositories/contentType.repository.js';

test('PAS-01 & PAS-02: AI-Driven Music Selection & Idempotency Tests', async (t) => {
  const mockWorkspaceId = '00000000-0000-0000-0000-000000000001';
  const mockJobId = '00000000-0000-0000-0000-000000000002';
  const mockPromptVersionId = '00000000-0000-0000-0000-000000000003';
  const mockContentTypeId = '00000000-0000-0000-0000-000000000004';

  const mockMusicAssets = [
    {
      id: '00000000-0000-0000-0000-000000000010',
      workspaceId: mockWorkspaceId,
      name: 'Acoustic Calm 1',
      type: AssetType.Music,
      status: AssetStatus.Active,
      licenseStatus: LicenseStatus.Confirmed,
      filePath: 'https://cloudinary.com/track_1.mp3',
      metadata: { mood: 'Calm', genre: 'Acoustic', internalSecretField: 'secret_123' },
    },
    {
      id: '00000000-0000-0000-0000-000000000020',
      workspaceId: mockWorkspaceId,
      name: 'Acoustic Calm 2',
      type: AssetType.Music,
      status: AssetStatus.Active,
      licenseStatus: LicenseStatus.Confirmed,
      filePath: 'https://cloudinary.com/track_2.mp3',
      metadata: { mood: 'Calm', genre: 'Acoustic' },
    },
    {
      id: '00000000-0000-0000-0000-000000000030',
      workspaceId: mockWorkspaceId,
      name: 'Acoustic Calm 3',
      type: AssetType.Music,
      status: AssetStatus.Active,
      licenseStatus: LicenseStatus.Confirmed,
      filePath: 'https://cloudinary.com/track_3.mp3',
      metadata: { mood: 'Calm', genre: 'Acoustic' },
    },
    {
      id: '00000000-0000-0000-0000-000000000099',
      workspaceId: mockWorkspaceId,
      name: 'Energetic Rock Track',
      type: AssetType.Music,
      status: AssetStatus.Active,
      licenseStatus: LicenseStatus.Confirmed,
      filePath: 'https://cloudinary.com/track_rock.mp3',
      metadata: { mood: 'Energetic', genre: 'Rock' },
    },
  ];

  const origGet = systemConfigCache.get;
  const origFetch = global.fetch;

  t.beforeEach(() => {
    clearMusicAssetCache();
    systemConfigCache.get = (async () => ({ defaultWatermark: '@publishiq' })) as any;
  });

  t.afterEach(() => {
    systemConfigCache.get = origGet;
    global.fetch = origFetch;
  });

  await t.test('PAS-01 Unit: geminiProvider.generate passes through selectedMusicAssetId in metadata', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    global.fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: 'Inspiring Quote Title',
                      quote: 'Believe in yourself and take flight.',
                      caption: 'An inspiring quote on belief.',
                      hashtags: ['#inspiration', '#life', '#growth'],
                      language: 'English',
                      contentType: 'Quote',
                      selectedMusicAssetId: '00000000-0000-0000-0000-000000000020',
                    }),
                  },
                ],
              },
            },
          ],
        }),
      } as any;
    };

    const response = await geminiProvider.generate(
      { body: 'Generate a {{contentType}} in {{language}} with {{musicCatalog}}', versionNumber: 1 },
      { contentType: 'Quote', language: 'English', musicCatalog: '[]' }
    );

    assert.equal(response.text, 'Believe in yourself and take flight.');
    assert.equal(response.metadata?.selectedMusicAssetId, '00000000-0000-0000-0000-000000000020');
  });

  await t.test('PAS-01 Unit: geminiProvider.generate handles omitted selectedMusicAssetId cleanly', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    global.fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: 'Inspiring Quote Title',
                      quote: 'Believe in yourself and take flight.',
                      caption: 'An inspiring quote on belief.',
                      hashtags: ['#inspiration', '#life', '#growth'],
                      language: 'English',
                      contentType: 'Quote',
                    }),
                  },
                ],
              },
            },
          ],
        }),
      } as any;
    };

    const response = await geminiProvider.generate(
      { body: 'Generate a {{contentType}} in {{language}}', versionNumber: 1 },
      { contentType: 'Quote', language: 'English' }
    );

    assert.equal(response.text, 'Believe in yourself and take flight.');
    assert.equal(response.metadata?.selectedMusicAssetId, undefined);
  });

  await t.test('PAS-01 Integration: GeneratingContent formats sanitized catalog (id, name, mood, genre only)', async () => {
    let capturedVariables: Record<string, any> = {};

    const origJobGetById = jobRepository.getById;
    const origGetPromptVersion = jobRepository.getPromptVersionById;
    const origGetContentType = contentTypeRepository.getById;
    const origAssetList = assetRepository.list;
    const origJobTransition = jobRepository.transitionJobStage;
    const origGeminiGenerate = geminiProvider.generate;

    try {
      jobRepository.getById = async () => ({
        id: mockJobId,
        workspaceId: mockWorkspaceId,
        configSnapshot: {
          promptVersionId: mockPromptVersionId,
          musicSelectionRules: { mood: 'Calm', genre: 'Acoustic' },
        },
        contentProfile: {
          contentTypeId: mockContentTypeId,
          language: 'English',
          tone: 'Calm',
          writingStyle: 'Poetic',
        },
      } as any);

      jobRepository.getPromptVersionById = async () => ({
        id: mockPromptVersionId,
        versionNumber: 1,
        body: 'Create quote with {{musicCatalog}}',
      } as any);

      contentTypeRepository.getById = async () => ({ id: mockContentTypeId, name: 'Quote' } as any);
      assetRepository.list = async () => mockMusicAssets as any;

      geminiProvider.generate = async (_prompt, variables) => {
        capturedVariables = variables;
        return {
          text: 'Generated quote text',
          metadata: {
            title: 'Quote Title',
            caption: 'Quote Caption',
            hashtags: ['#tag1', '#tag2', '#tag3'],
            language: 'English',
            contentType: 'Quote',
            selectedMusicAssetId: '00000000-0000-0000-0000-000000000020',
          },
        };
      };

      let persistedData: any = null;
      jobRepository.transitionJobStage = async (_jobId, _stage, data) => {
        persistedData = data;
        return {} as any;
      };

      await processStage(mockJobId, PipelineStage.GeneratingContent);

      assert.ok(capturedVariables.musicCatalog, 'musicCatalog variable must be provided to Gemini');
      const catalog = JSON.parse(capturedVariables.musicCatalog);
      assert.equal(Array.isArray(catalog), true);
      assert.equal(catalog.length, 3, 'Only 3 Calm Acoustic tracks should be in catalog');

      // Verify each entry contains ONLY id, name, mood, genre
      for (const entry of catalog) {
        assert.deepEqual(Object.keys(entry).sort(), ['genre', 'id', 'mood', 'name'].sort());
        assert.equal('filePath' in entry, false, 'filePath must not be leaked to AI catalog');
        assert.equal('licenseStatus' in entry, false, 'licenseStatus must not be in AI catalog');
        assert.equal('internalSecretField' in entry, false, 'internal metadata must not be in AI catalog');
      }

      // Verify aiSelectedMusicAssetId is persisted into configSnapshot
      assert.equal(persistedData.configSnapshot.aiSelectedMusicAssetId, '00000000-0000-0000-0000-000000000020');
    } finally {
      jobRepository.getById = origJobGetById;
      jobRepository.getPromptVersionById = origGetPromptVersion;
      contentTypeRepository.getById = origGetContentType;
      assetRepository.list = origAssetList;
      jobRepository.transitionJobStage = origJobTransition;
      geminiProvider.generate = origGeminiGenerate;
    }
  });

  await t.test('PAS-01 Integration: AttachingMusic uses valid AI-selected asset ID and updates state', async () => {
    const origJobGetById = jobRepository.getById;
    const origAssetList = assetRepository.list;
    const origJobTransition = jobRepository.transitionJobStage;
    const origUpsertLastSelected = musicSelectionStateRepository.upsertLastSelected;

    let upsertedAssetId: string | null = null;
    let transitionedSnapshot: any = null;

    try {
      jobRepository.getById = async () => ({
        id: mockJobId,
        workspaceId: mockWorkspaceId,
        configSnapshot: {
          musicSelectionRules: { mood: 'Calm', genre: 'Acoustic' },
          aiSelectedMusicAssetId: '00000000-0000-0000-0000-000000000020', // Track B (not first candidate Track A)
        },
        contentProfile: {
          musicSelectionRules: { mood: 'Calm', genre: 'Acoustic' },
        },
      } as any);

      assetRepository.list = async () => mockMusicAssets as any;
      musicSelectionStateRepository.upsertLastSelected = async (_wId, _mood, _genre, assetId) => {
        upsertedAssetId = assetId;
        return {} as any;
      };
      jobRepository.transitionJobStage = async (_jobId, _stage, data) => {
        transitionedSnapshot = data.configSnapshot;
        return {} as any;
      };

      await processStage(mockJobId, PipelineStage.AttachingMusic);

      assert.equal(transitionedSnapshot.selectedMusicAssetId, '00000000-0000-0000-0000-000000000020');
      assert.equal(transitionedSnapshot.musicSelectionMethod, 'ai');
      assert.equal(upsertedAssetId, '00000000-0000-0000-0000-000000000020');
    } finally {
      jobRepository.getById = origJobGetById;
      assetRepository.list = origAssetList;
      jobRepository.transitionJobStage = origJobTransition;
      musicSelectionStateRepository.upsertLastSelected = origUpsertLastSelected;
    }
  });

  await t.test('PAS-01 Integration: AttachingMusic falls back to rotation on invalid AI selection', async (st) => {
    const invalidSelections = [
      { label: 'wrong mood/genre track', aiId: '00000000-0000-0000-0000-000000000099' },
      { label: 'nonexistent UUID', aiId: '99999999-9999-9999-9999-999999999999' },
      { label: 'plain name string', aiId: 'Acoustic Calm 2' },
    ];

    const origJobGetById = jobRepository.getById;
    const origAssetList = assetRepository.list;
    const origJobTransition = jobRepository.transitionJobStage;
    const origGetLastSelected = musicSelectionStateRepository.getLastSelected;
    const origUpsertLastSelected = musicSelectionStateRepository.upsertLastSelected;

    try {
      assetRepository.list = async () => mockMusicAssets as any;
      musicSelectionStateRepository.getLastSelected = async () => null;
      musicSelectionStateRepository.upsertLastSelected = async () => ({} as any);

      for (const { label, aiId } of invalidSelections) {
        await st.test(`invalid selection (${label}) falls back to rotation candidate`, async () => {
          let transitionedSnapshot: any = null;

          jobRepository.getById = async () => ({
            id: mockJobId,
            workspaceId: mockWorkspaceId,
            configSnapshot: {
              musicSelectionRules: { mood: 'Calm', genre: 'Acoustic' },
              aiSelectedMusicAssetId: aiId,
            },
            contentProfile: {
              musicSelectionRules: { mood: 'Calm', genre: 'Acoustic' },
            },
          } as any);

          jobRepository.transitionJobStage = async (_jobId, _stage, data) => {
            transitionedSnapshot = data.configSnapshot;
            return {} as any;
          };

          await processStage(mockJobId, PipelineStage.AttachingMusic);

          // Should fall back to first deterministic candidate (Track A)
          assert.equal(transitionedSnapshot.selectedMusicAssetId, '00000000-0000-0000-0000-000000000010');
          assert.equal(transitionedSnapshot.musicSelectionMethod, 'rotation');
        });
      }
    } finally {
      jobRepository.getById = origJobGetById;
      assetRepository.list = origAssetList;
      jobRepository.transitionJobStage = origJobTransition;
      musicSelectionStateRepository.getLastSelected = origGetLastSelected;
      musicSelectionStateRepository.upsertLastSelected = origUpsertLastSelected;
    }
  });

  await t.test('PAS-01 Integration: AttachingMusic with omitted AI selection falls back to rotation cleanly', async () => {
    const origJobGetById = jobRepository.getById;
    const origAssetList = assetRepository.list;
    const origJobTransition = jobRepository.transitionJobStage;
    const origGetLastSelected = musicSelectionStateRepository.getLastSelected;
    const origUpsertLastSelected = musicSelectionStateRepository.upsertLastSelected;

    let transitionedSnapshot: any = null;

    try {
      jobRepository.getById = async () => ({
        id: mockJobId,
        workspaceId: mockWorkspaceId,
        configSnapshot: {
          musicSelectionRules: { mood: 'Calm', genre: 'Acoustic' },
          aiSelectedMusicAssetId: null,
        },
        contentProfile: {
          musicSelectionRules: { mood: 'Calm', genre: 'Acoustic' },
        },
      } as any);

      assetRepository.list = async () => mockMusicAssets as any;
      musicSelectionStateRepository.getLastSelected = async () => null;
      musicSelectionStateRepository.upsertLastSelected = async () => ({} as any);

      jobRepository.transitionJobStage = async (_jobId, _stage, data) => {
        transitionedSnapshot = data.configSnapshot;
        return {} as any;
      };

      await processStage(mockJobId, PipelineStage.AttachingMusic);

      assert.equal(transitionedSnapshot.selectedMusicAssetId, '00000000-0000-0000-0000-000000000010');
      assert.equal(transitionedSnapshot.musicSelectionMethod, 'rotation');
    } finally {
      jobRepository.getById = origJobGetById;
      assetRepository.list = origAssetList;
      jobRepository.transitionJobStage = origJobTransition;
      musicSelectionStateRepository.getLastSelected = origGetLastSelected;
      musicSelectionStateRepository.upsertLastSelected = origUpsertLastSelected;
    }
  });

  await t.test('PAS-02 Integration: AttachingMusic is idempotent across stage re-entry for the same job', async () => {
    const origJobGetById = jobRepository.getById;
    const origAssetList = assetRepository.list;
    const origJobTransition = jobRepository.transitionJobStage;
    const origGetLastSelected = musicSelectionStateRepository.getLastSelected;
    const origUpsertLastSelected = musicSelectionStateRepository.upsertLastSelected;

    let upsertCount = 0;
    let currentJobSnapshot: any = {
      musicSelectionRules: { mood: 'Calm', genre: 'Acoustic' },
      aiSelectedMusicAssetId: null,
    };

    try {
      jobRepository.getById = async () => ({
        id: mockJobId,
        workspaceId: mockWorkspaceId,
        configSnapshot: currentJobSnapshot,
        contentProfile: {
          musicSelectionRules: { mood: 'Calm', genre: 'Acoustic' },
        },
      } as any);

      assetRepository.list = async () => mockMusicAssets as any;
      musicSelectionStateRepository.getLastSelected = async () => null;
      musicSelectionStateRepository.upsertLastSelected = async () => {
        upsertCount++;
        return {} as any;
      };

      jobRepository.transitionJobStage = async (_jobId, _stage, data) => {
        currentJobSnapshot = data.configSnapshot;
        return {} as any;
      };

      // Call 1: First entry into AttachingMusic
      await processStage(mockJobId, PipelineStage.AttachingMusic);
      assert.equal(upsertCount, 1, 'First entry should perform selection and upsert state');
      const firstSelectedAssetId = currentJobSnapshot.selectedMusicAssetId;
      assert.ok(firstSelectedAssetId);

      // Call 2: Stage re-entry / retry for the same job
      await processStage(mockJobId, PipelineStage.AttachingMusic);
      assert.equal(upsertCount, 1, 'Re-entry should NOT advance rotation state again');
      assert.equal(currentJobSnapshot.selectedMusicAssetId, firstSelectedAssetId, 'Re-entry must keep the identical selected asset');
    } finally {
      jobRepository.getById = origJobGetById;
      assetRepository.list = origAssetList;
      jobRepository.transitionJobStage = origJobTransition;
      musicSelectionStateRepository.getLastSelected = origGetLastSelected;
      musicSelectionStateRepository.upsertLastSelected = origUpsertLastSelected;
    }
  });
});
