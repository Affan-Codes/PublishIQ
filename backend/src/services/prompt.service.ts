import promptRepository from '../repositories/prompt.repository.js';
import contentProfileRepository from '../repositories/contentProfile.repository.js';
import { NotFoundError } from '../errors/custom-errors.js';
import { Prompt, PromptVersion, PromptStatus } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { geminiResponseSchema } from '../providers/ai/gemini.provider.js';
import { extractPromptVariables } from '../constants/prompt-variables.js';

export type PromptVersionWithUsage = PromptVersion & {
  usedByProfileCount?: number;
  variables?: string[];
};

export const promptService = {
  getOutputContract(): Array<{ key: string; type: string; description: string; required: boolean }> {
    const props = geminiResponseSchema.properties as Record<string, { type: string; description: string }>;
    const requiredSet = new Set(geminiResponseSchema.required || []);
    return Object.entries(props).map(([key, value]) => ({
      key,
      type: value.type,
      description: value.description,
      required: requiredSet.has(key),
    }));
  },

  async getPromptById(id: string, workspaceId?: string): Promise<Prompt & { versions: PromptVersionWithUsage[] }> {
    logger.debug({ id, workspaceId }, 'Fetching prompt by ID');
    const prompt = await promptRepository.getById(id, workspaceId);
    if (!prompt) {
      throw new NotFoundError(`Prompt with ID ${id} not found`);
    }

    const versionIds = prompt.versions.map((v) => v.id);
    const targetWorkspaceId = workspaceId || prompt.workspaceId;
    const counts = await contentProfileRepository.countByPromptVersionIds(versionIds, targetWorkspaceId);

    const versionsWithCount = prompt.versions.map((v) => ({
      ...v,
      usedByProfileCount: counts[v.id] || 0,
      variables: extractPromptVariables(v.body),
    }));

    return {
      ...prompt,
      versions: versionsWithCount,
    };
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

  async listVersions(promptId: string, workspaceId?: string): Promise<PromptVersionWithUsage[]> {
    logger.debug({ promptId }, 'Listing prompt versions');
    const prompt = await this.getPromptById(promptId, workspaceId);
    return prompt.versions;
  },

  async getVersionDetails(promptId: string, versionNumber: number): Promise<PromptVersion & { variables?: string[] }> {
    logger.debug({ promptId, versionNumber }, 'Getting prompt version details');
    const version = await promptRepository.getVersion(promptId, versionNumber);
    if (!version) {
      throw new NotFoundError(`Prompt version ${versionNumber} not found for prompt ${promptId}`);
    }
    return {
      ...version,
      variables: extractPromptVariables(version.body),
    };
  },

  async testPromptVersion(
    promptId: string,
    versionNumber: number,
    workspaceId: string,
    variables: Record<string, any>
  ): Promise<{ text: string; metadata?: any; versionNumber: number }> {
    logger.info({ promptId, versionNumber }, 'Running test generation for prompt version');
    await this.getPromptById(promptId, workspaceId);
    const version = await this.getVersionDetails(promptId, versionNumber);

    // Call Gemini AI provider adapter directly for testing
    const aiResponse = await (await import('../providers/ai/gemini.provider.js')).geminiProvider.generate(
      {
        body: version.body,
        versionNumber: version.versionNumber,
      },
      variables
    );

    return {
      text: aiResponse.text,
      metadata: aiResponse.metadata,
      versionNumber: version.versionNumber,
    };
  },
};

export default promptService;
