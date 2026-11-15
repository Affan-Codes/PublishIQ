import * as Network from 'expo-network';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/**
 * Initializes expo-network listener and connects it to TanStack Query's onlineManager.
 */
export function initNetworkManager(): () => void {
  // Check initial state
  Network.getNetworkStateAsync().then((state) => {
    const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
    onlineManager.setOnline(isOnline);
  });

  const subscription = Network.addNetworkStateListener((state) => {
    const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
    onlineManager.setOnline(isOnline);
  });

  return () => {
    subscription.remove();
  };
}

/**
 * Hook to read current network online status.
 */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    Network.getNetworkStateAsync().then((state) => {
      if (mounted) {
        setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
      }
    });

    const subscription = Network.addNetworkStateListener((state) => {
      if (mounted) {
        setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return isOnline;
}
