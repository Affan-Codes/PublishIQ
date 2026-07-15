import templateRepository from '../repositories/template.repository.js';
import { NotFoundError } from '../errors/custom-errors.js';
import { Template, TemplateVersion, PromptStatus } from '@prisma/client';
import { logger } from '../utils/logger.js';

export const templateService = {
  async getTemplateById(id: string): Promise<Template & { versions: TemplateVersion[] }> {
    logger.debug({ id }, 'Fetching template by ID');
    const template = await templateRepository.getById(id);
    if (!template) {
      throw new NotFoundError(`Template with ID ${id} not found`);
    }
    return template;
  },

  async listTemplates(workspaceId: string): Promise<Template[]> {
    logger.debug({ workspaceId }, 'Listing templates');
    return templateRepository.list(workspaceId);
  },

  async createTemplate(data: {
    workspaceId: string;
    name: string;
    notes?: string;
    componentPath: string;
    componentSource?: string;
  }): Promise<Template & { versions: TemplateVersion[] }> {
    logger.info({ name: data.name }, 'Creating new template');
    return templateRepository.create({
      workspaceId: data.workspaceId,
      name: data.name,
      notes: data.notes ?? null,
      componentPath: data.componentPath,
      componentSource: data.componentSource ?? null,
      status: PromptStatus.Active,
    });
  },

  async updateTemplate(
    id: string,
    data: {
      name?: string;
      notes?: string;
      status?: PromptStatus;
    }
  ): Promise<Template> {
    logger.info({ id, data }, 'Updating template fields');
    await this.getTemplateById(id); // Ensure exists
    return templateRepository.updateTemplate(id, data);
  },

  async createVersion(
    templateId: string,
    componentPath: string,
    componentSource?: string,
    notes?: string
  ): Promise<TemplateVersion> {
    logger.info({ templateId }, 'Adding a new version to template');
    await this.getTemplateById(templateId); // Ensure exists
    return templateRepository.createTemplateVersion({
      templateId,
      componentPath,
      componentSource: componentSource ?? null,
      notes: notes ?? null,
      status: PromptStatus.Active,
    });
  },

  async rollbackVersion(templateId: string, versionNumber: number): Promise<TemplateVersion> {
    logger.warn({ templateId, versionNumber }, 'Rolling back template default to specific version number');
    await this.getTemplateById(templateId); // Ensure exists
    try {
      return await templateRepository.rollbackTemplateVersion(templateId, versionNumber);
    } catch (err: any) {
      throw new NotFoundError(err.message || 'Template version not found');
    }
  },

  async listVersions(templateId: string): Promise<TemplateVersion[]> {
    logger.debug({ templateId }, 'Listing template versions');
    await this.getTemplateById(templateId); // Ensure exists
    return templateRepository.listVersions(templateId);
  },

  async getVersionDetails(templateId: string, versionNumber: number): Promise<TemplateVersion> {
    logger.debug({ templateId, versionNumber }, 'Getting template version details');
    const version = await templateRepository.getVersion(templateId, versionNumber);
    if (!version) {
      throw new NotFoundError(`Template version ${versionNumber} not found for template ${templateId}`);
    }
    return version;
  },
};

export default templateService;
