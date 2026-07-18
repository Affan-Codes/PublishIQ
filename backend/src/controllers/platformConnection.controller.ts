import { Request, Response, NextFunction } from 'express';
import platformConnectionService from '../services/platformConnection.service.js';

const mapConnectionResponse = (conn: any) => ({
  id: conn.id,
  workspaceId: conn.workspaceId,
  platform: conn.platform,
  expiresAt: conn.expiresAt,
  scopes: conn.scopes,
  healthStatus: conn.healthStatus,
  status: conn.status,
  accessTokenHex: conn.accessTokenEnc ? '********' : '',
  refreshTokenHex: conn.refreshTokenEnc ? '********' : '',
  createdAt: conn.createdAt,
  updatedAt: conn.updatedAt,
});

export const platformConnectionController = {
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const connection = await platformConnectionService.getConnectionById(req.params.id as string);
      res.json({
        success: true,
        data: mapConnectionResponse(connection),
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await platformConnectionService.listConnections(req.workspaceId!);
      res.json({
        success: true,
        data: list.map(mapConnectionResponse),
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const connection = await platformConnectionService.createConnection({
        workspaceId: req.workspaceId!,
        ...req.body,
      });
      res.status(201).json({
        success: true,
        data: mapConnectionResponse(connection),
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const connection = await platformConnectionService.updateConnection(
        req.params.id as string,
        req.body
      );
      res.json({
        success: true,
        data: mapConnectionResponse(connection),
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await platformConnectionService.deleteConnection(req.params.id as string);
      res.json({
        success: true,
        data: {},
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  },
};

export default platformConnectionController;
