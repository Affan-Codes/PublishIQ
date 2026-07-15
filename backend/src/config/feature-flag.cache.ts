import { prisma } from '../database/db.js';
import { logger } from '../utils/logger.js';

const cache = new Map<string, boolean>();
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

export async function isFeatureFlagEnabled(key: string): Promise<boolean> {
  if (Date.now() - lastLoaded > ttlMs) {
    await reloadFeatureFlags();
  }
  return cache.get(key) ?? false;
}

export async function reloadFeatureFlags(): Promise<void> {
  try {
    const wsId = await getWorkspaceId();
    const flags = await prisma.featureFlag.findMany({
      where: { workspaceId: wsId },
    });

    cache.clear();
    for (const flag of flags) {
      cache.set(flag.key, flag.enabled);
    }
    lastLoaded = Date.now();
    logger.debug('FeatureFlag cache reloaded.');
  } catch (error) {
    logger.error({ error }, 'Failed to reload FeatureFlag cache');
    if (cache.size === 0) {
      throw error;
    }
  }
}

export const featureFlagCache = {
  isEnabled: isFeatureFlagEnabled,
  reload: reloadFeatureFlags,
};

export default featureFlagCache;
