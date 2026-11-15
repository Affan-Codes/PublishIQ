import { useInfiniteQuery } from '@tanstack/react-query';
import { getNotifications, NotificationsQueryParams } from '../../api/endpoints/notifications';
import { Notification, PaginationMeta } from '../../types/domain';

export function useNotificationsInfiniteQuery(
  params?: Omit<NotificationsQueryParams, 'page'>,
  options?: { enabled?: boolean }
) {
  return useInfiniteQuery<{ data: Notification[]; meta?: PaginationMeta }>({
    queryKey: ['notifications', params],
    queryFn: ({ pageParam = 1, signal }) =>
      getNotifications({ ...params, page: pageParam as number, limit: 20 }, signal),
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
