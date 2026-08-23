import test from 'node:test';
import assert from 'node:assert/strict';
import { domainEventService } from '../services/domainEvent.service.js';
import { domainEventRepository } from '../repositories/domainEvent.repository.js';
import { prisma } from '../database/db.js';

test('Domain Events Activity API & Scoping Tests (P0-01)', async (t) => {
  const origFindMany = prisma.domainEvent.findMany;
  const origCount = prisma.domainEvent.count;
  const origFindFirst = prisma.domainEvent.findFirst;

  t.afterEach(() => {
    prisma.domainEvent.findMany = origFindMany;
    prisma.domainEvent.count = origCount;
    prisma.domainEvent.findFirst = origFindFirst;
  });

  const workspaceIdA = '00000000-0000-0000-0000-000000000001';
  const workspaceIdB = '00000000-0000-0000-0000-000000000002';

  const mockEventsA = [
    {
      id: 'evt-1',
      workspaceId: workspaceIdA,
      jobId: 'job-101',
      type: 'JobCompleted',
      payload: { message: 'Content Pipeline Job job-101 completed' },
      createdAt: new Date('2026-08-23T10:00:00Z'),
    },
    {
      id: 'evt-2',
      workspaceId: workspaceIdA,
      jobId: 'job-102',
      type: 'ImageGenerated',
      payload: { imageUrl: 'https://cdn.example.com/img.png' },
      createdAt: new Date('2026-08-23T10:05:00Z'),
    },
    {
      id: 'evt-3',
      workspaceId: workspaceIdA,
      jobId: 'job-103',
      type: 'JobFailed',
      payload: { error: 'Network timeout during publishing' },
      createdAt: new Date('2026-08-23T10:10:00Z'),
    },
  ];

  await t.test('returns paginated domain events with pagination metadata', async () => {
    let capturedWhere: any = null;
    let capturedSkip: number | undefined = undefined;
    let capturedTake: number | undefined = undefined;

    (prisma.domainEvent as any).findMany = async (args: any) => {
      capturedWhere = args?.where;
      capturedSkip = args?.skip;
      capturedTake = args?.take;
      return mockEventsA.slice(0, 2) as any;
    };
    (prisma.domainEvent as any).count = async () => mockEventsA.length;

    const result = await domainEventService.listDomainEvents(workspaceIdA, {
      page: 1,
      limit: 2,
    });

    assert.strictEqual(result.items.length, 2);
    assert.strictEqual(result.total, 3);
    assert.strictEqual(result.totalPages, 2);
    assert.strictEqual(result.page, 1);
    assert.strictEqual(result.limit, 2);
    assert.strictEqual(capturedSkip, 0);
    assert.strictEqual(capturedTake, 2);
    assert.strictEqual(capturedWhere.workspaceId, workspaceIdA);
  });

  await t.test('filters domain events by type and jobId', async () => {
    let capturedWhere: any = null;

    (prisma.domainEvent as any).findMany = async (args: any) => {
      capturedWhere = args?.where;
      return [mockEventsA[0]!] as any;
    };
    (prisma.domainEvent as any).count = async () => 1;

    const result = await domainEventService.listDomainEvents(workspaceIdA, {
      type: 'JobCompleted',
      jobId: 'job-101',
    });

    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0]?.type, 'JobCompleted');
    assert.strictEqual(capturedWhere.jobId, 'job-101');
    assert.ok(capturedWhere.type, 'Where clause must include type filter');
  });

  await t.test('enforces workspace scoping and isolation', async () => {
    let capturedWhere: any = null;

    (prisma.domainEvent as any).findMany = async (args: any) => {
      capturedWhere = args?.where;
      return [];
    };
    (prisma.domainEvent as any).count = async () => 0;

    await domainEventService.listDomainEvents(workspaceIdB, {});

    assert.strictEqual(
      capturedWhere.workspaceId,
      workspaceIdB,
      'Query must be strictly isolated to requested workspaceId'
    );
  });
});
