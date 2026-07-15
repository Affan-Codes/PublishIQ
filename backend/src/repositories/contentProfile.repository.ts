import { ContentProfile, ContentProfileStatus, Language } from '@prisma/client';
import { prisma } from '../database/db.js';

export const contentProfileRepository = {
  async getById(id: string) {
    return prisma.contentProfile.findUnique({
      where: { id },
      include: {
        contentType: true,
        promptVersion: {
          include: { prompt: true },
        },
        templateVersion: {
          include: { template: true },
        },
      },
    });
  },

  async list(workspaceId: string) {
    return prisma.contentProfile.findMany({
      where: { workspaceId },
      include: {
        contentType: true,
        promptVersion: {
          include: { prompt: true },
        },
        templateVersion: {
          include: { template: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(data: {
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
    return prisma.contentProfile.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        status: data.status,
        contentTypeId: data.contentTypeId,
        promptVersionId: data.promptVersionId,
        templateVersionId: data.templateVersionId,
        language: data.language,
        tone: data.tone,
        writingStyle: data.writingStyle,
        promptVariables: data.promptVariables ?? {},
        brandingRules: data.brandingRules ?? {},
        watermarkRules: data.watermarkRules ?? {},
        captionStrategy: data.captionStrategy ?? {},
        hashtagStrategy: data.hashtagStrategy ?? {},
        musicSelectionRules: data.musicSelectionRules ?? {},
        renderingConfiguration: data.renderingConfiguration ?? {},
        validationRules: data.validationRules ?? {},
      },
    });
  },

  async update(
    id: string,
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
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.contentTypeId !== undefined) updateData.contentTypeId = data.contentTypeId;
    if (data.promptVersionId !== undefined) updateData.promptVersionId = data.promptVersionId;
    if (data.templateVersionId !== undefined) updateData.templateVersionId = data.templateVersionId;
    if (data.language !== undefined) updateData.language = data.language;
    if (data.tone !== undefined) updateData.tone = data.tone;
    if (data.writingStyle !== undefined) updateData.writingStyle = data.writingStyle;
    if (data.promptVariables !== undefined) updateData.promptVariables = data.promptVariables;
    if (data.brandingRules !== undefined) updateData.brandingRules = data.brandingRules;
    if (data.watermarkRules !== undefined) updateData.watermarkRules = data.watermarkRules;
    if (data.captionStrategy !== undefined) updateData.captionStrategy = data.captionStrategy;
    if (data.hashtagStrategy !== undefined) updateData.hashtagStrategy = data.hashtagStrategy;
    if (data.musicSelectionRules !== undefined) updateData.musicSelectionRules = data.musicSelectionRules;
    if (data.renderingConfiguration !== undefined) updateData.renderingConfiguration = data.renderingConfiguration;
    if (data.validationRules !== undefined) updateData.validationRules = data.validationRules;

    return prisma.contentProfile.update({
      where: { id },
      data: updateData,
    });
  },

  async delete(id: string): Promise<ContentProfile> {
    return prisma.contentProfile.delete({
      where: { id },
    });
  },
};

export default contentProfileRepository;
