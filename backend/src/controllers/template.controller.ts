import { Request, Response, NextFunction } from 'express';
import templateService from '../services/template.service.js';
import { renderFromDefinition } from '../templates/definition-engine.js';
import { renderingService } from '../services/rendering.service.js';
import { STRESS_TEST_SCENARIOS } from '../constants/stress-scenarios.js';

export const templateController = {
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await templateService.getTemplateById(req.params.id as string, req.workspaceId!);
      res.json({
        success: true,
        data: template,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId!;
      const list = await templateService.listTemplates(workspaceId);
      res.json({
        success: true,
        data: list,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId!;
      const { name, notes, componentPath, componentSource, category, definition, sampleContent } = req.body;
      const template = await templateService.createTemplate({
        workspaceId,
        name,
        notes,
        componentPath,
        componentSource,
        category,
        definition,
        sampleContent,
      });
      res.status(201).json({
        success: true,
        data: template,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, notes, status } = req.body;
      const template = await templateService.updateTemplate(req.params.id as string, {
        name,
        notes,
        status,
      });
      res.json({
        success: true,
        data: template,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async listVersions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const versions = await templateService.listVersions(req.params.id as string);
      res.json({
        success: true,
        data: versions,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async getVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const version = await templateService.getVersionDetails(
        req.params.id as string,
        parseInt(req.params.versionNumber as string, 10)
      );
      res.json({
        success: true,
        data: version,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async createVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { componentPath, componentSource, category, definition, sampleContent, notes } = req.body;
      const version = await templateService.createVersion(
        req.params.id as string,
        {
          componentPath,
          componentSource,
          category,
          definition,
          sampleContent,
          notes,
        }
      );
      res.status(201).json({
        success: true,
        data: version,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async getPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const versionNumber = parseInt(req.params.versionNumber as string, 10);
      const previewImageUrl = await templateService.getOrGeneratePreview(
        req.params.id as string,
        versionNumber,
        req.workspaceId!
      );
      res.json({
        success: true,
        data: { previewImageUrl },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async rollbackVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const versionNumber = parseInt(req.params.versionNumber as string, 10);
      const version = await templateService.rollbackVersion(req.params.id as string, versionNumber);
      res.json({
        success: true,
        data: version,
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Fast, side-effect-free live preview returning pure HTML string from TemplateDefinition + StructuredContent.
   * Never invokes Playwright, Cloudinary, or any database write.
   */
  async preview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { definition, content, language, branding, watermark, brandingOpacity, watermarkOpacity } = req.body;

      const html = renderFromDefinition({
        definition,
        content,
        language: language || 'English',
        branding,
        watermark,
        brandingOpacity,
        watermarkOpacity,
      });

      res.json({
        success: true,
        data: { html },
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Evaluates fixed stress-test scenarios (short, long, max blocks, heavy emphasis, code, 4 languages)
   * against the unsaved TemplateDefinition for compatibility and layout overflow.
   */
  async stressTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { definition } = req.body;

      const scenariosResults = await Promise.all(
        STRESS_TEST_SCENARIOS.map(async (scenario) => {
          const evalResult = await renderingService.evaluateLayoutFit(
            definition,
            scenario.content,
            scenario.language
          );

          return {
            id: scenario.id,
            name: scenario.name,
            description: scenario.description,
            language: scenario.language,
            status: evalResult.status,
            message: evalResult.message,
            content: scenario.content,
          };
        })
      );

      res.json({
        success: true,
        data: {
          scenarios: scenariosResults,
        },
        meta: {
          totalScenarios: scenariosResults.length,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

export default templateController;
