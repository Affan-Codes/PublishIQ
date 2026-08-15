import contentProfileRepository from '../repositories/contentProfile.repository.js';
import contentTypeRepository from '../repositories/contentType.repository.js';
import promptRepository from '../repositories/prompt.repository.js';
import templateRepository from '../repositories/template.repository.js';
import { NotFoundError, ValidationError } from '../errors/custom-errors.js';
import { ContentProfile, ContentProfileStatus, Language } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { SYSTEM_PROMPT_VARIABLES, extractPromptVariables } from '../constants/prompt-variables.js';

function validatePromptVariableCollisions(promptVariables?: Record<string, any>) {
  if (!promptVariables || typeof promptVariables !== 'object') return;
  const reserved = new Set<string>([...SYSTEM_PROMPT_VARIABLES, 'writingStyle']);
  for (const key of Object.keys(promptVariables)) {
    if (reserved.has(key)) {
      throw new ValidationError(`Reserved system variable cannot be overridden in promptVariables: ${key}`);
    }
  }
}

function validatePromptTokenCoverage(promptBody: string, promptVariables?: Record<string, any>) {
  const tokens = extractPromptVariables(promptBody);
  if (tokens.length === 0) return;
  const customKeys = promptVariables && typeof promptVariables === 'object' ? Object.keys(promptVariables) : [];
  const allowed = new Set<string>([...SYSTEM_PROMPT_VARIABLES, ...customKeys, 'writingStyle']);
  const uncovered = tokens.filter((t) => !allowed.has(t));
  if (uncovered.length > 0) {
    throw new ValidationError(`Prompt version references uncovered variable(s): ${uncovered.join(', ')}`);
  }
}

export const contentProfileService = {
  async getProfileById(id: string, workspaceId?: string) {
    logger.debug({ id, workspaceId }, 'Fetching content profile by ID');
    const profile = await contentProfileRepository.getById(id, workspaceId);
    if (!profile) {
      throw new NotFoundError(`ContentProfile with ID ${id} not found`);
    }
    return profile;
  },

  async listProfiles(workspaceId: string) {
    logger.debug({ workspaceId }, 'Listing content profiles');
    return contentProfileRepository.list(workspaceId);
  },

  async createProfile(data: {
    workspaceId: string;
    name: string;
    status: ContentProfileStatus;
    contentTypeId: string;
    promptVersionId: string;
    templateVersionId: string;
    language: Language;
    tone: string;
    writingStyle: string;
    promptVariables: any;
    brandingRules: any;
    watermarkRules: any;
    captionStrategy: any;
    hashtagStrategy: any;
    musicSelectionRules: any;
    renderingConfiguration: any;
    validationRules: any;
  }): Promise<ContentProfile> {
    logger.info({ name: data.name }, 'Creating new content profile');

    // CFG-06: Check for reserved system variable collision
    validatePromptVariableCollisions(data.promptVariables);

    // 1. Verify ContentType exists and belongs to the workspace
    const contentType = await contentTypeRepository.getById(data.contentTypeId);
    if (!contentType || contentType.workspaceId !== data.workspaceId) {
      throw new ValidationError(`ContentType ID ${data.contentTypeId} is invalid or not in this workspace`);
    }

    // 2. Verify PromptVersion exists
    const promptVersion = await promptRepository.getPromptVersionById(data.promptVersionId);
    if (!promptVersion) {
      throw new ValidationError(`PromptVersion ID ${data.promptVersionId} is invalid`);
    }
    const prompt = await promptRepository.getById(promptVersion.promptId);
    if (!prompt || prompt.workspaceId !== data.workspaceId) {
      throw new ValidationError(`PromptVersion belongs to a prompt outside this workspace`);
    }

    // CFG-02: Validate prompt token coverage
    validatePromptTokenCoverage(promptVersion.body, data.promptVariables);

    // 3. Verify TemplateVersion exists
    const templateVersion = await templateRepository.getTemplateVersionById(data.templateVersionId);
    if (!templateVersion) {
      throw new ValidationError(`TemplateVersion ID ${data.templateVersionId} is invalid`);
    }
    const template = await templateRepository.getById(templateVersion.templateId);
    if (!template || template.workspaceId !== data.workspaceId) {
      throw new ValidationError(`TemplateVersion belongs to a template outside this workspace`);
    }

    return contentProfileRepository.create(data);
  },

  async updateProfile(
    id: string,
    workspaceId: string,
    data: {
      name?: string;
      status?: ContentProfileStatus;
      contentTypeId?: string;
      promptVersionId?: string;
      templateVersionId?: string;
      language?: Language;
      tone?: string;
      writingStyle?: string;
      promptVariables?: any;
      brandingRules?: any;
      watermarkRules?: any;
      captionStrategy?: any;
      hashtagStrategy?: any;
      musicSelectionRules?: any;
      renderingConfiguration?: any;
      validationRules?: any;
    }
  ): Promise<ContentProfile> {
    logger.info({ id, data }, 'Updating content profile fields');
    const existing = await this.getProfileById(id, workspaceId);

    if (data.promptVariables !== undefined) {
      validatePromptVariableCollisions(data.promptVariables);
    }

    if (data.contentTypeId) {
      const contentType = await contentTypeRepository.getById(data.contentTypeId);
      if (!contentType || contentType.workspaceId !== workspaceId) {
        throw new ValidationError(`ContentType ID ${data.contentTypeId} is invalid or not in this workspace`);
      }
    }

    const effectivePromptVersionId = data.promptVersionId || existing.promptVersionId;
    const effectivePromptVariables = data.promptVariables !== undefined ? data.promptVariables : existing.promptVariables;

    if (data.promptVersionId || data.promptVariables !== undefined) {
      const promptVersion = await promptRepository.getPromptVersionById(effectivePromptVersionId);
      if (!promptVersion) {
        throw new ValidationError(`PromptVersion ID ${effectivePromptVersionId} is invalid`);
      }
      const prompt = await promptRepository.getById(promptVersion.promptId);
      if (!prompt || prompt.workspaceId !== workspaceId) {
        throw new ValidationError(`PromptVersion belongs to a prompt outside this workspace`);
      }
      validatePromptTokenCoverage(promptVersion.body, effectivePromptVariables);
    }

    if (data.templateVersionId) {
      const templateVersion = await templateRepository.getTemplateVersionById(data.templateVersionId);
      if (!templateVersion) {
        throw new ValidationError(`TemplateVersion ID ${data.templateVersionId} is invalid`);
      }
      const template = await templateRepository.getById(templateVersion.templateId);
      if (!template || template.workspaceId !== workspaceId) {
        throw new ValidationError(`TemplateVersion belongs to a template outside this workspace`);
      }
    }

    return contentProfileRepository.update(id, data);
  },

  async deleteProfile(id: string): Promise<ContentProfile> {
    logger.warn({ id }, 'Deleting content profile');
    await this.getProfileById(id); // Ensure exists
    return contentProfileRepository.delete(id);
  },
};

export default contentProfileService;
