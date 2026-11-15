import { useInfiniteQuery } from '@tanstack/react-query';
import { getPublishingHistory, PublishingQueryParams } from '../../api/endpoints/publishing';
import { PaginationMeta, PublishingRecord } from '../../types/domain';

export function usePublishingHistoryInfiniteQuery(
  params?: Omit<PublishingQueryParams, 'page'>,
  options?: { enabled?: boolean }
) {
  return useInfiniteQuery<{ data: PublishingRecord[]; meta?: PaginationMeta }>({
    queryKey: ['publishing-history', params],
    queryFn: ({ pageParam = 1, signal }) =>
      getPublishingHistory({ ...params, page: pageParam as number, limit: 20 }, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const currentPage = lastPage.meta?.page ?? 1;
      const total = lastPage.meta?.total ?? 0;
      const limit = lastPage.meta?.limit ?? 20;
      return currentPage * limit < total ? currentPage + 1 : undefined;
    },
    enabled: options?.enabled ?? true,
  });
}
