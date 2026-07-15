import promptRepository from '../repositories/prompt.repository.js';
import { NotFoundError } from '../errors/custom-errors.js';
import { Prompt, PromptVersion, PromptStatus } from '@prisma/client';
import { logger } from '../utils/logger.js';

export const promptService = {
  async getPromptById(id: string): Promise<Prompt & { versions: PromptVersion[] }> {
    logger.debug({ id }, 'Fetching prompt by ID');
    const prompt = await promptRepository.getById(id);
    if (!prompt) {
      throw new NotFoundError(`Prompt with ID ${id} not found`);
    }
    return prompt;
  },

  async listPrompts(workspaceId: string): Promise<Prompt[]> {
    logger.debug({ workspaceId }, 'Listing prompts');
    return promptRepository.list(workspaceId);
  },

  async createPrompt(data: {
    workspaceId: string;
    name: string;
    notes?: string;
    body: string;
  }): Promise<Prompt & { versions: PromptVersion[] }> {
    logger.info({ name: data.name }, 'Creating new prompt');
    return promptRepository.create({
      workspaceId: data.workspaceId,
      name: data.name,
      notes: data.notes ?? null,
      body: data.body,
      status: PromptStatus.Active,
    });
  },

  async updatePrompt(
    id: string,
    data: {
      name?: string;
      notes?: string;
      status?: PromptStatus;
    }
  ): Promise<Prompt> {
    logger.info({ id, data }, 'Updating prompt fields');
    await this.getPromptById(id); // Ensure exists
    return promptRepository.updatePrompt(id, data);
  },

  async createVersion(
    promptId: string,
    body: string,
    notes?: string
  ): Promise<PromptVersion> {
    logger.info({ promptId }, 'Adding a new version to prompt');
    await this.getPromptById(promptId); // Ensure exists
    return promptRepository.createPromptVersion({
      promptId,
      body,
      notes: notes ?? null,
      status: PromptStatus.Active,
    });
  },

  async rollbackVersion(promptId: string, versionNumber: number): Promise<PromptVersion> {
    logger.warn({ promptId, versionNumber }, 'Rolling back prompt default to specific version number');
    await this.getPromptById(promptId); // Ensure exists
    try {
      return await promptRepository.rollbackPromptVersion(promptId, versionNumber);
    } catch (err: any) {
      throw new NotFoundError(err.message || 'Prompt version not found');
    }
  },

  async listVersions(promptId: string): Promise<PromptVersion[]> {
    logger.debug({ promptId }, 'Listing prompt versions');
    await this.getPromptById(promptId); // Ensure exists
    return promptRepository.listVersions(promptId);
  },

  async getVersionDetails(promptId: string, versionNumber: number): Promise<PromptVersion> {
    logger.debug({ promptId, versionNumber }, 'Getting prompt version details');
    const version = await promptRepository.getVersion(promptId, versionNumber);
    if (!version) {
      throw new NotFoundError(`Prompt version ${versionNumber} not found for prompt ${promptId}`);
    }
    return version;
  },
};

export default promptService;
