import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext.js';

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

    // Connect to Server-Sent Events stream
    const eventSourceUrl = `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/notifications/stream`;
    const eventSource = new EventSource(eventSourceUrl, { withCredentials: true });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === 'connected') return;

        // If it's a real notification payload
        if (data.message) {
          setUnreadCount((c) => c + 1);
          addToast(data.message, 'info');
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
  }, [isAuthenticated]);

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
