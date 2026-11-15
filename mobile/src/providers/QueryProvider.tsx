import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/query-client';
import { initNetworkManager } from '../lib/network';
import { initAppStateListener } from '../lib/app-state';

export const QueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const cleanupNetwork = initNetworkManager();
    const cleanupAppState = initAppStateListener();

    return () => {
      cleanupNetwork();
      cleanupAppState();
    };
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
