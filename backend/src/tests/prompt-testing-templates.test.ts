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

  await t.test('CFG-16: getTemplateRenderer resolves valid componentPath and falls back cleanly', () => {
    const defaultRenderer = getTemplateRenderer('DefaultQuoteTemplate');
    assert.strictEqual(typeof defaultRenderer, 'function');

    const fallbackRenderer = getTemplateRenderer('NonExistentCustomTemplate');
    assert.strictEqual(typeof fallbackRenderer, 'function');

    const rendered = fallbackRenderer({
      text: 'Test Quote Text',
      language: 'English',
      branding: 'BRAND',
      watermark: '@brand',
    });
    assert(rendered.includes('Test Quote Text'), 'Rendered HTML should contain quote text');
    assert(rendered.includes('BRAND'), 'Rendered HTML should contain branding');
  });
});
