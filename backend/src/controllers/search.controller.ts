import { Request, Response, NextFunction } from 'express';
import searchService from '../services/search.service.js';

export const searchController = {
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspaceId as string;
      const query = (req.query.q as string || '').trim();

      const results = await searchService.searchAll(workspaceId, query);

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
