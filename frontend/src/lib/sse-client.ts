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

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.status === 'connected') return;

      if (data.message) {
        onNotification(data.message);

        // Invalidate specific cache tags to reload fresh state in real-time
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
      }
    } catch (err) {
      console.error('Failed to parse SSE notification message:', err);
    }
  };

  eventSource.onerror = (err) => {
    console.warn('SSE notification stream encountered connection error, retrying...', err);
  };

  return () => {
    eventSource.close();
  };
}
