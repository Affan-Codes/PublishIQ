import crypto from 'crypto';

/**
 * Normalizes text by converting it to lowercase, stripping punctuation, and collapsing multiple whitespaces into a single space.
 * This is used for exact-match duplicate detection.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, '') // strip punctuation
    .replace(/\s+/g, ' ')                           // collapse whitespace
    .trim();
}

/**
 * Computes a SHA-256 hash of the normalized text.
 */
export function getNormalizedHash(text: string): string {
  const normalized = normalizeText(text);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
