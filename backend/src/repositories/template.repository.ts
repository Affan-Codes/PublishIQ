import { Template, TemplateVersion, PromptStatus } from '@prisma/client';
import { prisma } from '../database/db.js';

export const templateRepository = {
  async getById(id: string): Promise<(Template & { versions: TemplateVersion[] }) | null> {
    return prisma.template.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });
  },

  async list(workspaceId: string): Promise<Template[]> {
    return prisma.template.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async create(data: {
    workspaceId: string;
    name: string;
    status: PromptStatus;
    notes?: string | null;
    componentPath: string;
    componentSource?: string | null;
  }): Promise<Template & { versions: TemplateVersion[] }> {
    return prisma.$transaction(async (tx) => {
      const template = await tx.template.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          status: data.status,
          notes: data.notes ?? null,
        },
      });

      const version = await tx.templateVersion.create({
        data: {
          templateId: template.id,
          versionNumber: 1,
          componentPath: data.componentPath,
          componentSource: data.componentSource ?? null,
          status: data.status,
          notes: 'Initial version',
        },
      });

      return {
        ...template,
        versions: [version],
      };
    });
  },

  async updateTemplate(
    id: string,
    data: {
      name?: string;
      status?: PromptStatus;
      notes?: string;
    }
  ): Promise<Template> {
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes ?? null;

    return prisma.template.update({
      where: { id },
      data: updateData,
    });
  },

  async getVersion(templateId: string, versionNumber: number): Promise<TemplateVersion | null> {
    return prisma.templateVersion.findUnique({
      where: {
        templateId_versionNumber: { templateId, versionNumber },
      },
    });
  },

  async getTemplateVersionById(id: string): Promise<TemplateVersion | null> {
    return prisma.templateVersion.findUnique({
      where: { id },
    });
  },

  async createTemplateVersion(data: {
    templateId: string;
    componentPath: string;
    componentSource?: string | null;
    notes?: string | null;
    status: PromptStatus;
  }): Promise<TemplateVersion> {
    return prisma.$transaction(async (tx) => {
      const versions = await tx.templateVersion.findMany({
        where: { templateId: data.templateId },
        select: { versionNumber: true },
        orderBy: { versionNumber: 'desc' },
        take: 1,
      });

      const nextVersionNumber = (versions[0]?.versionNumber ?? 0) + 1;

      // Deprecate all previous versions of this template
      await tx.templateVersion.updateMany({
        where: { templateId: data.templateId },
        data: { status: PromptStatus.Deprecated },
      });

      // Create new version as the active version
      const newVersion = await tx.templateVersion.create({
        data: {
          templateId: data.templateId,
          versionNumber: nextVersionNumber,
          componentPath: data.componentPath,
          componentSource: data.componentSource ?? null,
          status: data.status,
          notes: data.notes ?? null,
        },
      });

      return newVersion;
    });
  },

  async rollbackTemplateVersion(templateId: string, versionNumber: number): Promise<TemplateVersion> {
    return prisma.$transaction(async (tx) => {
      const targetVersion = await tx.templateVersion.findUnique({
        where: {
          templateId_versionNumber: { templateId, versionNumber },
        },
      });

      if (!targetVersion) {
        throw new Error(`Template version ${versionNumber} not found for template ${templateId}`);
      }

      // Deprecate other versions
      await tx.templateVersion.updateMany({
        where: { templateId },
        data: { status: PromptStatus.Deprecated },
      });

      // Set target version status to Active
      const updatedVersion = await tx.templateVersion.update({
        where: { id: targetVersion.id },
        data: { status: PromptStatus.Active },
      });

      return updatedVersion;
    });
  },

  async listVersions(templateId: string): Promise<TemplateVersion[]> {
    return prisma.templateVersion.findMany({
      where: { templateId },
      orderBy: { versionNumber: 'desc' },
    });
  },
};

export default templateRepository;
