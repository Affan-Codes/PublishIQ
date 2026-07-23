import platformConnectionRepository from '../repositories/platformConnection.repository.js';
import { NotFoundError } from '../errors/custom-errors.js';
import { PlatformConnection, Platform, HealthStatus, ConnectionStatus } from '@prisma/client';
import { logger } from '../utils/logger.js';

export const platformConnectionService = {
  async getConnectionById(id: string, workspaceId?: string): Promise<PlatformConnection> {
    logger.debug({ id, workspaceId }, 'Fetching platform connection by ID');
    const connection = await platformConnectionRepository.getById(id, workspaceId);
    if (!connection) {
      throw new NotFoundError(`Platform connection with ID ${id} not found`);
    }
    return connection;
  },

  async listConnections(workspaceId: string): Promise<PlatformConnection[]> {
    logger.debug({ workspaceId }, 'Listing platform connections');
    return platformConnectionRepository.list(workspaceId);
  },

  async createConnection(data: {
    workspaceId: string;
    platform: Platform;
    externalAccountId?: string;
    displayName?: string;
    accessTokenHex: string;
    refreshTokenHex: string;
    expiresAt: Date;
    scopes: string[];
    healthStatus: HealthStatus;
    status: ConnectionStatus;
  }): Promise<PlatformConnection> {
    logger.info({ platform: data.platform, externalAccountId: data.externalAccountId }, 'Creating new platform connection');
    return platformConnectionRepository.create(data);
  },

  async updateConnection(
    id: string,
    data: {
      platform?: Platform;
      externalAccountId?: string;
      displayName?: string;
      accessTokenHex?: string;
      refreshTokenHex?: string;
      expiresAt?: Date;
      scopes?: string[];
      healthStatus?: HealthStatus;
      status?: ConnectionStatus;
    },
    workspaceId?: string
  ): Promise<PlatformConnection> {
    logger.info({ id, data, workspaceId }, 'Updating platform connection');
    await this.getConnectionById(id, workspaceId); // Ensure exists & owned
    return platformConnectionRepository.update(id, data, workspaceId);
  },

  async deleteConnection(id: string, workspaceId?: string): Promise<PlatformConnection> {
    logger.warn({ id, workspaceId }, 'Deleting platform connection');
    await this.getConnectionById(id, workspaceId); // Ensure exists & owned
    return platformConnectionRepository.delete(id, workspaceId);
  },
};

export default platformConnectionService;
