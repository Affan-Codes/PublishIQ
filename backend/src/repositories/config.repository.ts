import { SystemConfiguration, FeatureFlag } from '@prisma/client';
import { prisma } from '../database/db.js';

export const configRepository = {
  async getSystemConfig(workspaceId: string, key: string): Promise<SystemConfiguration | null> {
    return prisma.systemConfiguration.findUnique({
      where: {
        workspaceId_key: { workspaceId, key },
      },
    });
  },

  async getFeatureFlag(workspaceId: string, key: string): Promise<FeatureFlag | null> {
    return prisma.featureFlag.findUnique({
      where: {
        workspaceId_key: { workspaceId, key },
      },
    });
  },

  async updateSystemConfig(workspaceId: string, key: string, value: any): Promise<SystemConfiguration> {
    return prisma.systemConfiguration.upsert({
      where: {
        workspaceId_key: { workspaceId, key },
      },
      update: { value },
      create: { workspaceId, key, value },
    });
  },

  async updateFeatureFlag(workspaceId: string, key: string, enabled: boolean): Promise<FeatureFlag> {
    return prisma.featureFlag.upsert({
      where: {
        workspaceId_key: { workspaceId, key },
      },
      update: { enabled },
      create: { workspaceId, key, enabled, description: '' },
    });
  },

  async listFlags(workspaceId: string): Promise<FeatureFlag[]> {
    return prisma.featureFlag.findMany({
      where: { workspaceId },
    });
  },

  async listConfigs(workspaceId: string): Promise<SystemConfiguration[]> {
    return prisma.systemConfiguration.findMany({
      where: { workspaceId },
    });
  },
};

export default configRepository;
