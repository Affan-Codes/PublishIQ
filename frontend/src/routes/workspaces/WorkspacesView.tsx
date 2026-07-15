import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '../../lib/api-client.js';
import { Plus, Edit2, Trash2, X, AlertCircle } from 'lucide-react';

const workspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(100),
});

type WorkspaceFormValues = z.infer<typeof workspaceSchema>;

interface Workspace {
  id: string;
  name: string;
  createdAt: string;
}

export const WorkspacesView: React.FC = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Queries
  const { data: workspaces = [], isLoading, isError, error } = useQuery<Workspace[]>({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await apiClient.get('/workspaces');
      return res.data.data;
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceSchema),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (values: WorkspaceFormValues) => {
      const res = await apiClient.post('/workspaces', values);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.message || 'Failed to create workspace');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: WorkspaceFormValues) => {
      const res = await apiClient.put(`/workspaces/${editingWorkspace?.id}`, values);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.message || 'Failed to update workspace');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/workspaces/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setDeletingWorkspaceId(null);
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete workspace. Some resources might still depend on it.');
      setDeletingWorkspaceId(null);
    },
  });

  const onSubmit = (values: WorkspaceFormValues) => {
    setErrorText(null);
    if (editingWorkspace) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const openCreateDialog = () => {
    setEditingWorkspace(null);
    setErrorText(null);
    reset({ name: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (workspace: Workspace) => {
    setEditingWorkspace(workspace);
    setErrorText(null);
    reset({ name: workspace.name });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingWorkspace(null);
    setErrorText(null);
    reset();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Workspaces</h2>
          <p className="text-sm text-[#9c9cb0]">Manage scoping boundaries for profiles, assets, and connections</p>
        </div>
        <button
          onClick={openCreateDialog}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
        >
          <Plus className="h-4 w-4" /> Add Workspace
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
            <h3 className="font-semibold text-white">Error loading workspaces</h3>
            <p className="text-sm mt-1">{(error as any)?.message || 'Please check your connection and try again.'}</p>
          </div>
        </div>
      )}

      {/* Data table */}
      {!isLoading && !isError && (
        <>
          {workspaces.length === 0 ? (
            <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-12 text-center text-[#6e6e80]">
              <p className="text-sm">No workspaces initialized. Click "Add Workspace" to create one.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] overflow-hidden">
              <table className="w-full text-left text-sm text-[#e0e0e6]">
                <thead className="bg-[#161620] text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                  <tr>
                    <th className="px-6 py-4">Workspace Name</th>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Created At</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a24]">
                  {workspaces.map((ws) => (
                    <tr key={ws.id} className="hover:bg-[#161620]/30 transition">
                      <td className="px-6 py-4 font-semibold text-white">{ws.name}</td>
                      <td className="px-6 py-4 text-xs font-mono text-[#9c9cb0]">{ws.id}</td>
                      <td className="px-6 py-4 text-xs text-[#9c9cb0]">{new Date(ws.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => openEditDialog(ws)}
                            className="text-purple-400 hover:text-purple-300"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeletingWorkspaceId(ws.id)}
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
                {editingWorkspace ? 'Edit Workspace' : 'Add Workspace'}
              </h3>
              <button onClick={closeDialog} className="text-[#6e6e80] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Workspace Name</label>
                <input
                  type="text"
                  placeholder="e.g. Daily Quotes Workspace"
                  {...register('name')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>
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
                  {editingWorkspace ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingWorkspaceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-red-500/20 bg-[#0e0e12] p-6 shadow-2xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">Delete Workspace?</h3>
              <p className="text-sm text-[#9c9cb0] mt-2">
                This action cannot be undone. All channels, profiles, and media generated within this workspace will be inaccessible.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingWorkspaceId(null)}
                className="rounded-lg border border-[#1a1a24] px-4 py-2 text-sm font-semibold text-[#9c9cb0] hover:bg-[#161620] transition"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingWorkspaceId)}
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

export default WorkspacesView;
