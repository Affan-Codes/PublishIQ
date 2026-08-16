import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Asset, AssetType, AssetStatus, LicenseStatus } from '@prisma/client';
import {
  selectEligibleBackgroundCandidates,
  buildTruncatedBackgroundCatalog,
  isTrustedCloudinaryUrl,
} from '../services/content-pipeline.service.js';

function createMockAsset(overrides: Partial<Asset>): Asset {
  return {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    workspaceId: 'w0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    name: 'Serene Nature Background',
    type: AssetType.Background,
    status: AssetStatus.Active,
    licenseStatus: LicenseStatus.Confirmed,
    filePath: 'https://res.cloudinary.com/demo/image/upload/v1234567/sample.jpg',
    metadata: {
      width: 1080,
      height: 1920,
      orientation: 'portrait',
      mood: 'Calm',
      style: 'Photo',
      theme: 'Nature',
      tags: ['forest', 'morning'],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('Background Eligibility & AI Catalog Tests', () => {
  describe('selectEligibleBackgroundCandidates', () => {
    it('filters out assets that are not of type Background', () => {
      const bg = createMockAsset({ id: 'bg-1', type: AssetType.Background });
      const music = createMockAsset({ id: 'music-1', type: AssetType.Music });
      const font = createMockAsset({ id: 'font-1', type: AssetType.Font });

      const result = selectEligibleBackgroundCandidates([bg, music, font]);
      assert.equal(result.length, 1);
      assert.equal(result[0]!.id, 'bg-1');
    });

    it('filters out disabled and unconfirmed background assets', () => {
      const activeConfirmed = createMockAsset({
        id: 'bg-active-confirmed',
        status: AssetStatus.Active,
        licenseStatus: LicenseStatus.Confirmed,
      });
      const disabledConfirmed = createMockAsset({
        id: 'bg-disabled',
        status: AssetStatus.Disabled,
        licenseStatus: LicenseStatus.Confirmed,
      });
      const activeUnconfirmed = createMockAsset({
        id: 'bg-unconfirmed',
        status: AssetStatus.Active,
        licenseStatus: LicenseStatus.Unconfirmed,
      });

      const result = selectEligibleBackgroundCandidates([
        activeConfirmed,
        disabledConfirmed,
        activeUnconfirmed,
      ]);
      assert.equal(result.length, 1);
      assert.equal(result[0]!.id, 'bg-active-confirmed');
    });

    it('matches exact mood, style, theme, orientation, and tags when provided', () => {
      const match = createMockAsset({
        id: 'bg-match',
        metadata: {
          mood: 'Calm',
          style: 'Photo',
          theme: 'Nature',
          orientation: 'portrait',
          tags: ['sunset', 'mountain'],
        },
      });
      const differentMood = createMockAsset({
        id: 'bg-diff-mood',
        metadata: {
          mood: 'Vibrant',
          style: 'Photo',
          theme: 'Nature',
          orientation: 'portrait',
          tags: ['sunset'],
        },
      });

      const result = selectEligibleBackgroundCandidates(
        [match, differentMood],
        { mood: 'Calm', style: 'Photo', theme: 'Nature' }
      );
      assert.equal(result.length, 1);
      assert.equal(result[0]!.id, 'bg-match');
    });

    it('falls back to all active confirmed background assets when rule filters yield 0 matches', () => {
      const asset1 = createMockAsset({
        id: 'bg-1',
        metadata: { mood: 'Calm', style: 'Photo' },
      });
      const asset2 = createMockAsset({
        id: 'bg-2',
        metadata: { mood: 'Dark', style: 'Texture' },
      });

      const result = selectEligibleBackgroundCandidates(
        [asset1, asset2],
        { mood: 'Cyberpunk', style: '3D' }
      );
      assert.equal(result.length, 2);
    });
  });

  describe('buildTruncatedBackgroundCatalog', () => {
    it('truncates candidates when count exceeds configured maxSize', () => {
      const candidates: Asset[] = [];
      for (let i = 0; i < 50; i++) {
        candidates.push(
          createMockAsset({
            id: `bg-${i.toString().padStart(2, '0')}`,
            name: `Asset ${i}`,
          })
        );
      }

      const { truncatedCandidates, catalogPayload } = buildTruncatedBackgroundCatalog(candidates, 40);
      assert.equal(truncatedCandidates.length, 40);
      assert.equal(catalogPayload.length, 40);
    });

    it('sanitizes catalogPayload without leaking internal storage URLs', () => {
      const asset = createMockAsset({
        id: 'bg-secure',
        name: 'Private Sunset',
        filePath: 'https://res.cloudinary.com/secret/image/upload/v1/private.jpg',
        metadata: { mood: 'Inspiring', style: 'Gradient', theme: 'Space', tags: ['nebula'] },
      });

      const { catalogPayload } = buildTruncatedBackgroundCatalog([asset], 40);
      assert.equal(catalogPayload.length, 1);
      const item = catalogPayload[0]!;
      assert.equal(item.id, 'bg-secure');
      assert.equal(item.name, 'Private Sunset');
      assert.equal(item.mood, 'Inspiring');
      assert.equal(item.style, 'Gradient');
      assert.equal(item.theme, 'Space');
      assert.deepEqual(item.tags, ['nebula']);
      assert.equal((item as any).filePath, undefined);
    });
  });

  describe('isTrustedCloudinaryUrl', () => {
    it('accepts valid HTTPS Cloudinary URLs', () => {
      assert.equal(
        isTrustedCloudinaryUrl('https://res.cloudinary.com/cloud-name/image/upload/v12345/bg.jpg'),
        true
      );
      assert.equal(
        isTrustedCloudinaryUrl('https://res.cloudinary.com/publishiq/image/upload/sample.png'),
        true
      );
    });

    it('rejects untrusted domains, javascript URLs, and local files', () => {
      assert.equal(isTrustedCloudinaryUrl('https://malicious.domain.com/evil.jpg'), false);
      assert.equal(isTrustedCloudinaryUrl('http://evil-site.com/image.png'), false);
      assert.equal(isTrustedCloudinaryUrl('javascript:alert(1)'), false);
      assert.equal(isTrustedCloudinaryUrl('file:///etc/passwd'), false);
      assert.equal(isTrustedCloudinaryUrl(''), false);
      assert.equal(isTrustedCloudinaryUrl(null as any), false);
    });
  });
});
