import { useInfiniteQuery } from '@tanstack/react-query';
import { getGeneratedContents, GeneratedContentsQueryParams } from '../../api/endpoints/generated-contents';
import { GeneratedContent, PaginationMeta } from '../../types/domain';

export function useGeneratedContentsInfiniteQuery(
  params?: Omit<GeneratedContentsQueryParams, 'page'>,
  options?: { enabled?: boolean }
) {
  return useInfiniteQuery<{ data: GeneratedContent[]; meta?: PaginationMeta }>({
    queryKey: ['generated-contents', params],
    queryFn: ({ pageParam = 1, signal }) =>
      getGeneratedContents({ ...params, page: pageParam as number, limit: 20 }, signal),
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
