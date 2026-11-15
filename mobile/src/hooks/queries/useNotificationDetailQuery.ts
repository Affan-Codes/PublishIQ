import { useQuery } from '@tanstack/react-query';
import { getNotificationById } from '../../api/endpoints/notifications';
import { Notification } from '../../types/domain';

export function useNotificationDetailQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery<Notification>({
    queryKey: ['notification', id],
    queryFn: ({ signal }) => getNotificationById(id, signal),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
}
