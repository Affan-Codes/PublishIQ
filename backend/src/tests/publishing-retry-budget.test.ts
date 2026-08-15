import test from 'node:test';
import assert from 'node:assert';
import { publishingService } from '../services/publishing.service.js';

test('HIGH-04 & MED-01: Transient Error Classification & Retry Budget Tests', async (t) => {
  await t.test('isTransientError should return false for CONTAINER_TIMEOUT', () => {
    assert.strictEqual(publishingService.isTransientError('Instagram Reels container timeout: CONTAINER_TIMEOUT', 'CONTAINER_TIMEOUT'), false);
    assert.strictEqual(publishingService.isTransientError('Timeout waiting for Instagram Reels container processing to finish: CONTAINER_TIMEOUT'), false);
  });

  await t.test('isTransientError should return false for AMBIGUOUS_DELIVERY', () => {
    assert.strictEqual(publishingService.isTransientError('AMBIGUOUS_DELIVERY: socket hang up', 'AMBIGUOUS_DELIVERY'), false);
    assert.strictEqual(publishingService.isTransientError('AMBIGUOUS_DELIVERY: timeout reached'), false);
  });

  await t.test('isTransientError should return true for temporary 503 and rate limit errors', () => {
    assert.strictEqual(publishingService.isTransientError('Service Unavailable', '503'), true);
    assert.strictEqual(publishingService.isTransientError('Too Many Requests', '429'), true);
  });
});
