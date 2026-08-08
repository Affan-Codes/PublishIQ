import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '../../lib/api-client.js';
import { useNotifications } from '../../context/NotificationContext.js';
import { RefreshButton } from '../../components/ui/RefreshButton.js';
import { SkeletonCard } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Button } from '../../components/ui/Button.js';
import { ErrorState } from '../../components/ui/ErrorState.js';
import { Plus, Edit2, Trash2, X, AlertCircle, Building2 } from 'lucide-react';

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
  const { addToast } = useNotifications();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Queries
  const { data: workspaces = [], isLoading, isFetching, isError, error, refetch } = useQuery<Workspace[]>({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await apiClient.get('/workspaces');
      return res.data.data;
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceSchema),
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingWorkspace(null);
    setErrorText(null);
    reset();
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (values: WorkspaceFormValues) => {
      const res = await apiClient.post('/workspaces', values);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      addToast('Workspace created successfully', 'success');
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || err.message || 'Failed to create workspace');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: WorkspaceFormValues) => {
      const res = await apiClient.put(`/workspaces/${editingWorkspace?.id}`, values);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      addToast('Workspace updated successfully', 'success');
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || err.message || 'Failed to update workspace');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/workspaces/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      addToast('Workspace deleted successfully', 'success');
      setDeletingWorkspaceId(null);
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || err.message || 'Failed to delete workspace', 'error');
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

  if (isError) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Workspaces</h2>
            <p className="text-sm text-[#9c9cb0]">Manage team workspaces and resource isolation contexts</p>
          </div>
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} />
        </div>
        <ErrorState
          title="Failed to load workspaces"
          message={(error as any)?.message || 'An error occurred while fetching workspaces.'}
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
          <h2 className="text-2xl font-bold tracking-tight text-white">Workspaces</h2>
          <p className="text-sm text-[#9c9cb0]">Manage team workspaces and resource isolation contexts</p>
        </div>

        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} title="Refresh workspaces" />
          <Button icon={Plus} onClick={openCreateDialog}>
            Create Workspace
          </Button>
        </div>
      </div>

      {/* Grid of Workspaces */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : workspaces.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No workspaces configured"
          description="Workspaces isolate channels, content profiles, and platform connections for your team."
          actionLabel="Create Workspace"
          onAction={openCreateDialog}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4 flex flex-col justify-between hover:border-[#2b2b3a] transition"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white">{ws.name}</h3>
                  <span className="text-[10px] text-[#6e6e80] font-mono">
                    ID: {ws.id.slice(0, 8)}
                  </span>
                </div>
                <p className="text-xs text-[#9c9cb0]">
                  Created: {new Date(ws.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#1a1a24]/50 pt-4">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Edit2}
                  onClick={() => openEditDialog(ws)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  onClick={() => setDeletingWorkspaceId(ws.id)}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Modal */}
      {deletingWorkspaceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Delete Workspace</h3>
            <p className="text-sm text-[#9c9cb0]">
              Are you sure you want to delete this workspace? Resources tied to it must be unlinked first.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeletingWorkspaceId(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={deleteMutation.isPending}
                loadingText="Deleting..."
                onClick={() => deleteMutation.mutate(deletingWorkspaceId)}
              >
                Delete Workspace
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
                {editingWorkspace ? 'Edit Workspace' : 'Create Workspace'}
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
                  Workspace Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Production Operations Team"
                  {...register('name')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                />
                {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
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
                  {editingWorkspace ? 'Save Changes' : 'Create Workspace'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspacesView;
