import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false, // Explicit per-query focus refetch for selected views
      retry: (failureCount, error) => {
        if (failureCount >= 1) return false;
        if (error instanceof ApiError) {
          // Never retry on 4xx client errors
          if (error.status && error.status >= 400 && error.status < 500) {
            return false;
          }
          // Retry on network errors, timeouts, or 5xx server failures
          return error.isNetworkError || error.isTimeout || (error.status !== undefined && error.status >= 500);
        }
        return false;
      },
    },
    mutations: {
      retry: false, // Strict: mutations never auto-retry
    },
  },
});
