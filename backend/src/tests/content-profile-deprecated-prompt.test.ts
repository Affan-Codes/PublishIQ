import test from 'node:test';
import assert from 'node:assert/strict';
import { contentProfileService } from '../services/contentProfile.service.js';
import contentProfileRepository from '../repositories/contentProfile.repository.js';
import { PromptStatus, ContentProfileStatus, Language } from '@prisma/client';

test('PCP-04: Content Profile Deprecated Prompt Version Reference Tests', async (t) => {
  const mockWorkspaceId = '00000000-0000-0000-0000-000000000001';
  const mockProfileId = '00000000-0000-0000-0000-000000000010';
  const mockPromptId = '00000000-0000-0000-0000-000000000020';
  const mockVersion1Id = '00000000-0000-0000-0000-000000000021';

  await t.test('Profile retains explicit pinned promptVersionId even when status is Deprecated', async () => {
    const origGet = contentProfileRepository.getById;

    try {
      contentProfileRepository.getById = async (id, wId) => {
        assert.equal(id, mockProfileId);
        assert.equal(wId, mockWorkspaceId);
        return {
          id: mockProfileId,
          workspaceId: mockWorkspaceId,
          name: 'Legacy Shayari Profile',
          notes: 'Profile referencing v1',
          status: ContentProfileStatus.Active,
          contentTypeId: '00000000-0000-0000-0000-000000000030',
          promptVersionId: mockVersion1Id,
          templateVersionId: '00000000-0000-0000-0000-000000000040',
          language: Language.Hindi,
          tone: 'Romantic',
          writingStyle: 'Poetic',
          promptVariables: {},
          brandingRules: {},
          watermarkRules: {},
          captionStrategy: {},
          hashtagStrategy: {},
          musicSelectionRules: {},
          renderingConfiguration: {},
          validationRules: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          promptVersion: {
            id: mockVersion1Id,
            promptId: mockPromptId,
            versionNumber: 1,
            body: 'Old prompt body',
            status: PromptStatus.Deprecated,
            notes: 'Deprecated in favor of v2',
            createdAt: new Date(),
            prompt: {
              id: mockPromptId,
              name: 'Shayari Prompt',
              status: PromptStatus.Active,
            },
          },
        } as any;
      };

      const profile = await contentProfileService.getProfileById(mockProfileId, mockWorkspaceId);

      assert.equal(profile.promptVersionId, mockVersion1Id);
      assert.equal(profile.promptVersion?.status, PromptStatus.Deprecated);
      assert.equal(profile.promptVersion?.versionNumber, 1);
    } finally {
      contentProfileRepository.getById = origGet;
    }
  });
});
