import * as WebBrowser from 'expo-web-browser';
import { AppState, AppStateStatus } from 'react-native';
import { QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { getOAuthAuthorizeUrl, getConnections } from '../api/endpoints/connections';
import { Platform, Role } from '../types/domain';

export interface OAuthConnectionProvider {
  platform: Platform;
  displayName: string;
  isSupported: boolean;
}

/**
 * Registry of social publishing connection providers.
 * Facebook and Instagram can be added in future by updating this registry.
 */
export const CONNECTION_PROVIDERS: Record<Platform, OAuthConnectionProvider> = {
  YouTube: {
    platform: 'YouTube',
    displayName: 'YouTube',
    isSupported: true,
  },
  Instagram: {
    platform: 'Instagram',
    displayName: 'Instagram',
    isSupported: false,
  },
  Facebook: {
    platform: 'Facebook',
    displayName: 'Facebook',
    isSupported: false,
  },
};

const authorizeUrlSchema = z.object({
  url: z.string().url(),
});

export interface ConnectOAuthOptions {
  queryClient: QueryClient;
  userRole?: Role;
  onToast: (type: 'success' | 'info' | 'error', message: string) => void;
  onHelp?: (message: string) => void;
}

/**
 * Initiates the YouTube OAuth 2.0 authorization code flow via system browser.
 * Follows approved Section 9.4 protocol.
 */
export async function connectYouTube(options: ConnectOAuthOptions): Promise<void> {
  const { queryClient, userRole, onToast, onHelp } = options;

  // 1. Role verification
  if (userRole !== 'Owner' && userRole !== 'Administrator') {
    onToast('error', 'Only Workspace Owners and Administrators can connect platforms');
    return;
  }

  try {
    // Capture pre-flight connections for comparison
    const preFlightConnections = await getConnections();
    const preFlightIds = new Set(preFlightConnections.map((c) => c.id));

    // 2. Fetch authorization URL
    const rawData = await getOAuthAuthorizeUrl('YouTube');
    const parsed = authorizeUrlSchema.safeParse(rawData);
    if (!parsed.success) {
      onToast('error', 'Received invalid OAuth authorization response from server');
      return;
    }

    const { url } = parsed.data;

    // Strict security guard: only allow Google Accounts authorization host
    if (!url.startsWith('https://accounts.google.com/')) {
      onToast('error', 'Untrusted OAuth redirection URL rejected for security');
      return;
    }

    // Set up AppState listener while auth session is active
    let appStateSubscription: { remove: () => void } | null = null;
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        queryClient.invalidateQueries({ queryKey: ['platform-connections'] });
      }
    };
    appStateSubscription = AppState.addEventListener('change', handleAppState);

    // 3. Open system browser auth session
    try {
      await WebBrowser.openAuthSessionAsync(url, 'publishiq://oauth/youtube');
    } finally {
      appStateSubscription?.remove();
    }

    // 4. Invalidate and refetch connections
    await queryClient.invalidateQueries({ queryKey: ['platform-connections'] });
    const postFlightConnections = await getConnections();
    const newConnection = postFlightConnections.find((c) => !preFlightIds.has(c.id));

    if (newConnection) {
      onToast('success', 'YouTube connected');
    } else {
      onToast('info', 'Connection not completed');
      if (onHelp) {
        onHelp("If you've connected before, remove PublishIQ from your Google Account permissions and try again.");
      }
    }
  } catch (err: any) {
    onToast('error', err?.message || 'Failed to start YouTube authentication');
  }
}
