import test from 'node:test';
import assert from 'node:assert';
import { getNormalizedHash } from '../utils/normalization.js';

test('Normalization Hashing Unit Tests', async (t) => {
  await t.test('should produce identical hashes for texts that differ only in casing and spacing', () => {
    const text1 = '  The quick brown fox jumps   over the lazy dog.  ';
    const text2 = 'the QUICK brown FOX Jumps OVER the LAZY dog';

    const hash1 = getNormalizedHash(text1);
    const hash2 = getNormalizedHash(text2);

    assert.strictEqual(hash1, hash2);
  });

  await t.test('should produce different hashes for semantically different texts', () => {
    const text1 = 'The quick brown fox jumps over the lazy dog';
    const text2 = 'A completely different quote text for shayari';

    const hash1 = getNormalizedHash(text1);
    const hash2 = getNormalizedHash(text2);

    assert.notStrictEqual(hash1, hash2);
  });
});
