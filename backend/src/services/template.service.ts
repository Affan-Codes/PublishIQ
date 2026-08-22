import templateRepository, { TemplateWithDetails } from '../repositories/template.repository.js';
import { NotFoundError } from '../errors/custom-errors.js';
import { Template, TemplateVersion, PromptStatus, TemplateCategory } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { renderingService } from './rendering.service.js';
import { V1_SAMPLE_CONTENTS } from '../schemas/template-definition.schema.js';
import { StructuredContent } from '../schemas/content-block.schema.js';

export const templateService = {
  async getTemplateById(id: string, workspaceId?: string): Promise<TemplateWithDetails> {
    logger.debug({ id, workspaceId }, 'Fetching template by ID');
    const template = await templateRepository.getById(id, workspaceId);
    if (!template) {
      throw new NotFoundError(`Template with ID ${id} not found`);
    }
    return template;
  },

  async listTemplates(workspaceId: string): Promise<Array<Template & { versions?: TemplateVersion[]; usedByCount?: number }>> {
    logger.debug({ workspaceId }, 'Listing templates');
    return templateRepository.list(workspaceId);
  },

  async createTemplate(data: {
    workspaceId: string;
    name: string;
    notes?: string | null;
    componentPath?: string | null;
    componentSource?: string | null;
    category?: TemplateCategory | null;
    definition?: any;
    sampleContent?: any;
  }): Promise<Template & { versions: TemplateVersion[] }> {
    logger.info({ name: data.name, category: data.category }, 'Creating new template');

    // Auto-populate default sample content if category is recognized and sampleContent was not supplied
    let sampleContent = data.sampleContent;
    if (!sampleContent && data.category && (V1_SAMPLE_CONTENTS as any)[data.category]) {
      sampleContent = (V1_SAMPLE_CONTENTS as any)[data.category];
    }

    const templateWithVersions = await templateRepository.create({
      workspaceId: data.workspaceId,
      name: data.name,
      notes: data.notes ?? null,
      componentPath: data.componentPath ?? null,
      componentSource: data.componentSource ?? null,
      category: data.category ?? null,
      definition: data.definition ?? null,
      sampleContent: sampleContent ?? null,
      status: PromptStatus.Active,
    });

    const v1 = templateWithVersions.versions[0];
    if (v1 && data.definition) {
      try {
        const previewUrl = await this.generatePreviewForVersion(v1);
        if (previewUrl) {
          v1.previewImageUrl = previewUrl;
        }
      } catch (err) {
        logger.warn({ templateId: templateWithVersions.id, err }, 'Failed to generate initial template version preview synchronously');
      }
    }

    return templateWithVersions;
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
    data: {
      componentPath?: string | null;
      componentSource?: string | null;
      category?: TemplateCategory | null;
      definition?: any;
      sampleContent?: any;
      notes?: string | null;
    }
  ): Promise<TemplateVersion> {
    logger.info({ templateId, category: data.category }, 'Adding a new version to template');
    const existing = await this.getTemplateById(templateId);

    let sampleContent = data.sampleContent;
    if (!sampleContent && data.category && (V1_SAMPLE_CONTENTS as any)[data.category]) {
      sampleContent = (V1_SAMPLE_CONTENTS as any)[data.category];
    }

    const newVersion = await templateRepository.createTemplateVersion({
      templateId,
      componentPath: data.componentPath ?? null,
      componentSource: data.componentSource ?? null,
      category: data.category ?? (existing.versions[0]?.category as TemplateCategory) ?? null,
      definition: data.definition ?? null,
      sampleContent: sampleContent ?? null,
      notes: data.notes ?? null,
      status: PromptStatus.Active,
    });

    if (data.definition) {
      try {
        const previewUrl = await this.generatePreviewForVersion(newVersion);
        if (previewUrl) {
          newVersion.previewImageUrl = previewUrl;
        }
      } catch (err) {
        logger.warn({ templateId, versionNumber: newVersion.versionNumber, err }, 'Failed to generate template version preview synchronously');
      }
    }

    return newVersion;
  },

  async getOrGeneratePreview(templateId: string, versionNumber: number, workspaceId?: string): Promise<string> {
    const version = await this.getVersionDetails(templateId, versionNumber);

    if (version.previewImageUrl) {
      return version.previewImageUrl;
    }

    const previewUrl = await this.generatePreviewForVersion(version);
    if (!previewUrl) {
      throw new Error('Failed to generate template preview image');
    }
    return previewUrl;
  },

  async generatePreviewForVersion(version: TemplateVersion): Promise<string | null> {
    const sampleContent: StructuredContent = (version.sampleContent as StructuredContent) ||
      (version.category && (V1_SAMPLE_CONTENTS as any)[version.category]) || {
        blocks: [
          {
            type: 'body',
            runs: [{ text: 'Preview sample quote text for template', emphasis: 'normal' }],
          },
        ],
      };

    const jobId = `preview_${version.templateId}_v${version.versionNumber}_${Date.now()}`;
    const text = sampleContent.blocks
      .map((b) => (b.runs || []).map((r) => r.text).join(''))
      .join('\n');

    const result = await renderingService.renderImage(jobId, text, {
      language: 'English',
      branding: 'PUBLISHIQ',
      watermark: '@publishiq',
      templateVersionId: version.id,
      content: sampleContent,
      hasBackground: false,
    });

    if (result.imageUrl) {
      await templateRepository.updatePreviewImageUrl(version.id, result.imageUrl);
      return result.imageUrl;
    }

    return null;
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
