import { useInfiniteQuery } from '@tanstack/react-query';
import { getJobs, JobsQueryParams } from '../../api/endpoints/jobs';
import { Job, PaginationMeta } from '../../types/domain';

export function useJobsInfiniteQuery(
  params?: Omit<JobsQueryParams, 'page'>,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false | ((query: any) => number | false | undefined);
  }
) {
  return useInfiniteQuery<{ data: Job[]; meta?: PaginationMeta }>({
    queryKey: ['jobs', params],
    queryFn: ({ pageParam = 1, signal }) =>
      getJobs({ ...params, page: pageParam as number, limit: 20 }, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const currentPage = lastPage.meta?.page ?? 1;
      const total = lastPage.meta?.total ?? 0;
      const limit = lastPage.meta?.limit ?? 20;
      return currentPage * limit < total ? currentPage + 1 : undefined;
    },
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
  });
}
