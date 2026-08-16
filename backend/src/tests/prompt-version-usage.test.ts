import test from 'node:test';
import assert from 'node:assert/strict';
import contentProfileRepository from '../repositories/contentProfile.repository.js';
import promptRepository from '../repositories/prompt.repository.js';
import { promptService } from '../services/prompt.service.js';
import { PromptStatus } from '@prisma/client';

test('PCP-03: Prompt Version Usage Count Tests', async (t) => {
  const mockWorkspaceId = '00000000-0000-0000-0000-000000000001';
  const otherWorkspaceId = '00000000-0000-0000-0000-000000000002';
  const mockPromptId = '00000000-0000-0000-0000-000000000010';
  const mockVersion1Id = '00000000-0000-0000-0000-000000000011';
  const mockVersion2Id = '00000000-0000-0000-0000-000000000012';

  await t.test('countByPromptVersionIds accurately aggregates profiles scoped to workspace', async () => {
    const origCount = contentProfileRepository.countByPromptVersionIds;

    try {
      let capturedVersionIds: string[] = [];
      let capturedWorkspaceId: string | undefined;

      contentProfileRepository.countByPromptVersionIds = async (versionIds, workspaceId) => {
        capturedVersionIds = versionIds;
        capturedWorkspaceId = workspaceId;
        return {
          [mockVersion1Id]: 3,
          [mockVersion2Id]: 0,
        };
      };

      const result = await contentProfileRepository.countByPromptVersionIds(
        [mockVersion1Id, mockVersion2Id],
        mockWorkspaceId
      );

      assert.equal(result[mockVersion1Id], 3);
      assert.equal(result[mockVersion2Id], 0);
      assert.deepEqual(capturedVersionIds, [mockVersion1Id, mockVersion2Id]);
      assert.equal(capturedWorkspaceId, mockWorkspaceId);
    } finally {
      contentProfileRepository.countByPromptVersionIds = origCount;
    }
  });

  await t.test('promptService.getPromptById attaches usedByProfileCount to each version', async () => {
    const origGetPrompt = promptRepository.getById;
    const origCount = contentProfileRepository.countByPromptVersionIds;

    try {
      promptRepository.getById = async () => ({
        id: mockPromptId,
        workspaceId: mockWorkspaceId,
        name: 'Quote Master Prompt',
        status: PromptStatus.Active,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        versions: [
          {
            id: mockVersion2Id,
            promptId: mockPromptId,
            versionNumber: 2,
            body: 'Version 2 body',
            status: PromptStatus.Active,
            notes: null,
            createdAt: new Date(),
          },
          {
            id: mockVersion1Id,
            promptId: mockPromptId,
            versionNumber: 1,
            body: 'Version 1 body',
            status: PromptStatus.Deprecated,
            notes: null,
            createdAt: new Date(),
          },
        ],
      });

      contentProfileRepository.countByPromptVersionIds = async (ids, wId) => {
        assert.equal(wId, mockWorkspaceId);
        return {
          [mockVersion2Id]: 1,
          [mockVersion1Id]: 4,
        };
      };

      const prompt = await promptService.getPromptById(mockPromptId, mockWorkspaceId);

      assert.equal(prompt.versions.length, 2);
      const v2 = prompt.versions.find((v) => v.versionNumber === 2);
      const v1 = prompt.versions.find((v) => v.versionNumber === 1);

      assert.equal(v2?.usedByProfileCount, 1, 'Version 2 should have usage count 1');
      assert.equal(v1?.usedByProfileCount, 4, 'Version 1 should have usage count 4');
    } finally {
      promptRepository.getById = origGetPrompt;
      contentProfileRepository.countByPromptVersionIds = origCount;
    }
  });
});
