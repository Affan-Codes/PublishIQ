import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  uploadAsset,
  updateAsset,
  deleteAsset,
  UpdateAssetParams,
} from '../../api/endpoints/assets';
import { useToast } from '../../providers/ToastProvider';

export function useUploadAssetMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({
      formData,
      onUploadProgress,
      signal,
    }: {
      formData: FormData;
      onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void;
      signal?: AbortSignal;
    }) => uploadAsset(formData, { onUploadProgress, signal }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset uploaded successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to upload asset');
    },
  });
}

export function useUpdateAssetMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, params }: { id: string; params: UpdateAssetParams }) =>
      updateAsset(id, params),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
      toast.success('Asset updated successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update asset');
    },
  });
}

export function useDeleteAssetMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteAsset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset deleted');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete asset');
    },
  });
}
