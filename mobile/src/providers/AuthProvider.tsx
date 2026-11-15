import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { getSession, login as apiLogin, logout as apiLogout, LoginParams } from '../api/endpoints/auth';
import { registerSessionExpiredHandler, resetSessionExpiryState } from '../api/client';
import { queryClient } from '../lib/query-client';
import { onAppResume } from '../lib/app-state';
import { Operator, Role } from '../types/domain';
import { useToast } from './ToastProvider';
import { ApiError } from '../api/errors';

const CACHED_OPERATOR_KEY = 'publishiq_cached_operator_hint';

export interface AuthContextValue {
  operator: Operator | null;
  isLoading: boolean;
  isInitialNetworkError: boolean;
  signIn: (params: LoginParams) => Promise<Operator>;
  signOut: () => Promise<void>;
  retryInitialAuth: () => void;
  hasRole: (allowedRoles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toast = useToast();
  const [operator, setOperator] = useState<Operator | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialNetworkError, setIsInitialNetworkError] = useState<boolean>(false);

  // 1. Session restore on mount
  const checkInitialSession = useCallback(async () => {
    setIsLoading(true);
    setIsInitialNetworkError(false);

    // Read cached operator as optimistic hint
    try {
      const cached = await SecureStore.getItemAsync(CACHED_OPERATOR_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as Operator;
        setOperator(parsed);
      }
    } catch {
      // Ignore SecureStore read failure
    }

    try {
      const session = await getSession();
      setOperator(session);
      await SecureStore.setItemAsync(CACHED_OPERATOR_KEY, JSON.stringify(session));
    } catch (err: any) {
      if (err instanceof ApiError && err.isNetworkError) {
        setIsInitialNetworkError(true);
      } else {
        // 401 or session invalid -> clear cached hint
        setOperator(null);
        await SecureStore.deleteItemAsync(CACHED_OPERATOR_KEY).catch(() => {});
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkInitialSession();
  }, [checkInitialSession]);

  // 2. Global 401 session expiration handler
  useEffect(() => {
    registerSessionExpiredHandler(async () => {
      setOperator(null);
      await SecureStore.deleteItemAsync(CACHED_OPERATOR_KEY).catch(() => {});
      queryClient.clear();
      resetSessionExpiryState();
      toast.warning('Session expired — please sign in again.');
      router.replace('/(auth)/login');
    });
  }, [toast]);

  // 3. Re-verify session on resume if app was in background > 1 hour (§9.9)
  useEffect(() => {
    const unsubscribe = onAppResume((backgroundDurationMs) => {
      if (backgroundDurationMs > 60 * 60 * 1000) {
        getSession()
          .then((fresh) => {
            setOperator(fresh);
            SecureStore.setItemAsync(CACHED_OPERATOR_KEY, JSON.stringify(fresh)).catch(() => {});
          })
          .catch((err) => {
            if (err?.status === 401) {
              setOperator(null);
              SecureStore.deleteItemAsync(CACHED_OPERATOR_KEY).catch(() => {});
              queryClient.clear();
              toast.warning('Session expired — please sign in again.');
              router.replace('/(auth)/login');
            }
          });
      }
    });

    return unsubscribe;
  }, [toast]);

  const signIn = useCallback(
    async (params: LoginParams): Promise<Operator> => {
      const user = await apiLogin(params);
      setOperator(user);
      await SecureStore.setItemAsync(CACHED_OPERATOR_KEY, JSON.stringify(user));
      queryClient.clear();
      toast.success('Successfully signed in');
      router.replace('/(app)/(tabs)');
      return user;
    },
    [toast]
  );

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Ignore logout API failures; proceed with client wipe
    } finally {
      setOperator(null);
      await SecureStore.deleteItemAsync(CACHED_OPERATOR_KEY).catch(() => {});
      queryClient.clear();
      toast.success('Successfully signed out');
      router.replace('/(auth)/login');
    }
  }, [toast]);

  const hasRole = useCallback(
    (allowedRoles: Role[]): boolean => {
      if (!operator) return false;
      return allowedRoles.includes(operator.role);
    },
    [operator]
  );

  return (
    <AuthContext.Provider
      value={{
        operator,
        isLoading,
        isInitialNetworkError,
        signIn,
        signOut,
        retryInitialAuth: checkInitialSession,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
