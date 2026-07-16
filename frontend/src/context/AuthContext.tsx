import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../lib/api-client.js';

export interface Operator {
  id: string;
  email: string;
  role: 'Owner' | 'Administrator' | 'User';
  workspaceId: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  operator: Operator | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [operator, setOperator] = useState<Operator | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSession = async () => {
    try {
      const res = await apiClient.get('/auth/session');
      if (res.data?.success && res.data?.data) {
        setOperator(res.data.data);
      } else {
        setOperator(null);
      }
    } catch {
      setOperator(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiClient.post('/auth/login', { email, password });
      if (res.data?.success && res.data?.data) {
        setOperator(res.data.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setOperator(null);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!operator,
        isLoading,
        operator,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
