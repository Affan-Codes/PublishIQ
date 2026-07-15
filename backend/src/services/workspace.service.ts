import workspaceRepository from '../repositories/workspace.repository.js';
import { NotFoundError } from '../errors/custom-errors.js';
import { Workspace } from '@prisma/client';
import { logger } from '../utils/logger.js';

export const workspaceService = {
  async getWorkspaceById(id: string): Promise<Workspace> {
    logger.debug({ id }, 'Fetching workspace by ID');
    const workspace = await workspaceRepository.getById(id);
    if (!workspace) {
      throw new NotFoundError(`Workspace with ID ${id} not found`);
    }
    return workspace;
  },

  async listWorkspaces(): Promise<Workspace[]> {
    logger.debug('Listing all workspaces');
    return workspaceRepository.list();
  },

  async createWorkspace(name: string): Promise<Workspace> {
    logger.info({ name }, 'Creating new workspace');
    return workspaceRepository.create(name);
  },

  async updateWorkspace(id: string, name: string): Promise<Workspace> {
    logger.info({ id, name }, 'Updating workspace name');
    await this.getWorkspaceById(id); // Ensure it exists
    return workspaceRepository.update(id, name);
  },

  async deleteWorkspace(id: string): Promise<Workspace> {
    logger.warn({ id }, 'Deleting workspace');
    await this.getWorkspaceById(id); // Ensure it exists
    return workspaceRepository.delete(id);
  },
};

export default workspaceService;
