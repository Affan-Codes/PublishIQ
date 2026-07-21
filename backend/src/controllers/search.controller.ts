import { Request, Response, NextFunction } from 'express';
import { searchRepository } from '../repositories/search.repository.js';

export const searchController = {
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId as string;
      const query = (req.query.q as string || '').trim();

      if (!query) {
        res.json({
          success: true,
          data: {
            channels: [],
            generatedContents: [],
            jobs: [],
            publishingRecords: [],
            assets: [],
            templates: [],
            prompts: [],
            contentProfiles: [],
          },
          meta: {},
        });
        return;
      }

      const results = await searchRepository.searchAll(workspaceId, query);

      res.json({
        success: true,
        data: results,
        meta: {
          query,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

export default searchController;

