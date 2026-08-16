import test from 'node:test';
import assert from 'node:assert';
import { processStage, selectEligibleMusicCandidates, clearMusicAssetCache } from '../services/content-pipeline.service.js';
import { jobRepository } from '../repositories/job.repository.js';
import { assetRepository } from '../repositories/asset.repository.js';
import { musicSelectionStateRepository } from '../repositories/musicSelectionState.repository.js';
import { videoService } from '../services/video.service.js';
import { systemConfigCache } from '../config/system-config.cache.js';
import { PipelineStage, AssetType, AssetStatus, LicenseStatus } from '@prisma/client';
import { ValidationError } from '../errors/custom-errors.js';

test('CFG-03 & CFG-04: Music Deterministic Rotation and Compliant Fallback Tests', async (t) => {
  const mockWorkspaceId = '00000000-0000-0000-0000-000000000001';
  const mockJobId = '00000000-0000-0000-0000-000000000002';

  const origGet = systemConfigCache.get;

  t.beforeEach(() => {
    clearMusicAssetCache();
    systemConfigCache.get = (async () => ({ defaultWatermark: '@publishiq' })) as any;
  });

  t.afterEach(() => {
    systemConfigCache.get = origGet;
  });

  const mockMusicAssets = [
    {
      id: '00000000-0000-0000-0000-000000000010',
      workspaceId: mockWorkspaceId,
      name: 'Track A',
      type: AssetType.Music,
      status: AssetStatus.Active,
      licenseStatus: LicenseStatus.Confirmed,
      filePath: 'https://cloudinary.com/track_a.mp3',
      metadata: { mood: 'Calm', genre: 'Acoustic' },
    },
    {
      id: '00000000-0000-0000-0000-000000000020',
      workspaceId: mockWorkspaceId,
      name: 'Track B',
      type: AssetType.Music,
      status: AssetStatus.Active,
      licenseStatus: LicenseStatus.Confirmed,
      filePath: 'https://cloudinary.com/track_b.mp3',
      metadata: { mood: 'Calm', genre: 'Acoustic' },
    },
    {
      id: '00000000-0000-0000-0000-000000000030',
      workspaceId: mockWorkspaceId,
      name: 'Track C',
      type: AssetType.Music,
      status: AssetStatus.Active,
      licenseStatus: LicenseStatus.Confirmed,
      filePath: 'https://cloudinary.com/track_c.mp3',
      metadata: { mood: 'Calm', genre: 'Acoustic' },
    },
  ];

  await t.test('selectEligibleMusicCandidates: filters active, confirmed license tracks by mood and genre', () => {
    const mixed = [
      ...mockMusicAssets,
      {
        id: 'unconfirmed-1',
        workspaceId: mockWorkspaceId,
        name: 'Unconfirmed Track',
        type: AssetType.Music,
        status: AssetStatus.Active,
        licenseStatus: LicenseStatus.Unconfirmed,
        filePath: 'https://cloudinary.com/unconf.mp3',
        metadata: { mood: 'Calm', genre: 'Acoustic' },
      },
      {
        id: 'disabled-1',
        workspaceId: mockWorkspaceId,
        name: 'Disabled Track',
        type: AssetType.Music,
        status: AssetStatus.Disabled,
        licenseStatus: LicenseStatus.Confirmed,
        filePath: 'https://cloudinary.com/disabled.mp3',
        metadata: { mood: 'Calm', genre: 'Acoustic' },
      },
      {
        id: 'different-mood-1',
        workspaceId: mockWorkspaceId,
        name: 'Energetic Track',
        type: AssetType.Music,
        status: AssetStatus.Active,
        licenseStatus: LicenseStatus.Confirmed,
        filePath: 'https://cloudinary.com/energetic.mp3',
        metadata: { mood: 'Energetic', genre: 'Rock' },
      },
    ];

    const candidates = selectEligibleMusicCandidates(mixed as any, 'Calm', 'Acoustic');
    assert.strictEqual(candidates.length, 3);
    assert.deepStrictEqual(candidates.map((c) => c.id).sort(), [
      '00000000-0000-0000-0000-000000000010',
      '00000000-0000-0000-0000-000000000020',
      '00000000-0000-0000-0000-000000000030',
    ].sort());
  });

  await t.test('CFG-03: AttachingMusic rotates deterministically across 3 eligible candidates', async () => {
    const origGetJob = jobRepository.getById;
    const origTransition = jobRepository.transitionJobStage;
    const origListAssets = assetRepository.list;
    const origGetLastSelected = musicSelectionStateRepository.getLastSelected;
    const origUpsertLastSelected = musicSelectionStateRepository.upsertLastSelected;

    let inMemoryLastSelected: string | null = null;
    const selectedHistory: string[] = [];

    try {
      assetRepository.list = async () => mockMusicAssets as any;
      musicSelectionStateRepository.getLastSelected = async () => (
        inMemoryLastSelected ? { id: 'state-1', workspaceId: mockWorkspaceId, mood: 'Calm', genre: 'Acoustic', lastSelectedAssetId: inMemoryLastSelected, updatedAt: new Date() } : null
      );
      musicSelectionStateRepository.upsertLastSelected = async (ws, mood, genre, assetId) => {
        inMemoryLastSelected = assetId;
        return { id: 'state-1', workspaceId: ws, mood, genre, lastSelectedAssetId: assetId, updatedAt: new Date() };
      };

      jobRepository.getById = async () => ({
        id: mockJobId,
        workspaceId: mockWorkspaceId,
        pipelineStage: PipelineStage.AttachingMusic,
        configSnapshot: {
          musicSelectionRules: { mood: 'Calm', genre: 'Acoustic' },
        },
        contentProfile: {
          musicSelectionRules: { mood: 'Calm', genre: 'Acoustic' },
        },
      } as any);

      jobRepository.transitionJobStage = async (id, stage, data) => {
        if ((data.configSnapshot as any)?.selectedMusicAssetId) {
          selectedHistory.push((data.configSnapshot as any).selectedMusicAssetId);
        }
        return { id, pipelineStage: stage, ...data } as any;
      };

      // Run 1: Should pick Track A (first)
      await processStage(mockJobId, PipelineStage.AttachingMusic);
      // Run 2: Should pick Track B (second)
      await processStage(mockJobId, PipelineStage.AttachingMusic);
      // Run 3: Should pick Track C (third)
      await processStage(mockJobId, PipelineStage.AttachingMusic);
      // Run 4: Should wrap around to Track A (first)
      await processStage(mockJobId, PipelineStage.AttachingMusic);

      assert.deepStrictEqual(selectedHistory, [
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000020',
        '00000000-0000-0000-0000-000000000030',
        '00000000-0000-0000-0000-000000000010',
      ]);
    } finally {
      jobRepository.getById = origGetJob;
      jobRepository.transitionJobStage = origTransition;
      assetRepository.list = origListAssets;
      musicSelectionStateRepository.getLastSelected = origGetLastSelected;
      musicSelectionStateRepository.upsertLastSelected = origUpsertLastSelected;
    }
  });

  await t.test('CFG-03: AttachingMusic with 1 candidate works without error', async () => {
    const singleCandidate = [mockMusicAssets[0]!];
    const origGetJob = jobRepository.getById;
    const origTransition = jobRepository.transitionJobStage;
    const origListAssets = assetRepository.list;
    const origGetLastSelected = musicSelectionStateRepository.getLastSelected;
    const origUpsertLastSelected = musicSelectionStateRepository.upsertLastSelected;

    try {
      assetRepository.list = async () => singleCandidate as any;
      musicSelectionStateRepository.getLastSelected = async () => ({
        id: 'state-1',
        workspaceId: mockWorkspaceId,
        mood: 'Calm',
        genre: 'Acoustic',
        lastSelectedAssetId: singleCandidate[0]!.id,
        updatedAt: new Date(),
      });
      musicSelectionStateRepository.upsertLastSelected = async (ws, mood, genre, assetId) => ({
        id: 'state-1',
        workspaceId: ws,
        mood,
        genre,
        lastSelectedAssetId: assetId,
        updatedAt: new Date(),
      });

      let selectedId: string | null = null;
      jobRepository.getById = async () => ({
        id: mockJobId,
        workspaceId: mockWorkspaceId,
        pipelineStage: PipelineStage.AttachingMusic,
        configSnapshot: {
          musicSelectionRules: { mood: 'Calm', genre: 'Acoustic' },
        },
        contentProfile: {},
      } as any);

      jobRepository.transitionJobStage = async (id, stage, data) => {
        selectedId = (data.configSnapshot as any)?.selectedMusicAssetId;
        return { id, pipelineStage: stage, ...data } as any;
      };

      await processStage(mockJobId, PipelineStage.AttachingMusic);
      assert.strictEqual(selectedId, singleCandidate[0]!.id);
    } finally {
      jobRepository.getById = origGetJob;
      jobRepository.transitionJobStage = origTransition;
      assetRepository.list = origListAssets;
      musicSelectionStateRepository.getLastSelected = origGetLastSelected;
      musicSelectionStateRepository.upsertLastSelected = origUpsertLastSelected;
    }
  });

  await t.test('CFG-04: RenderingVideo fallback selects only mood/genre/license-compliant Cloudinary candidates', async () => {
    const origGetJob = jobRepository.getById;
    const origTransition = jobRepository.transitionJobStage;
    const origListAssets = assetRepository.list;
    const origRenderVideo = videoService.renderVideo;

    let renderedMusicPath: string | null = null;

    try {
      assetRepository.list = async () => [
        // An unconfirmed track with Cloudinary path - MUST NOT BE PICKED
        {
          id: 'unconfirmed-cloud',
          workspaceId: mockWorkspaceId,
          name: 'Unconfirmed Cloud',
          type: AssetType.Music,
          status: AssetStatus.Active,
          licenseStatus: LicenseStatus.Unconfirmed,
          filePath: 'https://cloudinary.com/unconfirmed.mp3',
          metadata: { mood: 'Calm', genre: 'Acoustic' },
        },
        // An active, confirmed track with wrong mood - MUST NOT BE PICKED
        {
          id: 'wrong-mood-cloud',
          workspaceId: mockWorkspaceId,
          name: 'Wrong Mood Cloud',
          type: AssetType.Music,
          status: AssetStatus.Active,
          licenseStatus: LicenseStatus.Confirmed,
          filePath: 'https://cloudinary.com/wrong_mood.mp3',
          metadata: { mood: 'Energetic', genre: 'Rock' },
        },
        // Valid compliant fallback track
        mockMusicAssets[1]!,
      ] as any;

      jobRepository.getById = async () => ({
        id: mockJobId,
        workspaceId: mockWorkspaceId,
        pipelineStage: PipelineStage.RenderingVideo,
        imageUrl: 'https://cloudinary.com/image.png',
        configSnapshot: {
          selectedMusicFilePath: '/local/disk/path.mp3', // local non-URL path triggers fallback
          musicSelectionRules: { mood: 'Calm', genre: 'Acoustic' },
        },
        contentProfile: {},
      } as any);

      jobRepository.transitionJobStage = async (id, stage, data) => ({
        id,
        pipelineStage: stage,
        ...data,
      } as any);

      videoService.renderVideo = async (jobId, imageUrl, musicPath, duration) => {
        renderedMusicPath = musicPath;
        return 'https://cloudinary.com/video.mp4';
      };

      await processStage(mockJobId, PipelineStage.RenderingVideo);

      assert.strictEqual(
        renderedMusicPath,
        mockMusicAssets[1]!.filePath,
        'Should fallback to the compliant active, confirmed track matching mood/genre'
      );
    } finally {
      jobRepository.getById = origGetJob;
      jobRepository.transitionJobStage = origTransition;
      assetRepository.list = origListAssets;
      videoService.renderVideo = origRenderVideo;
    }
  });

  await t.test('CFG-04: RenderingVideo fallback fails with ValidationError if no compliant candidate exists', async () => {
    const origGetJob = jobRepository.getById;
    const origListAssets = assetRepository.list;

    try {
      assetRepository.list = async () => [
        // Only an unconfirmed track is available
        {
          id: 'unconfirmed-only',
          workspaceId: mockWorkspaceId,
          name: 'Unconfirmed Only',
          type: AssetType.Music,
          status: AssetStatus.Active,
          licenseStatus: LicenseStatus.Unconfirmed,
          filePath: 'https://cloudinary.com/unconf.mp3',
          metadata: { mood: 'Calm', genre: 'Acoustic' },
        },
      ] as any;

      jobRepository.getById = async () => ({
        id: mockJobId,
        workspaceId: mockWorkspaceId,
        pipelineStage: PipelineStage.RenderingVideo,
        imageUrl: 'https://cloudinary.com/image.png',
        configSnapshot: {
          selectedMusicFilePath: '/local/path.mp3',
          musicSelectionRules: { mood: 'Calm', genre: 'Acoustic' },
        },
        contentProfile: {},
      } as any);

      await assert.rejects(
        async () => {
          await processStage(mockJobId, PipelineStage.RenderingVideo);
        },
        (err: any) => {
          assert(err instanceof ValidationError, 'Should throw ValidationError');
          assert(err.message.includes('no compliant fallback candidate exists'), 'Should explain missing compliant fallback');
          return true;
        }
      );
    } finally {
      jobRepository.getById = origGetJob;
      assetRepository.list = origListAssets;
    }
  });
});
