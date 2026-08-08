import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext.js';
import { connectSSE } from '../lib/sse-client.js';

interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

interface NotificationContextType {
  unreadCount: number;
  toasts: ToastItem[];
  clearToasts: () => void;
  removeToast: (id: string) => void;
  addToast: (message: string, type?: ToastItem['type']) => void;
  resetUnreadCount: () => void;
  refetchUnreadCount: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // React Query unread count fetcher
  const { data: unreadData, refetch: refetchUnreadCount } = useQuery<{ data: { unreadCount: number } }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/notifications/unread-count', { withCredentials: true });
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: 30000,
  });

  const unreadCount = unreadData?.data?.unreadCount || 0;

  const addToast = (message: string, type: ToastItem['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (type === 'success') {
      toast.success(message);
    } else if (type === 'error') {
      toast.error(message);
    } else {
      toast.info(message);
    }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const clearToasts = () => setToasts([]);

  const resetUnreadCount = () => {
    queryClient.setQueryData(['notifications', 'unread-count'], 0);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      queryClient.setQueryData(['notifications', 'unread-count'], 0);
      return;
    }

    const disconnect = connectSSE(queryClient, (message) => {
      queryClient.setQueryData(['notifications', 'unread-count'], (old: any) => {
        const current = typeof old === 'number' ? old : (old?.data?.unreadCount || 0);
        return current + 1;
      });
      toast.info(message);
    });

    return disconnect;
  }, [isAuthenticated, queryClient]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        toasts,
        clearToasts,
        removeToast,
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
