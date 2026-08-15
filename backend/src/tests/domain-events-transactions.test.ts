import test from 'node:test';
import assert from 'node:assert';
import { broadcastDomainEvent, localEventBus } from '../events/event-bus.js';
import { logRepository } from '../repositories/log.repository.js';
import { closeValkeyInstance } from '../database/valkey.js';

test('HIGH-01 & HIGH-02: Domain Event Broadcasting & Transaction Isolation Tests', async (t) => {
  t.after(async () => {
    await closeValkeyInstance();
  });

  await t.test('broadcastDomainEvent should emit to local bus without creating duplicate DB records', async () => {
    const origCreateDomainEvent = logRepository.createDomainEvent;
    let createDbEventCalled = false;

    try {
      logRepository.createDomainEvent = async () => {
        createDbEventCalled = true;
        return {} as any;
      };

      const mockEvent = {
        id: '00000000-0000-0000-0000-000000000001',
        workspaceId: '00000000-0000-0000-0000-000000000002',
        type: 'JobRunning',
        payload: { jobId: '00000000-0000-0000-0000-000000000003' },
        jobId: '00000000-0000-0000-0000-000000000003',
        createdAt: new Date(),
      };

      let receivedEvent: any = null;
      const listener = (event: any) => {
        receivedEvent = event;
      };

      localEventBus.once('JobRunning', listener);

      await broadcastDomainEvent(mockEvent);

      assert.strictEqual(createDbEventCalled, false, 'broadcastDomainEvent must NOT call logRepository.createDomainEvent');
      assert.deepStrictEqual(receivedEvent?.id, mockEvent.id, 'localEventBus should receive the broadcasted domain event');
    } finally {
      logRepository.createDomainEvent = origCreateDomainEvent;
    }
  });
});
