import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext.js';
import { connectSSE } from '../lib/sse-client.js';

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

interface NotificationContextType {
  unreadCount: number;
  toasts: Toast[];
  clearToasts: () => void;
  removeToast: (id: string) => void;
  addToast: (message: string, type?: Toast['type']) => void;
  resetUnreadCount: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Automatically clear toast after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const clearToasts = () => setToasts([]);
  const resetUnreadCount = () => setUnreadCount(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    const disconnect = connectSSE(queryClient, (message) => {
      setUnreadCount((c) => c + 1);
      addToast(message, 'info');
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
