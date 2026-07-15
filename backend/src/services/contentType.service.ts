import contentTypeRepository from '../repositories/contentType.repository.js';
import { NotFoundError } from '../errors/custom-errors.js';
import { ContentType, ContentTypeStatus } from '@prisma/client';
import { logger } from '../utils/logger.js';

export const contentTypeService = {
  async getContentTypeById(id: string): Promise<ContentType> {
    logger.debug({ id }, 'Fetching ContentType by ID');
    const contentType = await contentTypeRepository.getById(id);
    if (!contentType) {
      throw new NotFoundError(`ContentType with ID ${id} not found`);
    }
    return contentType;
  },

  async listContentTypes(workspaceId: string): Promise<ContentType[]> {
    logger.debug({ workspaceId }, 'Listing ContentTypes');
    return contentTypeRepository.list(workspaceId);
  },

  async createContentType(data: {
    workspaceId: string;
    name: string;
    status: ContentTypeStatus;
  }): Promise<ContentType> {
    logger.info(data, 'Creating new ContentType');
    return contentTypeRepository.create(data);
  },

  async updateContentType(
    id: string,
    data: {
      name?: string;
      status?: ContentTypeStatus;
    }
  ): Promise<ContentType> {
    logger.info({ id, data }, 'Updating ContentType');
    await this.getContentTypeById(id); // Ensure it exists
    return contentTypeRepository.update(id, data);
  },

  async deleteContentType(id: string): Promise<ContentType> {
    logger.warn({ id }, 'Deleting ContentType');
    await this.getContentTypeById(id); // Ensure it exists
    return contentTypeRepository.delete(id);
  },
};

export default contentTypeService;
