import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

let activeEventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let invalidateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
const MAX_RETRIES = 5;
const BASE_DELAY = 1000;
const MAX_DELAY = 30000;
let isReconnectingToastShown = false;

/**
 * Debounced cache invalidation to prevent thundering herd API requests on SSE bursts.
 */
function debouncedInvalidate(queryClient: QueryClient, queryKeys: string[][]): void {
  if (invalidateDebounceTimer) {
    clearTimeout(invalidateDebounceTimer);
  }
  invalidateDebounceTimer = setTimeout(() => {
    queryKeys.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: key });
    });
    invalidateDebounceTimer = null;
  }, 500);
}

/**
 * Initializes EventSource connection to notification stream with backoff reconnect & debounced invalidations.
 * Prevents memory/connection leaks across authentication state changes.
 */
export function connectSSE(
  queryClient: QueryClient,
  onNotification: (message: string) => void
): () => void {
  let isIntentionallyClosed = false;

  const cleanup = () => {
    isIntentionallyClosed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (invalidateDebounceTimer) {
      clearTimeout(invalidateDebounceTimer);
      invalidateDebounceTimer = null;
    }
    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }
    retryCount = 0;
    isReconnectingToastShown = false;
  };

  const createConnection = () => {
    if (isIntentionallyClosed) return;

    // Fully close any existing stale EventSource instance
    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }

    const eventSourceUrl = `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/notifications/stream`;
    const eventSource = new EventSource(eventSourceUrl, { withCredentials: true });
    activeEventSource = eventSource;

    eventSource.onopen = () => {
      if (retryCount > 0) {
        toast.success('Real-time notification stream reconnected');
      }
      retryCount = 0;
      isReconnectingToastShown = false;
    };

    eventSource.addEventListener('notification', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.message) {
          onNotification(data.message);
        }

        if (typeof data.unreadCount === 'number') {
          queryClient.setQueryData<number>(['notifications', 'unread-count'], data.unreadCount);
        }

        debouncedInvalidate(queryClient, [
          ['notifications'],
          ['dashboard-stats'],
          ['jobs'],
        ]);
      } catch (err) {
        console.error('Failed to parse SSE notification event:', err);
      }
    });

    eventSource.addEventListener('unread_count_update', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof data.unreadCount === 'number') {
          queryClient.setQueryData<number>(['notifications', 'unread-count'], data.unreadCount);
        }
        debouncedInvalidate(queryClient, [['notifications']]);
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
          debouncedInvalidate(queryClient, [['notifications']]);
        }
      } catch (err) {
        console.error('Failed to parse SSE generic message:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      if (activeEventSource === eventSource) {
        activeEventSource = null;
      }

      if (isIntentionallyClosed) return;

      if (retryCount < MAX_RETRIES) {
        retryCount++;
        const jitter = Math.random() * 500;
        const delay = Math.min(BASE_DELAY * Math.pow(2, retryCount - 1) + jitter, MAX_DELAY);

        if (!isReconnectingToastShown) {
          toast.warning('Notification stream disconnected. Reconnecting...');
          isReconnectingToastShown = true;
        }

        reconnectTimer = setTimeout(() => {
          createConnection();
        }, delay);
      } else {
        toast.error('Notification stream connection failed after multiple attempts');
      }
    };
  };

  createConnection();

  return cleanup;
}
