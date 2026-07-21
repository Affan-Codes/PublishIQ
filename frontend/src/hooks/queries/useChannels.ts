import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api-client.js';
import { useCallback } from 'react';

export interface Channel {
  id: string;
  name: string;
  workspaceId: string;
  contentProfileId: string;
  automationMode: 'Manual' | 'Hybrid' | 'FullyAutomated';
  status: 'Active' | 'Disabled';
  scheduleCron: string;
  publishingConfiguration: any;
  platformConnections: any[];
  contentProfile?: {
    id: string;
    name: string;
  };
}

export function useChannels() {
  const queryFn = useCallback(async () => {
    const res = await apiClient.get('/channels');
    return res.data.data as Channel[];
  }, []);

  return useQuery<Channel[]>({
    queryKey: ['channels'],
    queryFn,
  });
}
