import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from '../../api/endpoints/workspaces';
import { useToast } from '../../providers/ToastProvider';

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (params: { name: string }) => createWorkspace(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Workspace created');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create workspace');
    },
  });
}

export function useUpdateWorkspaceMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, params }: { id: string; params: { name: string } }) =>
      updateWorkspace(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Workspace updated');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update workspace');
    },
  });
}

export function useDeleteWorkspaceMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteWorkspace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Workspace deleted');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete workspace');
    },
  });
}
