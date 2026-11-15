import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUnreadCount } from '../api/endpoints/notifications';
import { SSEManager } from '../lib/sse';
import { useIsOnline } from '../lib/network';
import { useAuth } from './AuthProvider';
import { useToast } from './ToastProvider';

export interface NotificationContextValue {
  unreadCount: number;
  bannerMessage?: string;
  isRealtimeConnected: boolean;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  isRealtimeConnected: false,
});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const { operator } = useAuth();
  const toast = useToast();
  const isOnline = useIsOnline();

  const [bannerMessage, setBannerMessage] = useState<string | undefined>(undefined);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false);
  const sseManagerRef = useRef<SSEManager | null>(null);

  // 1. Fetch unread count via TanStack Query (staleTime: 30s)
  const { data: unreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => getUnreadCount(),
    enabled: Boolean(operator),
    staleTime: 30_000,
  });

  const unreadCount = unreadData?.unreadCount ?? 0;

  // 2. Realtime SSE Manager Lifecycle
  useEffect(() => {
    if (!operator || !isOnline) {
      if (sseManagerRef.current) {
        sseManagerRef.current.stop();
        sseManagerRef.current = null;
      }
      setIsRealtimeConnected(false);
      return;
    }

    const sse = new SSEManager({
      queryClient,
      onNotification: (notif) => {
        toast.info(notif.message);
      },
      onWarning: (msg) => {
        toast.warning(msg);
      },
      onSuccess: (msg) => {
        toast.success(msg);
      },
      onStatusChange: (status) => {
        setIsRealtimeConnected(status.isConnected);
        setBannerMessage(status.bannerMessage);
      },
      onSessionExpired: () => {
        // Will be picked up by global session expiry handler
      },
    });

    sseManagerRef.current = sse;
    sse.start();

    // AppState change listener: Pause SSE on background, Resume on active
    const handleAppState = (nextStatus: AppStateStatus) => {
      if (nextStatus === 'active') {
        sse.start();
        // On resume refetch unread-count and invalidate dashboard/jobs (§9.5)
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
      } else {
        sse.stop();
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppState);

    return () => {
      appStateSubscription.remove();
      sse.stop();
      sseManagerRef.current = null;
    };
  }, [operator, isOnline, queryClient, toast]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        bannerMessage,
        isRealtimeConnected,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotifications(): NotificationContextValue {
  return useContext(NotificationContext);
}
