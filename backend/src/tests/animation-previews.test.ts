import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { contentProfileService } from '../services/contentProfile.service.js';
import { contentProfileController } from '../controllers/contentProfile.controller.js';
import {
  DEFAULT_ANIMATION_PREVIEW_URLS,
  SAMPLE_PREVIEW_TEXT,
  SAMPLE_PREVIEW_BRANDING,
  SAMPLE_PREVIEW_DURATION_SECONDS,
} from '../constants/animation-previews.js';
import { PREVIEW_ANIMATION_PRESETS } from '../scripts/generate-animation-previews.js';
import { systemConfigCache } from '../config/system-config.cache.js';
import { buildZoompanExpression, buildFFmpegArgs, AnimationPreset } from '../services/video.service.js';
import { renderDefaultQuoteTemplate } from '../templates/DefaultQuoteTemplate.js';

describe('Animation Previews & Ahead-of-Time Generation Test Suite', () => {

  describe('Preset Coverage & Constants Integrity', () => {
    it('should include all 6 active motion presets in PREVIEW_ANIMATION_PRESETS', () => {
      const expected: AnimationPreset[] = [
        'SlowZoomIn',
        'SlowZoomOut',
        'PanLeft',
        'PanRight',
        'PanUp',
        'PanDown',
      ];
      assert.deepEqual(PREVIEW_ANIMATION_PRESETS, expected);
      assert.equal(PREVIEW_ANIMATION_PRESETS.length, 6);
    });

    it('should have default/fallback Cloudinary preview URLs for all 6 presets', () => {
      for (const preset of PREVIEW_ANIMATION_PRESETS) {
        const url = DEFAULT_ANIMATION_PREVIEW_URLS[preset];
        assert.ok(url, `Missing default preview URL for preset: ${preset}`);
        assert.ok(url.startsWith('https://res.cloudinary.com/'), `URL must be a valid Cloudinary path: ${url}`);
        assert.ok(url.toLowerCase().includes(`preview_${preset.toLowerCase()}`), `URL must point to preset mp4: ${url}`);
      }
    });

    it('should define generic preview sample placeholder constants', () => {
      assert.equal(SAMPLE_PREVIEW_TEXT, 'Your quote appears here.');
      assert.equal(SAMPLE_PREVIEW_BRANDING, 'PUBLISHIQ');
      assert.equal(SAMPLE_PREVIEW_DURATION_SECONDS, 5);
    });
  });

  describe('Service: contentProfileService.getAnimationPreviews', () => {
    it('should return fallback DEFAULT_ANIMATION_PREVIEW_URLS when system configuration is empty', async () => {
      const origGet = systemConfigCache.get;
      try {
        systemConfigCache.get = (async () => undefined) as any;
        const previews = await contentProfileService.getAnimationPreviews();
        assert.deepEqual(previews, DEFAULT_ANIMATION_PREVIEW_URLS);
      } finally {
        systemConfigCache.get = origGet;
      }
    });

    it('should return cached system configuration preview URLs when present', async () => {
      const origGet = systemConfigCache.get;
      const customUrls = {
        SlowZoomIn: 'https://res.cloudinary.com/custom/video/upload/zoom_in.mp4',
        SlowZoomOut: 'https://res.cloudinary.com/custom/video/upload/zoom_out.mp4',
        PanLeft: 'https://res.cloudinary.com/custom/video/upload/pan_left.mp4',
        PanRight: 'https://res.cloudinary.com/custom/video/upload/pan_right.mp4',
        PanUp: 'https://res.cloudinary.com/custom/video/upload/pan_up.mp4',
        PanDown: 'https://res.cloudinary.com/custom/video/upload/pan_down.mp4',
      };

      try {
        systemConfigCache.get = (async (key: string) => {
          if (key === 'animation_preview_urls') return customUrls;
          return undefined;
        }) as any;

        const previews = await contentProfileService.getAnimationPreviews();
        assert.deepEqual(previews, customUrls);
      } finally {
        systemConfigCache.get = origGet;
      }
    });
  });

  describe('Controller: contentProfileController.getAnimationPreviews', () => {
    it('should return standardized API response with success: true and preview mappings', async () => {
      const origGet = systemConfigCache.get;
      try {
        systemConfigCache.get = (async () => DEFAULT_ANIMATION_PREVIEW_URLS) as any;
        let jsonPayload: any = null;
        const req: any = { workspaceId: '00000000-0000-0000-0000-000000000001' };
        const res: any = {
          json(data: any) {
            jsonPayload = data;
          },
        };
        const next = (err: any) => {
          if (err) throw err;
        };

        await contentProfileController.getAnimationPreviews(req, res, next);

        assert.ok(jsonPayload);
        assert.equal(jsonPayload.success, true);
        assert.ok(jsonPayload.data);
        for (const preset of PREVIEW_ANIMATION_PRESETS) {
          assert.ok(jsonPayload.data[preset], `Response data missing preset: ${preset}`);
        }
      } finally {
        systemConfigCache.get = origGet;
      }
    });
  });

  describe('Real Pipeline Verification for Preview Generation', () => {
    it('should render layered template HTML with sample placeholder text and pan overscan for preview generator', () => {
      for (const preset of PREVIEW_ANIMATION_PRESETS) {
        const bgHtml = renderDefaultQuoteTemplate({
          text: SAMPLE_PREVIEW_TEXT,
          language: 'English',
          branding: SAMPLE_PREVIEW_BRANDING,
          backgroundImageUrl: 'https://images.unsplash.com/sample_bg.jpg',
          layer: 'background',
          animationPreset: preset,
        });

        const fgHtml = renderDefaultQuoteTemplate({
          text: SAMPLE_PREVIEW_TEXT,
          language: 'English',
          branding: SAMPLE_PREVIEW_BRANDING,
          layer: 'foreground',
          animationPreset: preset,
        });

        assert.ok(bgHtml.includes('class="background-layer"'));
        if (['PanLeft', 'PanRight', 'PanUp', 'PanDown'].includes(preset)) {
          assert.ok(bgHtml.includes('background-size: 130%'));
        } else {
          assert.ok(bgHtml.includes('background-size: cover'));
        }

        assert.ok(fgHtml.includes(SAMPLE_PREVIEW_TEXT));
        assert.ok(fgHtml.includes('background-color: transparent'));
      }
    });

    it('should compile valid FFmpeg args with zoompan, overlay, CRF 18, and slow preset for each preview preset', () => {
      for (const preset of PREVIEW_ANIMATION_PRESETS) {
        const args = buildFFmpegArgs({
          localImagePath: '/tmp/sample_bg.png',
          localForegroundPath: '/tmp/sample_fg.png',
          localAudioPath: '/tmp/sample_audio.mp3',
          durationSeconds: SAMPLE_PREVIEW_DURATION_SECONDS,
          animationPreset: preset,
          tempOutputPath: `/tmp/preview_${preset}.mp4`,
        });

        assert.equal(args[0], '-y');
        assert.ok(args.includes('-crf'));
        assert.equal(args[args.indexOf('-crf') + 1], '18');
        assert.ok(args.includes('-preset'));
        assert.equal(args[args.indexOf('-preset') + 1], 'slow');

        const filterIdx = args.indexOf('-filter_complex');
        assert.ok(filterIdx > -1);
        const filterStr = args[filterIdx + 1]!;
        assert.ok(filterStr.includes('overlay=0:0:format=auto'));
        assert.ok(filterStr.includes('flags=lanczos'));

        const zoompan = buildZoompanExpression(preset, SAMPLE_PREVIEW_DURATION_SECONDS);
        assert.ok(zoompan !== null);
        assert.ok(filterStr.includes(zoompan));
      }
    });
  });
});
