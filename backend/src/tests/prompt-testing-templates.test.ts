import test from 'node:test';
import assert from 'node:assert';
import { promptService } from '../services/prompt.service.js';
import promptRepository from '../repositories/prompt.repository.js';
import { geminiProvider } from '../providers/ai/gemini.provider.js';
import { getTemplateRenderer } from '../templates/index.js';
import { ValidationError } from '../errors/custom-errors.js';
import { PromptStatus } from '@prisma/client';

test('CFG-08, CFG-11 & CFG-16: Prompt Testing, Concurrency & Template Component Loading Tests', async (t) => {
  const mockWorkspaceId = '00000000-0000-0000-0000-000000000001';
  const mockPromptId = '00000000-0000-0000-0000-000000000002';

  await t.test('CFG-08: testPromptVersion generates output successfully with valid variables', async () => {
    const origGetPrompt = promptRepository.getById;
    const origGetVersion = promptRepository.getVersion;
    const origGenerate = geminiProvider.generate;

    try {
      promptRepository.getById = async () => ({
        id: mockPromptId,
        workspaceId: mockWorkspaceId,
        name: 'Test Prompt',
        status: PromptStatus.Active,
        versions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: null,
      } as any);

      promptRepository.getVersion = async () => ({
        id: '00000000-0000-0000-0000-000000000003',
        promptId: mockPromptId,
        versionNumber: 2,
        body: 'Generate quote for topic {{topic}} in language {{language}}',
        status: PromptStatus.Active,
        notes: 'v2 test',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      geminiProvider.generate = async (prompt, variables) => {
        return {
          text: `Generated text for ${variables.topic} in ${variables.language}`,
          metadata: { caption: 'Caption', hashtags: ['#test'] },
        };
      };

      const result = await promptService.testPromptVersion(
        mockPromptId,
        2,
        mockWorkspaceId,
        { topic: 'Leadership', language: 'English' }
      );

      assert.strictEqual(result.versionNumber, 2);
      assert.strictEqual(result.text, 'Generated text for Leadership in English');
      assert.deepStrictEqual(result.metadata.hashtags, ['#test']);
    } finally {
      promptRepository.getById = origGetPrompt;
      promptRepository.getVersion = origGetVersion;
      geminiProvider.generate = origGenerate;
    }
  });

  await t.test('CFG-08: testPromptVersion throws ValidationError when variable is missing', async () => {
    const origGetPrompt = promptRepository.getById;
    const origGetVersion = promptRepository.getVersion;

    try {
      promptRepository.getById = async () => ({
        id: mockPromptId,
        workspaceId: mockWorkspaceId,
        name: 'Test Prompt',
        status: PromptStatus.Active,
        versions: [],
      } as any);

      promptRepository.getVersion = async () => ({
        id: '00000000-0000-0000-0000-000000000003',
        promptId: mockPromptId,
        versionNumber: 1,
        body: 'Generate quote for {{missingTopic}}',
        status: PromptStatus.Active,
      } as any);

      await assert.rejects(
        async () => {
          await promptService.testPromptVersion(
            mockPromptId,
            1,
            mockWorkspaceId,
            {} // missingTopic not supplied
          );
        },
        (err: any) => {
          assert(err instanceof ValidationError, 'Should throw ValidationError for missing placeholder');
          return true;
        }
      );
    } finally {
      promptRepository.getById = origGetPrompt;
      promptRepository.getVersion = origGetVersion;
    }
  });

  await t.test('CFG-16: getTemplateRenderer differentiates definition-driven template from legacy and produces distinct HTML output', () => {
    const legacyVersion = {
      componentPath: 'DefaultQuoteTemplate',
      definition: null,
    };

    const definitionVersion = {
      componentPath: null,
      definition: {
        category: 'Terminal',
        layout: {
          contentAlign: 'left',
          verticalAnchor: 'top',
          maxContentWidthPx: 920,
          blockGapPx: 28,
        },
        typography: {
          heading: { sizePx: 52, weight: 700, lineHeight: 1.4 },
          body: { sizePx: 38, weight: 400, lineHeight: 1.6 },
          code: { sizePx: 42, lineHeight: 1.5 },
          caption: { sizePx: 26, weight: 400, lineHeight: 1.4 },
        },
        colors: {
          background: '#0D1117',
          primary: '#58A6FF',
          secondary: '#8B949E',
          accent: '#7EE787',
          muted: '#484F58',
          error: '#FF7B72',
        },
        emphasisRules: {
          primary: { colorToken: 'accent', weight: 700, textTransform: 'none' },
          secondary: { colorToken: 'secondary', weight: 600, textTransform: 'none' },
          normal: { colorToken: 'primary', weight: 400, textTransform: 'none' },
          muted: { colorToken: 'muted', weight: 400, textTransform: 'none' },
        },
        contentMapping: {
          heading: { typography: 'heading' },
          body_default: { typography: 'body' },
          body_label: { typography: 'body', forceEmphasis: 'primary' },
          body_attribution: { typography: 'caption', forceEmphasis: 'muted' },
          code_default: { typography: 'code' },
          code_command: { typography: 'code', forceEmphasis: 'normal' },
          body_error: { typography: 'body', forceEmphasis: 'primary', colorOverride: 'error' },
          list_item_default: { typography: 'body' },
        },
        decorations: {
          divider: 'none',
          codeIcon: false,
          terminalPrompt: true,
          heart: false,
          cornerMark: true,
        },
        backgroundTreatment: {
          mode: 'solid',
        },
        branding: {
          typography: 'caption',
          sizeScalePct: 90,
          opacityCeiling: 0.8,
        },
        watermark: {
          typography: 'caption',
          sizeScalePct: 90,
          opacityCeiling: 0.6,
        },
      },
    };

    const legacyRenderer = getTemplateRenderer(legacyVersion);
    assert.strictEqual(typeof legacyRenderer, 'function');

    const definitionRenderer = getTemplateRenderer(definitionVersion);
    assert.strictEqual(typeof definitionRenderer, 'function');

    // Assert that the two renderers are distinct functions
    assert.notStrictEqual(legacyRenderer, definitionRenderer, 'Definition renderer must be distinct from legacy renderer');

    const legacyHtml = legacyRenderer({
      text: 'Sample statement text',
      language: 'English',
      branding: 'BRAND_A',
      watermark: '@brand_a',
    });

    const definitionHtml = definitionRenderer({
      content: {
        blocks: [
          {
            type: 'code',
            role: 'command',
            runs: [{ text: './sample.exe' }],
          },
        ],
      },
      definition: definitionVersion.definition as any,
      language: 'English',
      branding: 'BRAND_B',
      watermark: '@brand_b',
    });

    assert(legacyHtml.includes('quote-text'), 'Legacy HTML should use legacy class names');
    assert(definitionHtml.includes('decoration-terminal-prompt') || definitionHtml.includes('$ '), 'Definition HTML should render terminal decorations');
    assert.notStrictEqual(legacyHtml, definitionHtml, 'Rendered HTML outputs must be visibly different between legacy and definition templates');
  });
});
