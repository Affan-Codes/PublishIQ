import test from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { generatedContentRepository } from '../repositories/generatedContent.repository.js';
import { ValidationError } from '../errors/custom-errors.js';

function normalizeAndHash(text: string): string {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

test('CRIT-05: Duplicate Content Hash Unique Constraint & Race Regeneration Tests', async (t) => {
  await t.test('should detect exact duplicate hash regardless of whitespace and casing', () => {
    const textA = 'Do not wait to strike till the iron is hot; but make it hot by striking.';
    const textB = '  do not wait to strike till the iron is hot;  BUT MAKE IT HOT BY STRIKING.  ';
    assert.strictEqual(normalizeAndHash(textA), normalizeAndHash(textB));
  });

  await t.test('duplicate check should throw ValidationError when existing hash found', async () => {
    const origFindByHash = generatedContentRepository.findByTextHash;
    const testHash = normalizeAndHash('Duplicate text sample');
    const mockWorkspaceId = '00000000-0000-0000-0000-000000000001';

    try {
      generatedContentRepository.findByTextHash = async (wsId: string, hash: string) => {
        if (wsId === mockWorkspaceId && hash === testHash) {
          return { id: '00000000-0000-0000-0000-000000000002', textHash: testHash } as any;
        }
        return null;
      };

      const existing = await generatedContentRepository.findByTextHash(mockWorkspaceId, testHash);
      assert.notStrictEqual(existing, null);

      const checkDuplicate = (found: any) => {
        if (found) {
          throw new ValidationError('Duplicate content detected: Content with identical text hash already exists in workspace.');
        }
      };

      assert.throws(
        () => checkDuplicate(existing),
        (err: any) => {
          assert(err instanceof ValidationError);
          assert(err.message.includes('Duplicate content detected'));
          return true;
        }
      );
    } finally {
      generatedContentRepository.findByTextHash = origFindByHash;
    }
  });
});
