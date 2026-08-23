import test from 'node:test';
import assert from 'node:assert';
import { contentProfileService } from '../services/contentProfile.service.js';
import contentProfileRepository from '../repositories/contentProfile.repository.js';
import { assetRepository } from '../repositories/asset.repository.js';
import { prisma } from '../database/db.js';
import { AssetType, AssetStatus, LicenseStatus } from '@prisma/client';

test('P1-03: Content Profile Readiness Health Check Tests', async (t) => {
  const mockWorkspaceId = '00000000-0000-0000-0000-000000000001';
  const mockProfileId = '22222222-2222-2222-2222-222222222222';

  const baseProfile = {
    id: mockProfileId,
    workspaceId: mockWorkspaceId,
    name: 'Tech Motivation Profile',
    status: 'Active',
    promptVersion: {
      id: 'pv-1',
      versionNumber: 1,
      status: 'Active',
      prompt: { status: 'Active' },
    },
    templateVersion: {
      id: 'tv-1',
      versionNumber: 1,
      status: 'Active',
      template: { status: 'Active' },
    },
    backgroundSelectionRules: { selectionMode: 'Off' },
    musicSelectionRules: { mood: 'Inspiring', genre: 'Acoustic' },
  };

  await t.test('returns ready: true when all 5 criteria are fully satisfied', async () => {
    const origGetById = contentProfileRepository.getById;
    const origAssetFindMany = prisma.asset.findMany;
    const origChannelFindMany = prisma.channel.findMany;

    try {
      contentProfileRepository.getById = async () => baseProfile as any;

      (prisma.asset as any).findMany = async (args: any) => {
        if (args.where?.type === AssetType.Music) {
          return [
            {
              id: 'music-1',
              workspaceId: mockWorkspaceId,
              type: AssetType.Music,
              status: AssetStatus.Active,
              licenseStatus: LicenseStatus.Confirmed,
              filePath: 'https://res.cloudinary.com/demo/video/upload/track.mp3',
              metadata: { mood: 'Inspiring', genre: 'Acoustic' },
            },
          ] as any;
        }
        return [];
      };

      (prisma.channel as any).findMany = async () =>
        [
          {
            id: 'channel-1',
            workspaceId: mockWorkspaceId,
            contentProfileId: mockProfileId,
            platformConnections: [
              {
                platformConnection: {
                  healthStatus: 'Healthy',
                  status: 'Active',
                },
              },
            ],
          },
        ] as any;

      const result = await contentProfileService.getProfileReadiness(mockProfileId, mockWorkspaceId);

      assert.strictEqual(result.ready, true);
      assert.strictEqual(result.missing.length, 0);
    } finally {
      contentProfileRepository.getById = origGetById;
      (prisma.asset as any).findMany = origAssetFindMany;
      (prisma.channel as any).findMany = origChannelFindMany;
    }
  });

  await t.test('reports missing prompt when promptVersion is Deprecated', async () => {
    const origGetById = contentProfileRepository.getById;
    const origAssetFindMany = prisma.asset.findMany;
    const origChannelFindMany = prisma.channel.findMany;

    try {
      contentProfileRepository.getById = async () =>
        ({
          ...baseProfile,
          promptVersion: {
            id: 'pv-1',
            versionNumber: 1,
            status: 'Deprecated',
            prompt: { status: 'Active' },
          },
        }) as any;

      (prisma.asset as any).findMany = async () =>
        [
          {
            id: 'music-1',
            type: AssetType.Music,
            status: AssetStatus.Active,
            licenseStatus: LicenseStatus.Confirmed,
            filePath: 'https://res.cloudinary.com/demo/video/upload/track.mp3',
            metadata: { mood: 'Inspiring', genre: 'Acoustic' },
          },
        ] as any;

      (prisma.channel as any).findMany = async () =>
        [
          {
            platformConnections: [
              { platformConnection: { healthStatus: 'Healthy', status: 'Active' } },
            ],
          },
        ] as any;

      const result = await contentProfileService.getProfileReadiness(mockProfileId, mockWorkspaceId);

      assert.strictEqual(result.ready, false);
      assert(result.missing.some((m) => m.includes('Prompt Version')));
    } finally {
      contentProfileRepository.getById = origGetById;
      (prisma.asset as any).findMany = origAssetFindMany;
      (prisma.channel as any).findMany = origChannelFindMany;
    }
  });

  await t.test('reports missing template when template is inactive or missing', async () => {
    const origGetById = contentProfileRepository.getById;
    const origAssetFindMany = prisma.asset.findMany;
    const origChannelFindMany = prisma.channel.findMany;

    try {
      contentProfileRepository.getById = async () =>
        ({
          ...baseProfile,
          templateVersion: {
            id: 'tv-1',
            versionNumber: 1,
            status: 'Active',
            template: { status: 'Disabled' },
          },
        }) as any;

      (prisma.asset as any).findMany = async () =>
        [
          {
            id: 'music-1',
            type: AssetType.Music,
            status: AssetStatus.Active,
            licenseStatus: LicenseStatus.Confirmed,
            filePath: 'https://res.cloudinary.com/demo/video/upload/track.mp3',
            metadata: { mood: 'Inspiring', genre: 'Acoustic' },
          },
        ] as any;

      (prisma.channel as any).findMany = async () =>
        [
          {
            platformConnections: [
              { platformConnection: { healthStatus: 'Healthy', status: 'Active' } },
            ],
          },
        ] as any;

      const result = await contentProfileService.getProfileReadiness(mockProfileId, mockWorkspaceId);

      assert.strictEqual(result.ready, false);
      assert(result.missing.some((m) => m.includes('Template')));
    } finally {
      contentProfileRepository.getById = origGetById;
      (prisma.asset as any).findMany = origAssetFindMany;
      (prisma.channel as any).findMany = origChannelFindMany;
    }
  });

  await t.test('reports missing manual background when manualAssetId is unconfirmed or disabled', async () => {
    const origGetById = contentProfileRepository.getById;
    const origAssetGetById = assetRepository.getById;
    const origAssetFindMany = prisma.asset.findMany;
    const origChannelFindMany = prisma.channel.findMany;

    try {
      contentProfileRepository.getById = async () =>
        ({
          ...baseProfile,
          backgroundSelectionRules: { selectionMode: 'Manual', manualAssetId: 'asset-bg-1' },
        }) as any;

      assetRepository.getById = async () =>
        ({
          id: 'asset-bg-1',
          workspaceId: mockWorkspaceId,
          type: AssetType.Background,
          status: AssetStatus.Active,
          licenseStatus: LicenseStatus.Unconfirmed, // Unconfirmed license
          filePath: 'https://res.cloudinary.com/demo/image/upload/bg.png',
        }) as any;

      (prisma.asset as any).findMany = async () =>
        [
          {
            id: 'music-1',
            type: AssetType.Music,
            status: AssetStatus.Active,
            licenseStatus: LicenseStatus.Confirmed,
            filePath: 'https://res.cloudinary.com/demo/video/upload/track.mp3',
            metadata: { mood: 'Inspiring', genre: 'Acoustic' },
          },
        ] as any;

      (prisma.channel as any).findMany = async () =>
        [
          {
            platformConnections: [
              { platformConnection: { healthStatus: 'Healthy', status: 'Active' } },
            ],
          },
        ] as any;

      const result = await contentProfileService.getProfileReadiness(mockProfileId, mockWorkspaceId);

      assert.strictEqual(result.ready, false);
      assert(result.missing.some((m) => m.includes('manual background asset')));
    } finally {
      contentProfileRepository.getById = origGetById;
      assetRepository.getById = origAssetGetById;
      (prisma.asset as any).findMany = origAssetFindMany;
      (prisma.channel as any).findMany = origChannelFindMany;
    }
  });

  await t.test('reports missing music when no confirmed tracks match mood and genre', async () => {
    const origGetById = contentProfileRepository.getById;
    const origAssetFindMany = prisma.asset.findMany;
    const origChannelFindMany = prisma.channel.findMany;

    try {
      contentProfileRepository.getById = async () => baseProfile as any;

      // Return empty or mismatched music
      (prisma.asset as any).findMany = async () => [];

      (prisma.channel as any).findMany = async () =>
        [
          {
            platformConnections: [
              { platformConnection: { healthStatus: 'Healthy', status: 'Active' } },
            ],
          },
        ] as any;

      const result = await contentProfileService.getProfileReadiness(mockProfileId, mockWorkspaceId);

      assert.strictEqual(result.ready, false);
      assert(result.missing.some((m) => m.includes('music assets match')));
    } finally {
      contentProfileRepository.getById = origGetById;
      (prisma.asset as any).findMany = origAssetFindMany;
      (prisma.channel as any).findMany = origChannelFindMany;
    }
  });

  await t.test('reports missing channel and connection when no channel is linked', async () => {
    const origGetById = contentProfileRepository.getById;
    const origAssetFindMany = prisma.asset.findMany;
    const origChannelFindMany = prisma.channel.findMany;

    try {
      contentProfileRepository.getById = async () => baseProfile as any;

      (prisma.asset as any).findMany = async () =>
        [
          {
            id: 'music-1',
            type: AssetType.Music,
            status: AssetStatus.Active,
            licenseStatus: LicenseStatus.Confirmed,
            filePath: 'https://res.cloudinary.com/demo/video/upload/track.mp3',
            metadata: { mood: 'Inspiring', genre: 'Acoustic' },
          },
        ] as any;

      (prisma.channel as any).findMany = async () => []; // No channels linked

      const result = await contentProfileService.getProfileReadiness(mockProfileId, mockWorkspaceId);

      assert.strictEqual(result.ready, false);
      assert(result.missing.some((m) => m.includes('No Channel is linked')));
    } finally {
      contentProfileRepository.getById = origGetById;
      (prisma.asset as any).findMany = origAssetFindMany;
      (prisma.channel as any).findMany = origChannelFindMany;
    }
  });
});
