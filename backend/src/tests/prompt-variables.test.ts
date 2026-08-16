import test from 'node:test';
import assert from 'node:assert';
import { extractPromptVariables, SYSTEM_PROMPT_VARIABLES } from '../constants/prompt-variables.js';
import { geminiProvider } from '../providers/ai/gemini.provider.js';
import { contentProfileService } from '../services/contentProfile.service.js';
import promptRepository from '../repositories/prompt.repository.js';
import contentTypeRepository from '../repositories/contentType.repository.js';
import templateRepository from '../repositories/template.repository.js';
import contentProfileRepository from '../repositories/contentProfile.repository.js';
import { ValidationError } from '../errors/custom-errors.js';
import { ContentProfileStatus, Language } from '@prisma/client';

test('CFG-02 & CFG-06: Prompt Variables & Substitution Tests', async (t) => {
  await t.test('extractPromptVariables: should correctly extract, trim and deduplicate variables', () => {
    const body = 'Hello {{ contentType }}! Tone: {{ tone }}, Lang: {{language}}, and {{tone}}. Custom: {{ custom_var }}';
    const extracted = extractPromptVariables(body);
    assert.deepStrictEqual(extracted.sort(), ['contentType', 'custom_var', 'language', 'tone'].sort());
  });

  await t.test('extractPromptVariables: should handle empty and variable-free strings', () => {
    assert.deepStrictEqual(extractPromptVariables(''), []);
    assert.deepStrictEqual(extractPromptVariables('No variables here.'), []);
  });

  await t.test('CFG-06: contentProfileService should reject promptVariables colliding with reserved system variable names', async () => {
    const mockWorkspaceId = '00000000-0000-0000-0000-000000000001';
    
    await assert.rejects(
      async () => {
        await contentProfileService.createProfile({
          workspaceId: mockWorkspaceId,
          name: 'Colliding Profile',
          status: ContentProfileStatus.Active,
          contentTypeId: '00000000-0000-0000-0000-000000000002',
          promptVersionId: '00000000-0000-0000-0000-000000000003',
          templateVersionId: '00000000-0000-0000-0000-000000000004',
          language: Language.English,
          tone: 'Inspiring',
          writingStyle: 'Poetic',
          promptVariables: { tone: 'OverrideTone' },
          brandingRules: {},
          watermarkRules: {},
          captionStrategy: {},
          hashtagStrategy: {},
          musicSelectionRules: {},
          renderingConfiguration: {},
          validationRules: {},
        });
      },
      (err: any) => {
        assert(err instanceof ValidationError, 'Should throw ValidationError');
        assert(err.message.includes('tone'), 'Should mention the colliding variable');
        return true;
      }
    );
  });

  await t.test('CFG-02: contentProfileService should reject prompt version referencing uncovered variables', async () => {
    const mockWorkspaceId = '00000000-0000-0000-0000-000000000001';
    const mockContentTypeId = '00000000-0000-0000-0000-000000000002';
    const mockPromptVersionId = '00000000-0000-0000-0000-000000000003';
    const mockPromptId = '00000000-0000-0000-0000-000000000004';
    const mockTemplateVersionId = '00000000-0000-0000-0000-000000000005';
    const mockTemplateId = '00000000-0000-0000-0000-000000000006';

    const origGetContentType = contentTypeRepository.getById;
    const origGetPromptVersion = promptRepository.getPromptVersionById;
    const origGetPrompt = promptRepository.getById;
    const origGetTemplateVersion = templateRepository.getTemplateVersionById;
    const origGetTemplate = templateRepository.getById;
    const origCreateProfile = contentProfileRepository.create;

    try {
      contentTypeRepository.getById = async () => ({ id: mockContentTypeId, workspaceId: mockWorkspaceId, name: 'Quote' } as any);
      promptRepository.getPromptVersionById = async () => ({
        id: mockPromptVersionId,
        promptId: mockPromptId,
        versionNumber: 1,
        body: 'Generate a {{contentType}} with tone {{tone}} and author {{missingAuthorVar}}',
      } as any);
      promptRepository.getById = async () => ({ id: mockPromptId, workspaceId: mockWorkspaceId, name: 'Test Prompt' } as any);
      templateRepository.getTemplateVersionById = async () => ({ id: mockTemplateVersionId, templateId: mockTemplateId } as any);
      templateRepository.getById = async () => ({ id: mockTemplateId, workspaceId: mockWorkspaceId } as any);

      // 1. Rejects when missingAuthorVar is NOT provided in promptVariables
      await assert.rejects(
        async () => {
          await contentProfileService.createProfile({
            workspaceId: mockWorkspaceId,
            name: 'Uncovered Var Profile',
            status: ContentProfileStatus.Active,
            contentTypeId: mockContentTypeId,
            promptVersionId: mockPromptVersionId,
            templateVersionId: mockTemplateVersionId,
            language: Language.English,
            tone: 'Inspiring',
            writingStyle: 'Poetic',
            promptVariables: {},
            brandingRules: {},
            watermarkRules: {},
            captionStrategy: {},
            hashtagStrategy: {},
            musicSelectionRules: {},
            renderingConfiguration: {},
            validationRules: {},
          });
        },
        (err: any) => {
          assert(err instanceof ValidationError, 'Should throw ValidationError');
          assert(err.message.includes('missingAuthorVar'), 'Error should name the missing variable');
          return true;
        }
      );

      // 2. Accepts when missingAuthorVar IS provided in promptVariables
      let created = false;
      contentProfileRepository.create = async (data: any) => {
        created = true;
        return { id: '00000000-0000-0000-0000-000000000007', ...data };
      };

      await contentProfileService.createProfile({
        workspaceId: mockWorkspaceId,
        name: 'Covered Var Profile',
        status: ContentProfileStatus.Active,
        contentTypeId: mockContentTypeId,
        promptVersionId: mockPromptVersionId,
        templateVersionId: mockTemplateVersionId,
        language: Language.English,
        tone: 'Inspiring',
        writingStyle: 'Poetic',
        promptVariables: { missingAuthorVar: 'John Doe' },
        brandingRules: {},
        watermarkRules: {},
        captionStrategy: {},
        hashtagStrategy: {},
        musicSelectionRules: {},
        renderingConfiguration: {},
        validationRules: {},
      });

      assert.strictEqual(created, true, 'Profile creation should succeed when variables are covered');
    } finally {
      contentTypeRepository.getById = origGetContentType;
      promptRepository.getPromptVersionById = origGetPromptVersion;
      promptRepository.getById = origGetPrompt;
      templateRepository.getTemplateVersionById = origGetTemplateVersion;
      templateRepository.getById = origGetTemplate;
      contentProfileRepository.create = origCreateProfile;
    }
  });

  await t.test('CFG-02: geminiProvider.generate should reject residual placeholders before network call', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('fetch should not be called');
    };

    try {
      await assert.rejects(
        async () => {
          await geminiProvider.generate(
            {
              body: 'Generate {{contentType}} for {{unmatchedVariable}}',
              versionNumber: 1,
            },
            {
              contentType: 'Quote',
              // unmatchedVariable is missing
            }
          );
        },
        (err: any) => {
          assert(err instanceof ValidationError, 'Should throw ValidationError');
          assert(err.message.includes('{{unmatchedVariable}}'), 'Should name unmatched token');
          return true;
        }
      );

      assert.strictEqual(fetchCalled, false, 'Network fetch must not have been invoked');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('PAS-01: musicCatalog is recognized in SYSTEM_PROMPT_VARIABLES and is optional in prompts', () => {
    assert.ok(SYSTEM_PROMPT_VARIABLES.includes('musicCatalog'), 'musicCatalog must be in SYSTEM_PROMPT_VARIABLES');

    // Prompt containing musicCatalog
    const withCatalog = extractPromptVariables('Prompt with {{contentType}} and {{musicCatalog}}');
    assert.deepEqual(withCatalog.sort(), ['contentType', 'musicCatalog'].sort());

    // Prompt omitting musicCatalog is also valid
    const withoutCatalog = extractPromptVariables('Prompt with only {{contentType}} and {{tone}}');
    assert.deepEqual(withoutCatalog.sort(), ['contentType', 'tone'].sort());
  });
});
