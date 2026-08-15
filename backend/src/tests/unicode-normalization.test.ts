import test from 'node:test';
import assert from 'node:assert';
import { normalizeText, getNormalizedHash } from '../utils/normalization.js';

test('CFG-14: Unicode NFC Normalization Tests', async (t) => {
  await t.test('NFC and NFD visually identical strings should normalize and hash identically', () => {
    // Construct decomposed (NFD) string: 'e' + combining acute accent (\u0301)
    const nfdString = 'Cafe\u0301 123';
    // Construct precomposed (NFC) string: '\u00e9'
    const nfcString = 'Caf\u00e9 123';

    // Without NFC normalization, nfdString.toLowerCase() !== nfcString.toLowerCase()
    assert.strictEqual(normalizeText(nfdString), normalizeText(nfcString), 'NFD and NFC forms should normalize to identical strings');
    assert.strictEqual(getNormalizedHash(nfdString), getNormalizedHash(nfcString), 'NFD and NFC forms should produce the same hash');
  });

  await t.test('Devanagari text with combining marks canonicalizes identically', () => {
    // Hindi Devanagari word: 'हिंदी' (NFC vs NFD)
    const hindiWordNFC = 'हिंदी'.normalize('NFC');
    const hindiWordNFD = 'हिंदी'.normalize('NFD');

    assert.strictEqual(normalizeText(hindiWordNFD), normalizeText(hindiWordNFC));
    assert.strictEqual(getNormalizedHash(hindiWordNFD), getNormalizedHash(hindiWordNFC));
  });

  await t.test('Urdu text with combining diacritics canonicalizes identically', () => {
    // Urdu text: 'شاعری' (NFC vs NFD)
    const urduNFC = 'شاعری'.normalize('NFC');
    const urduNFD = 'شاعری'.normalize('NFD');

    assert.strictEqual(normalizeText(urduNFD), normalizeText(urduNFC));
    assert.strictEqual(getNormalizedHash(urduNFD), getNormalizedHash(urduNFC));
  });
});
