import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildZoompanExpression, buildFFmpegArgs, AnimationPreset } from '../services/video.service.js';
import { renderDefaultQuoteTemplate } from '../templates/DefaultQuoteTemplate.js';
import { RenderingConfigurationSchema } from '../schemas/content-profile.schema.js';
import { LANGUAGE_SCRIPT_INSTRUCTIONS, geminiResponseSchema } from '../providers/ai/gemini.provider.js';

describe('Animation Quality & Roman Language Architecture Test Suite', () => {

  describe('AQL-01 & AQL-09: Resolution & Quality Enhancements', () => {
    it('should generate template HTML configured for 1080x1920 layout', () => {
      const html = renderDefaultQuoteTemplate({
        text: 'Quality test quote',
        language: 'English',
      });
      assert.ok(html.includes('width: 1080px'));
      assert.ok(html.includes('height: 1920px'));
    });
  });

  describe('AQL-02 & AQL-04: FFmpeg Encoding Quality Flags', () => {
    it('should include -crf 18, -preset slow, and flags=lanczos on layered filter graph', () => {
      const args = buildFFmpegArgs({
        localImagePath: '/tmp/bg.png',
        localForegroundPath: '/tmp/fg.png',
        localAudioPath: '/tmp/audio.mp3',
        durationSeconds: 15,
        animationPreset: 'SlowZoomIn',
        tempOutputPath: '/tmp/out.mp4',
      });

      assert.ok(args.includes('-crf'));
      assert.equal(args[args.indexOf('-crf') + 1], '18');
      assert.ok(args.includes('-preset'));
      assert.equal(args[args.indexOf('-preset') + 1], 'slow');

      const filterIdx = args.indexOf('-filter_complex');
      assert.ok(filterIdx > -1);
      const filterStr = args[filterIdx + 1]!;
      assert.ok(filterStr.includes('flags=lanczos'));
      assert.ok(filterStr.includes('overlay=0:0:format=auto'));
    });

    it('should include -crf 18, -preset slow, and flags=lanczos on single-image fallback graph', () => {
      const args = buildFFmpegArgs({
        localImagePath: '/tmp/full.png',
        localAudioPath: '/tmp/audio.mp3',
        durationSeconds: 15,
        tempOutputPath: '/tmp/out.mp4',
      });

      assert.ok(args.includes('-crf'));
      assert.equal(args[args.indexOf('-crf') + 1], '18');
      assert.ok(args.includes('-preset'));
      assert.equal(args[args.indexOf('-preset') + 1], 'slow');

      const vfIdx = args.indexOf('-vf');
      assert.ok(vfIdx > -1);
      const vfStr = args[vfIdx + 1]!;
      assert.ok(vfStr.includes('scale=1080:1920:flags=lanczos'));
    });
  });

  describe('AQL-03: Duration-Independent Dynamic Zoom Timing (RENDER_FPS = 30)', () => {
    it('should calculate zoom increment inversely proportional to frame count for 5s clip', () => {
      const expr5s = buildZoompanExpression('SlowZoomIn', 5);
      const expectedInc5s = (1.10 - 1.0) / (5 * 30); // 0.10 / 150 = 0.0006666...
      assert.ok(expr5s?.includes(`zoom+${expectedInc5s}`));
      assert.ok(expr5s?.includes(`d=${5 * 30}`));
      assert.ok(expr5s?.includes(`fps=30`));
    });

    it('should calculate zoom increment inversely proportional to frame count for 15s clip', () => {
      const expr15s = buildZoompanExpression('SlowZoomIn', 15);
      const expectedInc15s = (1.10 - 1.0) / (15 * 30); // 0.10 / 450 = 0.0002222...
      assert.ok(expr15s?.includes(`zoom+${expectedInc15s}`));
      assert.ok(expr15s?.includes(`d=${15 * 30}`));
      assert.ok(expr15s?.includes(`fps=30`));
    });

    it('should calculate zoom increment inversely proportional to frame count for 30s clip', () => {
      const expr30s = buildZoompanExpression('SlowZoomIn', 30);
      const expectedInc30s = (1.10 - 1.0) / (30 * 30); // 0.10 / 900 = 0.0001111...
      assert.ok(expr30s?.includes(`zoom+${expectedInc30s}`));
      assert.ok(expr30s?.includes(`d=${30 * 30}`));
      assert.ok(expr30s?.includes(`fps=30`));
    });
  });

  describe('AQL-06: Foreground Template Plate & Dark Gradient Scrim (MQA-01, MQA-02)', () => {
    it('should render transparent foreground plate with scrim and content when layer is foreground', () => {
      const fgHtml = renderDefaultQuoteTemplate({
        text: 'Visible quote text in foreground plate',
        language: 'English',
        layer: 'foreground',
      });

      assert.ok(fgHtml.includes('background-color: transparent'));
      assert.ok(fgHtml.includes('class="overlay-layer"'));
      assert.ok(fgHtml.includes('class="content-layer"'));
      assert.ok(fgHtml.includes('Visible quote text in foreground plate'));
      assert.ok(!fgHtml.includes('class="background-layer"'));
    });

    it('should render full fallback composite with black background when layer is full', () => {
      const fullHtml = renderDefaultQuoteTemplate({
        text: 'Full composite quote text',
        language: 'English',
        layer: 'full',
      });

      assert.ok(fullHtml.includes('background-color: #000000'));
      assert.ok(fullHtml.includes('class="content-layer"'));
      assert.ok(fullHtml.includes('Full composite quote text'));
      assert.ok(!fullHtml.includes('class="background-layer"'));
    });
  });

  describe('AQL-07 & AQL-08: Animation Presets & FFmpeg Expressions (MQA-06, MQA-17)', () => {
    it('should generate valid bounded zoompan expression for SlowZoomIn and SlowZoomOut', () => {
      const zoomIn = buildZoompanExpression('SlowZoomIn', 15);
      assert.ok(zoomIn !== null);
      assert.ok(zoomIn.includes('s=1080x1920:fps=30'));
      assert.ok(zoomIn.includes('d=450'));

      const zoomOut = buildZoompanExpression('SlowZoomOut', 15);
      assert.ok(zoomOut !== null);
      assert.ok(zoomOut.includes('s=1080x1920:fps=30'));
      assert.ok(zoomOut.includes('d=450'));
    });

    it('should return null zoompan expression for None and Pan presets (which use plain crop)', () => {
      const nonZoomPresets: AnimationPreset[] = ['None', 'PanLeft', 'PanRight', 'PanUp', 'PanDown'];
      for (const preset of nonZoomPresets) {
        const expr = buildZoompanExpression(preset, 15);
        assert.equal(expr, null);
      }
    });
  });

  describe('AQL-10: Filter Graph Construction Matrix', () => {
    const testCases: { hasFg: boolean; preset?: AnimationPreset; duration: number }[] = [
      { hasFg: false, duration: 15 },
      { hasFg: true, preset: 'None', duration: 15 },
      { hasFg: true, preset: 'SlowZoomIn', duration: 10 },
      { hasFg: true, preset: 'SlowZoomOut', duration: 20 },
      { hasFg: true, preset: 'PanLeft', duration: 12 },
      { hasFg: true, preset: 'PanRight', duration: 15 },
      { hasFg: true, preset: 'PanUp', duration: 18 },
      { hasFg: true, preset: 'PanDown', duration: 25 },
    ];

    testCases.forEach(({ hasFg, preset, duration }, index) => {
      it(`should build correct FFmpeg args for configuration #${index}`, () => {
        const args = buildFFmpegArgs({
          localImagePath: '/tmp/bg.png',
          localForegroundPath: hasFg ? '/tmp/fg.png' : undefined,
          localAudioPath: '/tmp/audio.mp3',
          durationSeconds: duration,
          animationPreset: preset,
          tempOutputPath: '/tmp/output.mp4',
        });

        assert.equal(args[0], '-y');
        assert.ok(args.includes('-crf'));
        assert.equal(args[args.indexOf('-crf') + 1], '18');
        assert.ok(args.includes('-preset'));
        assert.equal(args[args.indexOf('-preset') + 1], 'slow');

        if (hasFg) {
          assert.ok(args.includes('-filter_complex'));
          assert.ok(args.includes('-map'));
          assert.ok(args.includes('[outv]'));
          assert.ok(args.includes('2:a'));
        } else {
          assert.ok(args.includes('-vf'));
          assert.ok(!args.includes('-filter_complex'));
        }
      });
    });
  });

  describe('AQL-11: RenderingConfigurationSchema Validation', () => {
    it('should validate valid animation presets', () => {
      const validConfig = {
        resolution: '1080x1920',
        fps: 30,
        animation: {
          preset: 'SlowZoomIn',
        },
      };
      const result = RenderingConfigurationSchema.safeParse(validConfig);
      assert.equal(result.success, true);
    });

    it('should reject invalid animation presets', () => {
      const invalidConfig = {
        resolution: '1080x1920',
        animation: {
          preset: 'CrazySpin360',
        },
      };
      const result = RenderingConfigurationSchema.safeParse(invalidConfig);
      assert.equal(result.success, false);
    });

    it('should reject unrecognized properties inside animation object', () => {
      const extraPropertyConfig = {
        animation: {
          preset: 'SlowZoomIn',
          extraSpeed: 10,
        },
      };
      const result = RenderingConfigurationSchema.safeParse(extraPropertyConfig);
      assert.equal(result.success, false);
    });
  });

  describe('AQL-14 & AQL-15: Roman Language Rendering Architecture', () => {
    it('should render Hindi in Devanagari font with lang-hindi CSS class', () => {
      const html = renderDefaultQuoteTemplate({
        text: 'सफलता एक यात्रा है',
        language: 'Hindi',
      });
      assert.ok(html.includes('class="quote-text lang-hindi"'));
    });

    it('should render Urdu in Nastaliq font with lang-urdu CSS class and RTL', () => {
      const html = renderDefaultQuoteTemplate({
        text: 'کامیابی ایک سفر ہے',
        language: 'Urdu',
      });
      assert.ok(html.includes('class="quote-text lang-urdu"'));
      assert.ok(html.includes('direction: rtl'));
    });

    it('should render HindiRoman with default Latin Poppins font and standard LTR layout', () => {
      const html = renderDefaultQuoteTemplate({
        text: 'Safalta ek yatra hai, manzil nahi.',
        language: 'HindiRoman',
      });
      assert.ok(html.includes('class="quote-text "'));
      assert.ok(!html.includes('class="quote-text lang-hindi"'));
      assert.ok(!html.includes('class="quote-text lang-urdu"'));
    });

    it('should render UrduRoman with default Latin Poppins font and standard LTR layout', () => {
      const html = renderDefaultQuoteTemplate({
        text: 'Kamyabi ek safar hai, manzil nahi.',
        language: 'UrduRoman',
      });
      assert.ok(html.includes('class="quote-text "'));
      assert.ok(!html.includes('class="quote-text lang-hindi"'));
      assert.ok(!html.includes('class="quote-text lang-urdu"'));
    });
  });

  describe('AQL-16: Unicode Range Script Mismatch Validation', () => {
    function validateScript(language: string, text: string): boolean {
      if (language === 'HindiRoman' || language === 'UrduRoman') {
        const hasDevanagari = /[\u0900-\u097F]/.test(text);
        const hasArabicUrdu = /[\u0600-\u06FF\u0750-\u077F]/.test(text);
        if (hasDevanagari || hasArabicUrdu) {
          return false;
        }
      }
      return true;
    }

    it('should accept valid Romanized Hindi text in Latin characters', () => {
      const text = 'Mehnat itni khamoshi se karo ki kamyabi shor macha de.';
      assert.equal(validateScript('HindiRoman', text), true);
    });

    it('should accept valid Romanized Urdu text in Latin characters', () => {
      const text = 'Khudi ko kar buland itna ke har taqdeer se pehle Khuda bande se khud pooche.';
      assert.equal(validateScript('UrduRoman', text), true);
    });

    it('should reject HindiRoman text containing Devanagari script characters', () => {
      const text = 'Mehnat karo मेहनत करो!';
      assert.equal(validateScript('HindiRoman', text), false);
    });

    it('should reject UrduRoman text containing Arabic/Urdu script characters', () => {
      const text = 'Khudi ko kar buland خودی کو کر بلند';
      assert.equal(validateScript('UrduRoman', text), false);
    });

    it('should allow native script text for native Hindi and Urdu languages', () => {
      assert.equal(validateScript('Hindi', 'मेहनत इतनी खामोशी से करो'), true);
      assert.equal(validateScript('Urdu', 'خودی کو کر بلند اتنا'), true);
    });
  });

  describe('AQL-20: AI Provider Language Script Instructions', () => {
    it('should have explicit authoritative script instructions for all 5 languages', () => {
      assert.ok(LANGUAGE_SCRIPT_INSTRUCTIONS['English']);
      assert.ok(LANGUAGE_SCRIPT_INSTRUCTIONS['Hindi']!.includes('Devanagari'));
      assert.ok(LANGUAGE_SCRIPT_INSTRUCTIONS['Urdu']!.includes('Nastaliq'));
      assert.ok(LANGUAGE_SCRIPT_INSTRUCTIONS['HindiRoman']!.includes('ONLY Latin/Roman alphabet'));
      assert.ok(LANGUAGE_SCRIPT_INSTRUCTIONS['UrduRoman']!.includes('ONLY Latin/Roman alphabet'));
    });

    it('should include HindiRoman and UrduRoman in geminiResponseSchema description', () => {
      const langProp = geminiResponseSchema.properties.language;
      assert.ok(langProp.description.includes('HindiRoman'));
      assert.ok(langProp.description.includes('UrduRoman'));
    });
  });

  describe('AQL-12 & AQL-13: Snapshots & Retry Determinism', () => {
    it('should produce identical FFmpeg arguments on retried video compilation', () => {
      const params = {
        localImagePath: '/tmp/bg.png',
        localForegroundPath: '/tmp/fg.png',
        localAudioPath: '/tmp/audio.mp3',
        durationSeconds: 15,
        animationPreset: 'SlowZoomIn' as AnimationPreset,
        tempOutputPath: '/tmp/retry.mp4',
      };

      const argsAttempt1 = buildFFmpegArgs(params);
      const argsAttempt2 = buildFFmpegArgs(params);

      assert.deepEqual(argsAttempt1, argsAttempt2);
    });
  });
});
