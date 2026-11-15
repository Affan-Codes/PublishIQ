import EventSource, { CustomEvent, ErrorEvent } from 'react-native-sse';
import { QueryClient } from '@tanstack/react-query';
import { env } from './env';

export interface SSEManagerOptions {
  queryClient: QueryClient;
  onNotification?: (notification: {
    id: string;
    message: string;
    unreadCount?: number;
    jobId?: string;
    domainEvent?: any;
  }) => void;
  onWarning?: (message: string) => void;
  onSuccess?: (message: string) => void;
  onStatusChange?: (status: {
    isConnected: boolean;
    isFallbackPolling: boolean;
    consecutiveFailures: number;
    bannerMessage?: string;
  }) => void;
  onSessionExpired?: () => void;
}

export type AppSSEEvent = 'connect' | 'notification' | 'unread_count_update';

export class SSEManager {
  private queryClient: QueryClient;
  private options: SSEManagerOptions;
  private eventSource: EventSource<AppSSEEvent> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private fallbackPollingTimer: ReturnType<typeof setInterval> | null = null;
  private fallbackRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private isClosed = false;
  private isConnecting = false;
  private isConnected = false;
  private isFallbackPolling = false;
  private retryCount = 0;
  private warningToastShown = false;

  private readonly BASE_DELAY = 1000;
  private readonly MAX_DELAY = 30000;
  private readonly CONNECT_TIMEOUT = 10000; // 10s without connect signal -> fallback
  private readonly FALLBACK_POLL_INTERVAL = 30000; // 30s unread count poll
  private readonly FALLBACK_SSE_RETRY_INTERVAL = 5 * 60 * 1000; // 5m retry SSE while in fallback

  constructor(options: SSEManagerOptions) {
    this.options = options;
    this.queryClient = options.queryClient;
  }

  /**
   * Start SSE connection.
   */
  public start(): void {
    this.isClosed = false;
    this.connect();
  }

  /**
   * Stop SSE connection, cleanup all timers and instances.
   */
  public stop(): void {
    this.isClosed = true;
    this.cleanup();
  }

  private connect(): void {
    if (this.isClosed || this.isConnecting) return;

    this.cleanupEventSource();
    this.isConnecting = true;
    this.notifyStatus();

    const streamUrl = `${env.apiBaseUrl}/notifications/stream`;

    try {
      // react-native-sse supports withCredentials via native cookie jar
      const es = new EventSource<AppSSEEvent>(streamUrl, {
        withCredentials: true,
      });
      this.eventSource = es;

      // Start 10s timer waiting for 'connect' event
      this.connectTimeoutTimer = setTimeout(() => {
        if (!this.isConnected && !this.isClosed) {
          this.switchToFallbackPolling('Stream timed out before receiving connect event');
        }
      }, this.CONNECT_TIMEOUT);

      es.addEventListener('open', () => {
        // Open does not mean connected until 'connect' event arrives
      });

      // Listen for named 'connect' event from backend
      es.addEventListener('connect', () => {
        this.handleConnected();
      });

      // Listen for 'notification' event
      es.addEventListener('notification', (event: any) => {
        try {
          const raw = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (raw) {
            if (raw.message && this.options.onNotification) {
              this.options.onNotification(raw);
            }

            if (typeof raw.unreadCount === 'number') {
              this.queryClient.setQueryData<number>(['notifications', 'unread-count'], raw.unreadCount);
            }

            this.debouncedInvalidate();
          }
        } catch {
          // Ignore JSON parse error
        }
      });

      // Listen for 'unread_count_update' event
      es.addEventListener('unread_count_update', (event: any) => {
        try {
          const raw = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (raw && typeof raw.unreadCount === 'number') {
            this.queryClient.setQueryData<number>(['notifications', 'unread-count'], raw.unreadCount);
          }
        } catch {
          // Ignore JSON parse error
        }
      });

      es.addEventListener('error', (event: any) => {
        this.handleError(event);
      });
    } catch {
      this.scheduleReconnect();
    }
  }

  private handleConnected(): void {
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }

    const wasReconnecting = this.retryCount > 0 || this.isFallbackPolling;
    this.isConnecting = false;
    this.isConnected = true;
    this.retryCount = 0;
    this.stopFallbackPolling();

    if (wasReconnecting && this.options.onSuccess) {
      this.options.onSuccess('Real-time notification stream reconnected');
    }
    this.warningToastShown = false;
    this.notifyStatus();
  }

  private handleError(event: any): void {
    if (this.isClosed) return;

    this.isConnected = false;
    this.isConnecting = false;

    // Check for HTTP 401 / 403 status on the error event if provided
    const status = (event as ErrorEvent)?.xhrStatus;
    if (status === 401) {
      this.cleanup();
      if (this.options.onSessionExpired) {
        this.options.onSessionExpired();
      }
      return;
    }

    if (status === 403) {
      this.switchToFallbackPolling('Unauthorized SSE connection');
      return;
    }

    this.retryCount++;

    if (!this.warningToastShown && this.retryCount === 1) {
      this.warningToastShown = true;
      if (this.options.onWarning) {
        this.options.onWarning('Notification stream disconnected. Reconnecting...');
      }
    }

    this.notifyStatus();
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.isClosed || this.isFallbackPolling) return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Exponential backoff: base 1s, x2, cap 30s + jitter <= 500ms
    const backoff = Math.min(this.BASE_DELAY * Math.pow(2, this.retryCount - 1), this.MAX_DELAY);
    const jitter = Math.floor(Math.random() * 500);
    const delay = backoff + jitter;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private switchToFallbackPolling(reason: string): void {
    if (this.isClosed || this.isFallbackPolling) return;

    this.cleanupEventSource();
    this.isFallbackPolling = true;
    this.notifyStatus();

    // Foreground polling of unread-count every 30s
    this.fallbackPollingTimer = setInterval(async () => {
      try {
        await this.queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      } catch {
        // Ignore network polling error
      }
    }, this.FALLBACK_POLL_INTERVAL);

    // Schedule a retry of SSE connection every 5 minutes
    this.fallbackRetryTimer = setTimeout(() => {
      this.stopFallbackPolling();
      this.connect();
    }, this.FALLBACK_SSE_RETRY_INTERVAL);
  }

  private stopFallbackPolling(): void {
    this.isFallbackPolling = false;
    if (this.fallbackPollingTimer) {
      clearInterval(this.fallbackPollingTimer);
      this.fallbackPollingTimer = null;
    }
    if (this.fallbackRetryTimer) {
      clearTimeout(this.fallbackRetryTimer);
      this.fallbackRetryTimer = null;
    }
  }

  private debouncedInvalidate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.queryClient.invalidateQueries({ queryKey: ['notifications'] });
      this.queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      this.queryClient.invalidateQueries({ queryKey: ['jobs'] });
      this.debounceTimer = null;
    }, 500);
  }

  private notifyStatus(): void {
    if (this.options.onStatusChange) {
      let bannerMessage: string | undefined;
      if (this.retryCount > 3 || this.isFallbackPolling) {
        bannerMessage = 'Live updates paused — pull to refresh';
      }

      this.options.onStatusChange({
        isConnected: this.isConnected,
        isFallbackPolling: this.isFallbackPolling,
        consecutiveFailures: this.retryCount,
        bannerMessage,
      });
    }
  }

  private cleanupEventSource(): void {
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private cleanup(): void {
    this.cleanupEventSource();
    this.stopFallbackPolling();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.retryCount = 0;
    this.warningToastShown = false;
    this.notifyStatus();
  }
}
