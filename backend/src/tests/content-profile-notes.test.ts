import test from 'node:test';
import assert from 'node:assert/strict';
import { contentProfileService } from '../services/contentProfile.service.js';
import contentProfileRepository from '../repositories/contentProfile.repository.js';
import contentTypeRepository from '../repositories/contentType.repository.js';
import promptRepository from '../repositories/prompt.repository.js';
import templateRepository from '../repositories/template.repository.js';
import { ContentProfileStatus, Language } from '@prisma/client';

test('PCP-05: ContentProfile notes Field Tests', async (t) => {
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
  const origUpdateProfile = contentProfileRepository.update;
  const origGetProfile = contentProfileRepository.getById;

  t.afterEach(() => {
    contentTypeRepository.getById = origGetContentType;
    promptRepository.getPromptVersionById = origGetPromptVersion;
    promptRepository.getById = origGetPrompt;
    templateRepository.getTemplateVersionById = origGetTemplateVersion;
    templateRepository.getById = origGetTemplate;
    contentProfileRepository.create = origCreateProfile;
    contentProfileRepository.update = origUpdateProfile;
    contentProfileRepository.getById = origGetProfile;
  });

  await t.test('createProfile passes notes to repository', async () => {
    contentTypeRepository.getById = async () => ({ id: mockContentTypeId, workspaceId: mockWorkspaceId, name: 'Quote' } as any);
    promptRepository.getPromptVersionById = async () => ({
      id: mockPromptVersionId,
      promptId: mockPromptId,
      versionNumber: 1,
      body: 'Generate a quote',
    } as any);
    promptRepository.getById = async () => ({ id: mockPromptId, workspaceId: mockWorkspaceId, name: 'Prompt' } as any);
    templateRepository.getTemplateVersionById = async () => ({ id: mockTemplateVersionId, templateId: mockTemplateId } as any);
    templateRepository.getById = async () => ({ id: mockTemplateId, workspaceId: mockWorkspaceId } as any);

    let capturedCreateData: any = null;
    contentProfileRepository.create = async (data: any) => {
      capturedCreateData = data;
      return { id: '00000000-0000-0000-0000-000000000099', ...data };
    };

    const result = await contentProfileService.createProfile({
      workspaceId: mockWorkspaceId,
      name: 'Profile with Notes',
      notes: 'Descriptive operational notes for daily reels',
      status: ContentProfileStatus.Active,
      contentTypeId: mockContentTypeId,
      promptVersionId: mockPromptVersionId,
      templateVersionId: mockTemplateVersionId,
      language: Language.English,
      tone: 'Inspirational',
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

    assert.equal(capturedCreateData.notes, 'Descriptive operational notes for daily reels');
    assert.equal(result.notes, 'Descriptive operational notes for daily reels');
  });

  await t.test('updateProfile updates notes on existing profile', async () => {
    contentProfileRepository.getById = async () => ({
      id: '00000000-0000-0000-0000-000000000099',
      workspaceId: mockWorkspaceId,
      name: 'Existing Profile',
      notes: 'Old notes',
      status: ContentProfileStatus.Active,
      contentTypeId: mockContentTypeId,
      promptVersionId: mockPromptVersionId,
      templateVersionId: mockTemplateVersionId,
      language: Language.English,
      tone: 'Inspirational',
      writingStyle: 'Poetic',
    } as any);

    let capturedUpdateData: any = null;
    contentProfileRepository.update = async (id: string, data: any) => {
      capturedUpdateData = data;
      return { id, ...data };
    };

    await contentProfileService.updateProfile('00000000-0000-0000-0000-000000000099', mockWorkspaceId, {
      notes: 'Updated notes content',
    });

    assert.equal(capturedUpdateData.notes, 'Updated notes content');
  });
});
