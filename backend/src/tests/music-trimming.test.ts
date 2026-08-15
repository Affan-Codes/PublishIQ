import test from 'node:test';
import assert from 'node:assert';

function parseTimestampToSeconds(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]!) && !isNaN(parts[1]!)) {
    return parts[0]! * 60 + parts[1]!;
  }
  if (parts.length === 3 && !isNaN(parts[0]!) && !isNaN(parts[1]!) && !isNaN(parts[2]!)) {
    return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  }
  return NaN;
}

function validateSegment(startTimeStr: string, endTimeStr: string, maxDuration: number = 15): { valid: boolean; duration: number; error?: string } {
  const start = parseTimestampToSeconds(startTimeStr);
  const end = parseTimestampToSeconds(endTimeStr);

  if (isNaN(start) || isNaN(end)) {
    return { valid: false, duration: 0, error: 'Invalid timestamp format' };
  }
  if (start < 0 || end <= start) {
    return { valid: false, duration: 0, error: 'Start time must be strictly before end time' };
  }
  const duration = end - start;
  if (duration > maxDuration) {
    return { valid: false, duration, error: `Segment duration (${duration}s) exceeds maximum allowed duration of ${maxDuration}s` };
  }
  return { valid: true, duration };
}

test('Music Asset Trimming Unit Tests', async (t) => {
  await t.test('should validate range constraints correctly', () => {
    const invalid = validateSegment('01:30', '01:00');
    assert.strictEqual(invalid.valid, false);
    assert.strictEqual(invalid.error, 'Start time must be strictly before end time');
  });

  await t.test('should enforce maximum segment duration of 15 seconds', () => {
    const tooLong = validateSegment('00:10', '00:35');
    assert.strictEqual(tooLong.valid, false);
    assert.strictEqual(tooLong.duration, 25);
  });

  await t.test('should compute exact segment duration for 01:10 to 01:21', () => {
    const valid = validateSegment('01:10', '01:21');
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.duration, 11);
  });
});
