import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createContentType,
  updateContentType,
  deleteContentType,
} from '../../api/endpoints/content-types';
import { ContentTypeStatus } from '../../types/domain';
import { useToast } from '../../providers/ToastProvider';

export function useCreateContentTypeMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (params: { name: string; status: ContentTypeStatus }) =>
      createContentType(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-types'] });
      toast.success('Content type created');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create content type');
    },
  });
}

export function useUpdateContentTypeMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({
      id,
      params,
    }: {
      id: string;
      params: { name?: string; status?: ContentTypeStatus };
    }) => updateContentType(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-types'] });
      toast.success('Content type updated');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update content type');
    },
  });
}

export function useDeleteContentTypeMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteContentType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-types'] });
      toast.success('Content type deleted');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete content type');
    },
  });
}
