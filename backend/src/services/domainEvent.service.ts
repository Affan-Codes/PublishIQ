import { DomainEvent } from '@prisma/client';
import { domainEventRepository, DomainEventListFilters } from '../repositories/domainEvent.repository.js';
import { NotFoundError } from '../errors/custom-errors.js';

export interface DomainEventResponseItem {
  id: string;
  type: string;
  payload: any;
  jobId: string | null;
  createdAt: Date;
}

export const domainEventService = {
  async listDomainEvents(
    workspaceId: string,
    filters: DomainEventListFilters
  ): Promise<{
    items: DomainEventResponseItem[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;

    const { items, total } = await domainEventRepository.list(workspaceId, filters);

    const totalPages = Math.ceil(total / limit) || 1;

    const mappedItems: DomainEventResponseItem[] = items.map((event) => ({
      id: event.id,
      type: event.type,
      payload: event.payload,
      jobId: event.jobId,
      createdAt: event.createdAt,
    }));

    return {
      items: mappedItems,
      page,
      limit,
      total,
      totalPages,
    };
  },

  async getDomainEventById(id: string, workspaceId: string): Promise<DomainEventResponseItem> {
    const event = await domainEventRepository.getById(id, workspaceId);
    if (!event) {
      throw new NotFoundError('Domain event not found');
    }
    return {
      id: event.id,
      type: event.type,
      payload: event.payload,
      jobId: event.jobId,
      createdAt: event.createdAt,
    };
  },
};

export default domainEventService;
