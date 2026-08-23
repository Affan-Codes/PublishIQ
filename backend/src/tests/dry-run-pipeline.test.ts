import test from 'node:test';
import assert from 'node:assert';
import { PipelineStage, JobType } from '@prisma/client';
import { runContentPipeline } from '../services/content-pipeline.service.js';
import { jobRepository } from '../repositories/job.repository.js';
import { generatedContentRepository } from '../repositories/generatedContent.repository.js';
import { publishingService } from '../services/publishing.service.js';
import { geminiProvider } from '../providers/ai/gemini.provider.js';
import { renderingService } from '../services/rendering.service.js';
import { videoService } from '../services/video.service.js';
import { getNormalizedHash } from '../utils/normalization.js';

import { contentTypeRepository } from '../repositories/contentType.repository.js';
import { assetRepository } from '../repositories/asset.repository.js';
import { musicSelectionStateRepository } from '../repositories/musicSelectionState.repository.js';
import { systemConfigCache } from '../config/system-config.cache.js';
import { AssetType, AssetStatus, LicenseStatus } from '@prisma/client';

test('P1-01: Dry Run / Test Run Pipeline Execution Tests', async (t) => {
  const mockWorkspaceId = '00000000-0000-0000-0000-000000000001';
  const mockJobId = '11111111-1111-1111-1111-111111111111';

  await t.test('dry-run job executes all generation stages and completes without publishing', async () => {
    const origGetById = jobRepository.getById;
    const origGetPromptVersion = jobRepository.getPromptVersionById;
    const origTransition = jobRepository.transitionJobStage;
    const origSaveGenContent = jobRepository.saveGeneratedContent;
    const origFindByJobId = generatedContentRepository.findByJobId;
    const origFindByTextHash = generatedContentRepository.findByTextHash;
    const origGetContentType = contentTypeRepository.getById;
    const origAssetList = assetRepository.list;
    const origGetLastSelected = musicSelectionStateRepository.getLastSelected;
    const origUpsertLastSelected = musicSelectionStateRepository.upsertLastSelected;
    const origSysConfigGet = systemConfigCache.get;
    const origGenerate = geminiProvider.generate;
    const origRenderImage = renderingService.renderImage;
    const origRenderVideo = videoService.renderVideo;
    const origPublish = publishingService.publishJobContent;

    let publishCalled = false;
    let finalStage: PipelineStage | null = null;
    let savedContentHash: string | null = null;
    let jobCompletedEventPayload: any = null;

    let currentJob: any = {
      id: mockJobId,
      workspaceId: mockWorkspaceId,
      jobType: JobType.ContentPipeline,
      isDryRun: true,
      pipelineStage: PipelineStage.Draft,
      generatedText: null,
      imageUrl: null,
      videoUrl: null,
      caption: null,
      hashtags: null,
      configSnapshot: {
        promptVersionId: 'pv-1',
        templateVersionId: 'tv-1',
        templateDefinition: {
          layout: { safeAreaInsetsPx: { topPx: 140, bottomPx: 160, leftPx: 80, rightPx: 80 } },
          compatibility: { supportedBlockTypes: ['heading', 'body'], supportedRoles: ['default'], minBlocks: 1, maxBlocks: 5 },
        },
        backgroundSelectionRules: { selectionMode: 'Off' },
        musicSelectionRules: { mood: 'Inspiring', genre: 'Acoustic' },
      },
      contentProfile: {
        id: '22222222-2222-2222-2222-222222222222',
        promptVersionId: 'pv-1',
        contentTypeId: 'ct-1',
        language: 'English',
        tone: 'Inspirational',
        writingStyle: 'Concise',
        backgroundSelectionRules: { selectionMode: 'Off' },
        musicSelectionRules: { mood: 'Inspiring', genre: 'Acoustic' },
      },
    };

    try {
      jobRepository.getById = async () => currentJob;
      jobRepository.getPromptVersionById = async () =>
        ({ id: 'pv-1', body: 'Generate wisdom for today.', versionNumber: 1, status: 'Active' }) as any;
      contentTypeRepository.getById = async () => ({ id: 'ct-1', name: 'Quote' }) as any;

      assetRepository.list = async () =>
        [
          {
            id: 'music-1',
            workspaceId: mockWorkspaceId,
            name: 'Inspiring Acoustic Track',
            type: AssetType.Music,
            status: AssetStatus.Active,
            licenseStatus: LicenseStatus.Confirmed,
            filePath: 'https://res.cloudinary.com/demo/video/upload/v1/track.mp3',
            metadata: { mood: 'Inspiring', genre: 'Acoustic' },
          },
        ] as any;

      musicSelectionStateRepository.getLastSelected = async () => null;
      musicSelectionStateRepository.upsertLastSelected = async () => ({} as any);

      systemConfigCache.get = async (key: string) => {
        if (key === 'default_video_duration_seconds') return 15 as any;
        if (key === 'retry_limit.duplicate_regeneration') return 5 as any;
        if (key === 'retry_limit.template_incompatibility_regeneration') return 3 as any;
        return undefined;
      };

      jobRepository.transitionJobStage = async (id: string, stage: PipelineStage, data: any, event?: any) => {
        currentJob = { ...currentJob, pipelineStage: stage, ...data };
        if (stage === PipelineStage.Completed) {
          finalStage = stage;
          jobCompletedEventPayload = event?.payload;
        }
        return currentJob;
      };

      generatedContentRepository.findByJobId = async () => null;
      generatedContentRepository.findByTextHash = async () => null;

      jobRepository.saveGeneratedContent = async (data: any) => {
        savedContentHash = data.textHash;
        return { id: '33333333-3333-3333-3333-333333333333', ...data };
      };

      geminiProvider.generate = async () => ({
        text: 'Wisdom is the daughter of experience.',
        blocks: [{ type: 'body', role: 'default', runs: [{ text: 'Wisdom is the daughter of experience.' }] }],
        metadata: { caption: 'Quote of the day', hashtags: ['wisdom', 'quotes'] },
      });

      renderingService.renderImage = async () => ({
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/mock.png',
      });
      videoService.renderVideo = async () => 'https://res.cloudinary.com/demo/video/upload/v1/mock.mp4';

      publishingService.publishJobContent = async () => {
        publishCalled = true;
      };

      await runContentPipeline(mockJobId);

      // Verify publishing was skipped
      assert.strictEqual(publishCalled, false, 'Publishing service should NEVER be called in dry run');
      assert.strictEqual(finalStage, PipelineStage.Completed, 'Job should reach Completed stage');
      assert.strictEqual(jobCompletedEventPayload?.isDryRun, true, 'Event payload should flag isDryRun: true');

      // Verify generated text and media are populated
      assert.strictEqual(currentJob.generatedText, 'Wisdom is the daughter of experience.');
      assert.strictEqual(currentJob.imageUrl, 'https://res.cloudinary.com/demo/image/upload/v1/mock.png');
      assert.strictEqual(currentJob.videoUrl, 'https://res.cloudinary.com/demo/video/upload/v1/mock.mp4');

      // Verify textHash is saved
      assert.strictEqual(savedContentHash, getNormalizedHash('Wisdom is the daughter of experience.'));
    } finally {
      jobRepository.getById = origGetById;
      jobRepository.getPromptVersionById = origGetPromptVersion;
      jobRepository.transitionJobStage = origTransition;
      jobRepository.saveGeneratedContent = origSaveGenContent;
      generatedContentRepository.findByJobId = origFindByJobId;
      generatedContentRepository.findByTextHash = origFindByTextHash;
      contentTypeRepository.getById = origGetContentType;
      assetRepository.list = origAssetList;
      musicSelectionStateRepository.getLastSelected = origGetLastSelected;
      musicSelectionStateRepository.upsertLastSelected = origUpsertLastSelected;
      systemConfigCache.get = origSysConfigGet;
      geminiProvider.generate = origGenerate;
      renderingService.renderImage = origRenderImage;
      videoService.renderVideo = origRenderVideo;
      publishingService.publishJobContent = origPublish;
    }
  });

  await t.test('dry-run generated content participates in exact duplicate detection', () => {
    const text = 'The future belongs to those who prepare for it today.';
    const hash = getNormalizedHash(text);
    const textWithWhitespaceAndCaps = '  THE FUTURE BELONGS TO THOSE WHO PREPARE FOR IT TODAY.  ';
    const hashMatch = getNormalizedHash(textWithWhitespaceAndCaps);

    assert.strictEqual(hash, hashMatch, 'Hash must match regardless of whitespace and casing');
  });
});
