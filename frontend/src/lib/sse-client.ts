import { QueryClient } from '@tanstack/react-query';

/**
 * Initializes EventSource connection to notification stream.
 * Invalidates React Query cache tags on receive and triggers UI toast callbacks.
 */
export function connectSSE(
  queryClient: QueryClient,
  onNotification: (message: string) => void
): () => void {
  const eventSourceUrl = `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/notifications/stream`;
  const eventSource = new EventSource(eventSourceUrl, { withCredentials: true });

  eventSource.addEventListener('notification', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.message) {
        onNotification(data.message);
      }

      if (data.unreadCount !== undefined) {
        queryClient.setQueryData(['notifications', 'unread-count'], data.unreadCount);
      }

      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (err) {
      console.error('Failed to parse SSE notification event:', err);
    }
  });

  eventSource.addEventListener('unread_count_update', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.unreadCount !== undefined) {
        queryClient.setQueryData(['notifications', 'unread-count'], data.unreadCount);
      }
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (err) {
      console.error('Failed to parse SSE unread_count_update event:', err);
    }
  });

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.status === 'connected') return;

      if (data.message) {
        onNotification(data.message);
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    } catch (err) {
      console.error('Failed to parse SSE generic message:', err);
    }
  };

  eventSource.onerror = (err) => {
    console.warn('SSE notification stream encountered connection error, retrying...', err);
  };

  return () => {
    eventSource.close();
  };
}
