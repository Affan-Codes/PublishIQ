import { Template, TemplateVersion, PromptStatus, TemplateCategory } from '@prisma/client';
import { prisma } from '../database/db.js';

export interface TemplateWithDetails extends Template {
  versions: TemplateVersion[];
  usedByCount?: number;
}

export const templateRepository = {
  async getById(id: string, workspaceId?: string): Promise<(Template & { versions: TemplateVersion[]; usedByCount?: number }) | null> {
    const where: any = { id };
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }
    const template = await prisma.template.findFirst({
      where,
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!template) return null;

    const usedByCount = await this.countUsedBy(template.id);
    return {
      ...template,
      usedByCount,
    };
  },

  async list(workspaceId: string): Promise<Array<Template & { versions?: TemplateVersion[]; usedByCount?: number }>> {
    const templates = await prisma.template.findMany({
      where: { workspaceId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Single efficient aggregation to compute usedBy count for each template
    const counts = await this.getUsedByCounts(workspaceId);

    return templates.map((t) => ({
      ...t,
      usedByCount: counts[t.id] || 0,
    }));
  },

  async countUsedBy(templateId: string): Promise<number> {
    return prisma.contentProfile.count({
      where: {
        templateVersion: {
          templateId,
        },
      },
    });
  },

  async getUsedByCounts(workspaceId: string): Promise<Record<string, number>> {
    const profiles = await prisma.contentProfile.findMany({
      where: { workspaceId },
      select: {
        templateVersion: {
          select: {
            templateId: true,
          },
        },
      },
    });

    const counts: Record<string, number> = {};
    for (const p of profiles) {
      const tId = p.templateVersion?.templateId;
      if (tId) {
        counts[tId] = (counts[tId] || 0) + 1;
      }
    }
    return counts;
  },

  async create(data: {
    workspaceId: string;
    name: string;
    status: PromptStatus;
    notes?: string | null;
    componentPath?: string | null;
    componentSource?: string | null;
    category?: TemplateCategory | null;
    definition?: any;
    sampleContent?: any;
    previewImageUrl?: string | null;
  }): Promise<Template & { versions: TemplateVersion[] }> {
    return prisma.$transaction(
      async (tx) => {
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
            componentPath: data.componentPath ?? null,
            componentSource: data.componentSource ?? null,
            category: data.category ?? null,
            definition: data.definition ?? null,
            sampleContent: data.sampleContent ?? null,
            previewImageUrl: data.previewImageUrl ?? null,
            status: data.status,
            notes: 'Initial version',
          },
        });

        return {
          ...template,
          versions: [version],
        };
      }
    );
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
    componentPath?: string | null;
    componentSource?: string | null;
    category?: TemplateCategory | null;
    definition?: any;
    sampleContent?: any;
    previewImageUrl?: string | null;
    notes?: string | null;
    status: PromptStatus;
  }): Promise<TemplateVersion> {
    return prisma.$transaction(
      async (tx) => {
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
            componentPath: data.componentPath ?? null,
            componentSource: data.componentSource ?? null,
            category: data.category ?? null,
            definition: data.definition ?? null,
            sampleContent: data.sampleContent ?? null,
            previewImageUrl: data.previewImageUrl ?? null,
            status: data.status,
            notes: data.notes ?? null,
          },
        });

        return newVersion;
      },
      { maxWait: 15000, timeout: 30000 }
    );
  },

  async updatePreviewImageUrl(templateVersionId: string, previewImageUrl: string): Promise<TemplateVersion> {
    return prisma.templateVersion.update({
      where: { id: templateVersionId },
      data: { previewImageUrl },
    });
  },

  async rollbackTemplateVersion(templateId: string, versionNumber: number): Promise<TemplateVersion> {
    return prisma.$transaction(
      async (tx) => {
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
      },
      { maxWait: 15000, timeout: 30000 }
    );
  },

  async listVersions(templateId: string): Promise<TemplateVersion[]> {
    return prisma.templateVersion.findMany({
      where: { templateId },
      orderBy: { versionNumber: 'desc' },
    });
  },
};

export default templateRepository;
