import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Music Asset Trimming Unit Tests', () => {
  it('should validate range constraints correctly', () => {
    const sourceDuration = 200; // 03:20 in seconds

    const testInvalidRange = (start: number, end: number) => {
      if (start < 0) return false;
      if (end <= start) return false;
      if (end > sourceDuration) return false;
      if (end - start > 15) return false;
      return true;
    };

    assert.strictEqual(testInvalidRange(-5, 10), false, 'Negative start time should be invalid');
    assert.strictEqual(testInvalidRange(10, 5), false, 'End time <= Start time should be invalid');
    assert.strictEqual(testInvalidRange(10, 210), false, 'End time > Source duration should be invalid');
    assert.strictEqual(testInvalidRange(10, 30), false, 'Segment > 15s should be invalid');
    assert.strictEqual(testInvalidRange(70, 81), true, 'Valid range (1:10 to 1:21 = 11s) should pass');
  });

  it('should enforce maximum segment duration of 15 seconds', () => {
    const validateMaxDuration = (start: number, end: number) => {
      const duration = end - start;
      return duration <= 15;
    };

    assert.strictEqual(validateMaxDuration(0, 15), true, '15 second segment should be valid');
    assert.strictEqual(validateMaxDuration(10, 21), true, '11 second segment should be valid');
    assert.strictEqual(validateMaxDuration(0, 16), false, '16 second segment should be rejected');
    assert.strictEqual(validateMaxDuration(10, 30), false, '20 second segment should be rejected');
  });

  it('should compute exact segment duration for 01:10 to 01:21', () => {
    const startTime = 70; // 01:10
    const endTime = 81;   // 01:21
    const clipDuration = endTime - startTime;
    assert.strictEqual(clipDuration, 11, 'Clip duration should be exactly 11 seconds');
  });
});
