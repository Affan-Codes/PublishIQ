import test from 'node:test';
import assert from 'node:assert';
import { jobService } from '../services/job.service.js';
import { assetService } from '../services/asset.service.js';
import { channelService } from '../services/channel.service.js';
import { contentProfileService } from '../services/contentProfile.service.js';
import { contentTypeService } from '../services/contentType.service.js';
import { generatedContentService } from '../services/generatedContent.service.js';
import { promptService } from '../services/prompt.service.js';
import { templateService } from '../services/template.service.js';
import { jobRepository } from '../repositories/job.repository.js';
import { assetRepository } from '../repositories/asset.repository.js';
import { channelRepository } from '../repositories/channel.repository.js';
import { contentProfileRepository } from '../repositories/contentProfile.repository.js';
import { contentTypeRepository } from '../repositories/contentType.repository.js';
import { generatedContentRepository } from '../repositories/generatedContent.repository.js';
import { promptRepository } from '../repositories/prompt.repository.js';
import { templateRepository } from '../repositories/template.repository.js';
import { requireAuth } from '../middlewares/auth.js';
import authService from '../services/auth.service.js';
import { workspaceRepository } from '../repositories/workspace.repository.js';
import { NotFoundError, ForbiddenError } from '../errors/custom-errors.js';

test('CRIT-03 & CRIT-04: Multi-Entity Workspace Isolation & Auth Fallback Tests', async (t) => {
  const entityServices = [
    {
      name: 'Job',
      fn: () => jobService.getJobById('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
      repo: jobRepository,
      method: 'getById',
    },
    {
      name: 'Asset',
      fn: () => assetService.getAssetById('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
      repo: assetRepository,
      method: 'getById',
    },
    {
      name: 'Channel',
      fn: () => channelService.getChannelById('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
      repo: channelRepository,
      method: 'getById',
    },
    {
      name: 'ContentProfile',
      fn: () => contentProfileService.getProfileById('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
      repo: contentProfileRepository,
      method: 'getById',
    },
    {
      name: 'ContentType',
      fn: () => contentTypeService.getContentTypeById('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
      repo: contentTypeRepository,
      method: 'getById',
    },
    {
      name: 'GeneratedContent',
      fn: () => generatedContentService.getGeneratedContentById('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
      repo: generatedContentRepository,
      method: 'getById',
    },
    {
      name: 'Prompt',
      fn: () => promptService.getPromptById('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
      repo: promptRepository,
      method: 'getById',
    },
    {
      name: 'Template',
      fn: () => templateService.getTemplateById('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
      repo: templateRepository,
      method: 'getById',
    },
  ];

  for (const { name, fn, repo, method } of entityServices) {
    await t.test(`${name} service should throw NotFoundError when entity does not belong to workspace`, async () => {
      const orig = (repo as any)[method];
      try {
        (repo as any)[method] = async (_id: string, workspaceId?: string) => {
          if (workspaceId === '00000000-0000-0000-0000-000000000002') return null;
          return { id: '00000000-0000-0000-0000-000000000001', workspaceId: '00000000-0000-0000-0000-000000000003' };
        };

        await assert.rejects(
          async () => {
            await fn();
          },
          (err: any) => {
            assert(err instanceof NotFoundError, `Expected NotFoundError but got ${err.name}`);
            return true;
          }
        );
      } finally {
        (repo as any)[method] = orig;
      }
    });
  }

  await t.test('CRIT-04: requireAuth should reject unassigned users with ForbiddenError without fallback', async () => {
    const origValidate = authService.validateSession;
    const origGetFirstWs = workspaceRepository.getFirst;
    let getFirstWsCalled = false;

    try {
      authService.validateSession = async () => ({
        id: 'sess-123',
        userId: 'user-unassigned',
        token: 'token-123',
        expiresAt: new Date(Date.now() + 3600000),
        user: {
          id: 'user-unassigned',
          email: 'unassigned@publishiq.com',
          role: 'Editor',
          workspaceId: null,
        },
      }) as any;

      workspaceRepository.getFirst = async () => {
        getFirstWsCalled = true;
        return { id: 'ws-default-org' } as any;
      };

      const req: any = {
        signedCookies: { session: 'token-123' },
        headers: {},
      };
      const res: any = {
        cookie: () => {},
      };

      let capturedError: any = null;
      await requireAuth(req, res, (err?: any) => {
        capturedError = err;
      });

      assert(capturedError instanceof ForbiddenError, 'Should pass ForbiddenError to next()');
      assert.strictEqual(getFirstWsCalled, false, 'Should NEVER query workspaceRepository.getFirst()');
    } finally {
      authService.validateSession = origValidate;
      workspaceRepository.getFirst = origGetFirstWs;
    }
  });
});
