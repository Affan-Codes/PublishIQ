import { Prompt, PromptVersion, PromptStatus } from '@prisma/client';
import { prisma } from '../database/db.js';

export const promptRepository = {
  async getById(id: string, workspaceId?: string): Promise<(Prompt & { versions: PromptVersion[] }) | null> {
    if (workspaceId) {
      return prisma.prompt.findFirst({
        where: { id, workspaceId },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
          },
        },
      });
    }
    return prisma.prompt.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });
  },

  async list(workspaceId: string): Promise<Prompt[]> {
    return prisma.prompt.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async create(data: {
    workspaceId: string;
    name: string;
    status: PromptStatus;
    notes?: string | null;
    body: string;
  }): Promise<Prompt & { versions: PromptVersion[] }> {
    return prisma.$transaction(async (tx) => {
      const prompt = await tx.prompt.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          status: data.status,
          notes: data.notes ?? null,
        },
      });

      const version = await tx.promptVersion.create({
        data: {
          promptId: prompt.id,
          versionNumber: 1,
          body: data.body,
          status: data.status,
          notes: 'Initial version',
        },
      });

      return {
        ...prompt,
        versions: [version],
      };
    });
  },

  async updatePrompt(
    id: string,
    data: {
      name?: string;
      status?: PromptStatus;
      notes?: string;
    }
  ): Promise<Prompt> {
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes ?? null;

    return prisma.prompt.update({
      where: { id },
      data: updateData,
    });
  },

  async getVersion(promptId: string, versionNumber: number): Promise<PromptVersion | null> {
    return prisma.promptVersion.findUnique({
      where: {
        promptId_versionNumber: { promptId, versionNumber },
      },
    });
  },

  async getPromptVersionById(id: string): Promise<PromptVersion | null> {
    return prisma.promptVersion.findUnique({
      where: { id },
    });
  },

  async createPromptVersion(data: {
    promptId: string;
    body: string;
    notes?: string | null;
    status: PromptStatus;
  }): Promise<PromptVersion> {
    return prisma.$transaction(async (tx) => {
      const versions = await tx.promptVersion.findMany({
        where: { promptId: data.promptId },
        select: { versionNumber: true },
        orderBy: { versionNumber: 'desc' },
        take: 1,
      });

      const nextVersionNumber = (versions[0]?.versionNumber ?? 0) + 1;

      // Deprecate all previous versions of this prompt
      await tx.promptVersion.updateMany({
        where: { promptId: data.promptId },
        data: { status: PromptStatus.Deprecated },
      });

      // Create new version as the active version
      const newVersion = await tx.promptVersion.create({
        data: {
          promptId: data.promptId,
          versionNumber: nextVersionNumber,
          body: data.body,
          status: data.status,
          notes: data.notes ?? null,
        },
      });

      return newVersion;
    });
  },

  async rollbackPromptVersion(promptId: string, versionNumber: number): Promise<PromptVersion> {
    return prisma.$transaction(async (tx) => {
      const targetVersion = await tx.promptVersion.findUnique({
        where: {
          promptId_versionNumber: { promptId, versionNumber },
        },
      });

      if (!targetVersion) {
        throw new Error(`Prompt version ${versionNumber} not found for prompt ${promptId}`);
      }

      // Deprecate other versions
      await tx.promptVersion.updateMany({
        where: { promptId },
        data: { status: PromptStatus.Deprecated },
      });

      // Set target version status to Active
      const updatedVersion = await tx.promptVersion.update({
        where: { id: targetVersion.id },
        data: { status: PromptStatus.Active },
      });

      return updatedVersion;
    });
  },

  async listVersions(promptId: string): Promise<PromptVersion[]> {
    return prisma.promptVersion.findMany({
      where: { promptId },
      orderBy: { versionNumber: 'desc' },
    });
  },
};

export default promptRepository;
