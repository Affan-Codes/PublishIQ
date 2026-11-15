import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createContentProfile,
  updateContentProfile,
  deleteContentProfile,
  triggerDryRun,
} from '../../api/endpoints/content-profiles';
import { useToast } from '../../providers/ToastProvider';

export function useCreateContentProfileMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (params: Record<string, unknown>) => createContentProfile(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-profiles'] });
      toast.success('Content profile created successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create content profile');
    },
  });
}

export function useUpdateContentProfileMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, params }: { id: string; params: Record<string, unknown> }) =>
      updateContentProfile(id, params),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['content-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['content-profile', id] });
      queryClient.invalidateQueries({ queryKey: ['content-profile-readiness', id] });
      toast.success('Content profile updated successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update content profile');
    },
  });
}

export function useDeleteContentProfileMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteContentProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-profiles'] });
      toast.success('Content profile deleted');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete content profile');
    },
  });
}

export function useDryRunProfileMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => triggerDryRun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Dry-run job triggered');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to trigger dry-run');
    },
  });
}
