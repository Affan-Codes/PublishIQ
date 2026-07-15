import { prisma } from '../database/db.js';
import { logger } from '../utils/logger.js';

const cache = new Map<string, any>();
let lastLoaded = 0;
const ttlMs = 30_000;
let workspaceId: string | null = null;

async function getWorkspaceId(): Promise<string> {
  if (workspaceId) return workspaceId;
  const workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    throw new Error('No workspace found in the database. Ensure seeding has been run.');
  }
  workspaceId = workspace.id;
  return workspaceId;
}

export async function getSystemConfig<T>(key: string): Promise<T | undefined> {
  if (Date.now() - lastLoaded > ttlMs) {
    await reloadSystemConfig();
  }
  return cache.get(key) as T;
}

export async function reloadSystemConfig(): Promise<void> {
  try {
    const wsId = await getWorkspaceId();
    const configs = await prisma.systemConfiguration.findMany({
      where: { workspaceId: wsId },
    });

    cache.clear();
    for (const config of configs) {
      cache.set(config.key, config.value);
    }
    lastLoaded = Date.now();
    logger.debug('SystemConfiguration cache reloaded.');
  } catch (error) {
    logger.error({ error }, 'Failed to reload SystemConfiguration cache');
    if (cache.size === 0) {
      throw error;
    }
  }
}

export const systemConfigCache = {
  get: getSystemConfig,
  reload: reloadSystemConfig,
};

export default systemConfigCache;
