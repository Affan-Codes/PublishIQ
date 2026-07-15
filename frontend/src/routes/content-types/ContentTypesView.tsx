import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '../../lib/api-client.js';
import { Plus, Edit2, Trash2, X, AlertCircle } from 'lucide-react';

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ContentType | null>(null);
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Queries
  const { data: contentTypes = [], isLoading, isError, error } = useQuery<ContentType[]>({
    queryKey: ['content-types'],
    queryFn: async () => {
      const res = await apiClient.get('/content-types');
      return res.data.data;
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContentTypeFormValues>({
    resolver: zodResolver(contentTypeSchema),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (values: ContentTypeFormValues) => {
      const res = await apiClient.post('/content-types', values);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-types'] });
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.message || 'Failed to create content type');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ContentTypeFormValues) => {
      const res = await apiClient.put(`/content-types/${editingType?.id}`, values);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-types'] });
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.message || 'Failed to update content type');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/content-types/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-types'] });
      setDeletingTypeId(null);
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete content type. Make sure no active profiles reference it.');
      setDeletingTypeId(null);
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

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingType(null);
    setErrorText(null);
    reset();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Content Types</h2>
          <p className="text-sm text-[#9c9cb0]">Define classifications for generated media behaviors (e.g. Shayari, Quote)</p>
        </div>
        <button
          onClick={openCreateDialog}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
        >
          <Plus className="h-4 w-4" /> Add Content Type
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 flex items-start gap-4 text-red-200">
          <AlertCircle className="h-6 w-6 shrink-0 text-red-400" />
          <div>
            <h3 className="font-semibold text-white">Error loading content types</h3>
            <p className="text-sm mt-1">{(error as any)?.message || 'Please check your connection and try again.'}</p>
          </div>
        </div>
      )}

      {/* Data table */}
      {!isLoading && !isError && (
        <>
          {contentTypes.length === 0 ? (
            <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-12 text-center text-[#6e6e80]">
              <p className="text-sm">No content types configured. Click "Add Content Type" to create one.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] overflow-hidden">
              <table className="w-full text-left text-sm text-[#e0e0e6]">
                <thead className="bg-[#161620] text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                  <tr>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a24]">
                  {contentTypes.map((type) => (
                    <tr key={type.id} className="hover:bg-[#161620]/30 transition">
                      <td className="px-6 py-4 font-semibold text-white">{type.name}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          type.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'
                        }`}>
                          {type.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-[#9c9cb0]">{type.id}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => openEditDialog(type)}
                            className="text-purple-400 hover:text-purple-300"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeletingTypeId(type.id)}
                            className="text-red-400 hover:text-red-300"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Create / Edit Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#222230] bg-[#0e0e12] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4 mb-6">
              <h3 className="text-lg font-bold text-white">
                {editingType ? 'Edit Content Type' : 'Add Content Type'}
              </h3>
              <button onClick={closeDialog} className="text-[#6e6e80] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Content Type Name</label>
                <input
                  type="text"
                  placeholder="e.g. Shayari"
                  {...register('name')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Status</label>
                <select
                  {...register('status')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                >
                  <option value="Active">Active</option>
                  <option value="Disabled">Disabled</option>
                </select>
                {errors.status && (
                  <p className="mt-1 text-xs text-red-400">{errors.status.message}</p>
                )}
              </div>

              {errorText && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-200">
                  {errorText}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-[#1a1a24]/50">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-lg border border-[#1a1a24] px-4 py-2 text-sm font-semibold text-[#9c9cb0] hover:bg-[#161620] hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
                >
                  {editingType ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingTypeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-red-500/20 bg-[#0e0e12] p-6 shadow-2xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">Delete Content Type?</h3>
              <p className="text-sm text-[#9c9cb0] mt-2">
                This action cannot be undone. Any content profile referencing this content type must be deleted or updated first.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingTypeId(null)}
                className="rounded-lg border border-[#1a1a24] px-4 py-2 text-sm font-semibold text-[#9c9cb0] hover:bg-[#161620] transition"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingTypeId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentTypesView;
