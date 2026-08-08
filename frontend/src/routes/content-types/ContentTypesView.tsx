import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '../../lib/api-client.js';
import { useNotifications } from '../../context/NotificationContext.js';
import { RefreshButton } from '../../components/ui/RefreshButton.js';
import { SkeletonTable } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Button } from '../../components/ui/Button.js';
import { ErrorState } from '../../components/ui/ErrorState.js';
import { Plus, Edit2, Trash2, X, AlertCircle, Layers } from 'lucide-react';

const contentTypeSchema = z.object({
  name: z.string().min(1, 'Content Type name is required').max(100),
  status: z.enum(['Active', 'Disabled']),
});

type ContentTypeFormValues = z.infer<typeof contentTypeSchema>;

interface ContentType {
  id: string;
  name: string;
  status: 'Active' | 'Disabled';
  createdAt: string;
}

export const ContentTypesView: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useNotifications();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ContentType | null>(null);
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Queries
  const { data: contentTypes = [], isLoading, isFetching, isError, error, refetch } = useQuery<ContentType[]>({
    queryKey: ['content-types'],
    queryFn: async () => {
      const res = await apiClient.get('/content-types');
      return res.data.data;
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContentTypeFormValues>({
    resolver: zodResolver(contentTypeSchema),
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingType(null);
    setErrorText(null);
    reset();
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (values: ContentTypeFormValues) => {
      const res = await apiClient.post('/content-types', values);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-types'] });
      addToast('Content type created successfully', 'success');
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || err.message || 'Failed to create content type');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ContentTypeFormValues) => {
      const res = await apiClient.put(`/content-types/${editingType?.id}`, values);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-types'] });
      addToast('Content type updated successfully', 'success');
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || err.message || 'Failed to update content type');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/content-types/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-types'] });
      addToast('Content type deleted successfully', 'success');
      setDeletingTypeId(null);
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || err.message || 'Failed to delete content type', 'error');
    },
  });

  const onSubmit = (values: ContentTypeFormValues) => {
    setErrorText(null);
    if (editingType) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const openCreateDialog = () => {
    setEditingType(null);
    setErrorText(null);
    reset({ name: '', status: 'Active' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (type: ContentType) => {
    setEditingType(type);
    setErrorText(null);
    reset({ name: type.name, status: type.status });
    setIsDialogOpen(true);
  };

  if (isError) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Content Types</h2>
            <p className="text-sm text-[#9c9cb0]">Define short-form content categories and output taxonomies</p>
          </div>
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} />
        </div>
        <ErrorState
          title="Failed to load content types"
          message={(error as any)?.message || 'An error occurred while fetching content categories.'}
          onRetry={() => refetch()}
          onRefresh={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Content Types</h2>
          <p className="text-sm text-[#9c9cb0]">Define short-form content categories and output taxonomies</p>
        </div>

        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} title="Refresh content types" />
          <Button icon={Plus} onClick={openCreateDialog}>
            Add Content Type
          </Button>
        </div>
      </div>

      {/* Content Table */}
      {isLoading ? (
        <SkeletonTable rows={5} columns={4} />
      ) : contentTypes.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No content types defined"
          description="Content types categorize your formats (e.g., Quotes, Shayari, Fact Shorts)."
          actionLabel="Add Content Type"
          onAction={openCreateDialog}
        />
      ) : (
        <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] overflow-hidden shadow-lg">
          <table className="w-full text-left text-sm text-[#e0e0e6]">
            <thead className="bg-[#161620] text-xs font-semibold uppercase tracking-wider text-[#6e6e80] border-b border-[#1a1a24]">
              <tr>
                <th className="px-6 py-4">Category Name</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a24]">
              {contentTypes.map((type) => (
                <tr key={type.id} className="hover:bg-[#161620]/30 transition">
                  <td className="px-6 py-4 font-semibold text-white">{type.name}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        type.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      {type.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-[#9c9cb0]">
                    {new Date(type.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Edit2}
                        onClick={() => openEditDialog(type)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Trash2}
                        onClick={() => setDeletingTypeId(type.id)}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Modal */}
      {deletingTypeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Delete Content Type</h3>
            <p className="text-sm text-[#9c9cb0]">
              Are you sure you want to delete this content type? Active profiles using it will be affected.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeletingTypeId(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={deleteMutation.isPending}
                loadingText="Deleting..."
                onClick={() => deleteMutation.mutate(deletingTypeId)}
              >
                Delete Category
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog Modal */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <h3 className="text-lg font-bold text-white">
                {editingType ? 'Edit Content Type' : 'Add Content Type'}
              </h3>
              <button onClick={closeDialog} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {errorText && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{errorText}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shayari & Quotes"
                  {...register('name')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                />
                {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Status
                </label>
                <select
                  {...register('status')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                >
                  <option value="Active">Active</option>
                  <option value="Disabled">Disabled</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#1a1a24] pt-4">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={closeDialog}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={createMutation.isPending || updateMutation.isPending}
                  loadingText="Saving..."
                >
                  {editingType ? 'Save Changes' : 'Add Content Type'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentTypesView;
