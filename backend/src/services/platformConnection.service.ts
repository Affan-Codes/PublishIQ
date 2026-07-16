import platformConnectionRepository from '../repositories/platformConnection.repository.js';
import { NotFoundError } from '../errors/custom-errors.js';
import { PlatformConnection, Platform, HealthStatus, ConnectionStatus } from '@prisma/client';
import { logger } from '../utils/logger.js';

export const platformConnectionService = {
  async getConnectionById(id: string): Promise<PlatformConnection> {
    logger.debug({ id }, 'Fetching platform connection by ID');
    const connection = await platformConnectionRepository.getById(id);
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
    accessTokenHex: string;
    refreshTokenHex: string;
    expiresAt: Date;
    scopes: string[];
    healthStatus: HealthStatus;
    status: ConnectionStatus;
  }): Promise<PlatformConnection> {
    logger.info({ platform: data.platform }, 'Creating new platform connection');
    return platformConnectionRepository.create(data);
  },

  async updateConnection(
    id: string,
    data: {
      platform?: Platform;
      accessTokenHex?: string;
      refreshTokenHex?: string;
      expiresAt?: Date;
      scopes?: string[];
      healthStatus?: HealthStatus;
      status?: ConnectionStatus;
    }
  ): Promise<PlatformConnection> {
    logger.info({ id, data }, 'Updating platform connection');
    await this.getConnectionById(id); // Ensure exists
    return platformConnectionRepository.update(id, data);
  },

  async deleteConnection(id: string): Promise<PlatformConnection> {
    logger.warn({ id }, 'Deleting platform connection');
    await this.getConnectionById(id); // Ensure exists
    return platformConnectionRepository.delete(id);
  },
};

export default platformConnectionService;
