import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateConnection,
  deleteConnection,
} from '../../api/endpoints/connections';
import { ConnectionStatus } from '../../types/domain';
import { useToast } from '../../providers/ToastProvider';

export function useUpdateConnectionMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({
      id,
      params,
    }: {
      id: string;
      params: { displayName?: string; status?: ConnectionStatus };
    }) => updateConnection(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-connections'] });
      toast.success('Platform connection updated');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update platform connection');
    },
  });
}

export function useDeleteConnectionMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-connections'] });
      toast.success('Platform connection disconnected');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to disconnect connection');
    },
  });
}
