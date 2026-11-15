import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../../api/endpoints/notifications';
import { useToast } from '../../providers/ToastProvider';

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onMutate: async (id: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      await queryClient.cancelQueries({ queryKey: ['notifications', 'unread-count'] });

      // Snapshot previous values for rollback
      const prevUnread = queryClient.getQueryData<number>(['notifications', 'unread-count']);

      // Optimistically decrement unread count (min 0)
      if (typeof prevUnread === 'number' && prevUnread > 0) {
        queryClient.setQueryData<number>(['notifications', 'unread-count'], prevUnread - 1);
      }

      return { prevUnread };
    },
    onError: (err: any, _, context) => {
      // Rollback on failure
      if (context?.prevUnread !== undefined) {
        queryClient.setQueryData(['notifications', 'unread-count'], context.prevUnread);
      }
      toast.error(err?.message || 'Failed to mark notification as read');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: () => markAllAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      await queryClient.cancelQueries({ queryKey: ['notifications', 'unread-count'] });

      const prevUnread = queryClient.getQueryData<number>(['notifications', 'unread-count']);
      queryClient.setQueryData<number>(['notifications', 'unread-count'], 0);

      return { prevUnread };
    },
    onSuccess: () => {
      toast.success('All notifications marked as read');
    },
    onError: (err: any, _, context) => {
      if (context?.prevUnread !== undefined) {
        queryClient.setQueryData(['notifications', 'unread-count'], context.prevUnread);
      }
      toast.error(err?.message || 'Failed to mark all as read');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
}

export function useDeleteNotificationMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      toast.success('Notification deleted');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete notification');
    },
  });
}
