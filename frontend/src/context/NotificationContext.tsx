import React, { createContext, useContext, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext.js';
import { connectSSE } from '../lib/sse-client.js';

type ToastType = 'info' | 'error' | 'success';

interface NotificationContextType {
  unreadCount: number;
  addToast: (message: string, type?: ToastType) => void;
  resetUnreadCount: () => void;
  refetchUnreadCount: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Standardized plain number React Query unread count fetcher
  const { data: unreadCount = 0, refetch: refetchUnreadCount } = useQuery<number>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/notifications/unread-count', { withCredentials: true });
      const count = res.data?.data?.unreadCount;
      return typeof count === 'number' ? count : 0;
    },
    enabled: isAuthenticated,
    staleTime: 30000,
  });

  const addToast = (message: string, type: ToastType = 'info') => {
    if (type === 'success') {
      toast.success(message);
    } else if (type === 'error') {
      toast.error(message);
    } else {
      toast.info(message);
    }
  };

  const resetUnreadCount = () => {
    queryClient.setQueryData<number>(['notifications', 'unread-count'], 0);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      queryClient.setQueryData<number>(['notifications', 'unread-count'], 0);
      return;
    }

    const disconnect = connectSSE(queryClient, (message) => {
      queryClient.setQueryData<number>(['notifications', 'unread-count'], (old = 0) => old + 1);
      toast.info(message);
    });

    return disconnect;
  }, [isAuthenticated, queryClient]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        addToast,
        resetUnreadCount,
        refetchUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationProvider;
