import test from 'node:test';
import assert from 'node:assert';
import { oauthService } from '../services/oauth.service.js';
import { Platform } from '@prisma/client';
import { ValidationError } from '../errors/custom-errors.js';
import { setMockValkey, closeValkeyInstance } from '../database/valkey.js';

test('MED-02: OAuth State Single-Use Replay Protection Tests', async (t) => {
  const usedKeys = new Set<string>();
  setMockValkey({
    set: async (key: string, _val: string, _mode?: string, _ttl?: number, flag?: string) => {
      if (flag === 'NX') {
        if (usedKeys.has(key)) return null;
        usedKeys.add(key);
        return 'OK';
      }
      usedKeys.add(key);
      return 'OK';
    },
    quit: async () => {},
  });

  t.after(async () => {
    setMockValkey(null);
    await closeValkeyInstance();
  });

  await t.test('verifySignedState should reject repeated usage of the same state string', async () => {
    const mockWorkspaceId = '00000000-0000-0000-0000-000000000001';
    const state = oauthService.generateSignedState(Platform.YouTube, mockWorkspaceId);

    // First verification should succeed
    const payload = await oauthService.verifySignedState(state);
    assert.strictEqual(payload.workspaceId, mockWorkspaceId);
    assert.strictEqual(payload.platform, Platform.YouTube);

    // Second verification with the exact same state should fail with ValidationError due to replay detection
    await assert.rejects(
      async () => {
        await oauthService.verifySignedState(state);
      },
      (err: any) => {
        assert(err instanceof ValidationError, `Expected ValidationError but got ${err.name}`);
        assert(err.message.includes('already been used') || err.message.includes('Replay detected'), `Unexpected message: ${err.message}`);
        return true;
      }
    );
  });
});
