import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import apiClient from '../../lib/api-client.js';
import { useNotifications } from '../../context/NotificationContext.js';
import { RefreshButton } from '../../components/ui/RefreshButton.js';
import { SkeletonCard } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Button } from '../../components/ui/Button.js';
import { ErrorState } from '../../components/ui/ErrorState.js';
import { Trash2, Edit2, X, AlertTriangle, CheckCircle, Wifi } from 'lucide-react';

const connectionUpdateSchema = z.object({
  status: z.enum(['Active', 'Disabled']),
  healthStatus: z.enum(['Healthy', 'Unhealthy', 'Expired', 'Unknown']).optional(),
});

type ConnectionFormValues = z.infer<typeof connectionUpdateSchema>;

interface PlatformConnection {
  id: string;
  platform: 'YouTube' | 'Instagram' | 'Facebook';
  externalAccountId?: string;
  displayName?: string;
  expiresAt: string;
  scopes: string[];
  healthStatus: 'Healthy' | 'Unhealthy' | 'Expired' | 'Unknown';
  status: 'Active' | 'Disabled';
  createdAt: string;
}

const OAUTH_PLATFORMS = [
  { id: 'youtube', label: 'YouTube', variant: 'danger' as const },
  { id: 'facebook', label: 'Facebook', variant: 'primary' as const },
  { id: 'instagram', label: 'Instagram', variant: 'outline' as const },
] as const;

export const PlatformConnectionsView: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useNotifications();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<PlatformConnection | null>(null);
  const [deletingConnectionId, setDeletingConnectionId] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Queries
  const { data: connections = [], isLoading, isFetching, isError, error, refetch } = useQuery<PlatformConnection[]>({
    queryKey: ['platform-connections'],
    queryFn: async () => {
      const res = await apiClient.get('/platform-connections');
      return res.data.data;
    },
  });

  // Forms
  const { register, handleSubmit, reset } = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionUpdateSchema),
    defaultValues: {
      status: 'Active',
      healthStatus: 'Healthy',
    },
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: async (values: ConnectionFormValues) => {
      if (!editingConnection) return;
      await apiClient.put(`/platform-connections/${editingConnection.id}`, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-connections'] });
      addToast('Platform connection updated successfully', 'success');
      setIsDialogOpen(false);
      setEditingConnection(null);
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || 'Failed to update platform connection');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/platform-connections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-connections'] });
      addToast('Platform connection disconnected', 'success');
      setDeletingConnectionId(null);
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to delete connection', 'error');
    },
  });

  const openEditDialog = (conn: PlatformConnection) => {
    setErrorText(null);
    setEditingConnection(conn);
    reset({
      status: conn.status,
      healthStatus: conn.healthStatus,
    });
    setIsDialogOpen(true);
  };

  const handleOAuthLogin = async (platformName: string) => {
    setConnectingPlatform(platformName);
    try {
      const res = await apiClient.get(`/oauth/${platformName.toLowerCase()}/authorize`);
      if (res.data?.data?.url) {
        window.location.href = res.data.data.url;
      }
    } catch (err: any) {
      addToast(err.response?.data?.error?.message || `Failed to initiate ${platformName} OAuth login`, 'error');
      setConnectingPlatform(null);
    }
  };

  const onSubmit = (values: ConnectionFormValues) => {
    setErrorText(null);
    if (editingConnection) {
      updateMutation.mutate(values);
    }
  };

  if (isError) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Platform Connections</h2>
            <p className="text-sm text-[#9c9cb0]">Manage OAuth integration tokens and social publishing targets</p>
          </div>
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} />
        </div>
        <ErrorState
          title="Failed to load platform connections"
          message={(error as any)?.message || 'An error occurred while fetching platform integrations.'}
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
          <h2 className="text-2xl font-bold tracking-tight text-white">Platform Connections</h2>
          <p className="text-sm text-[#9c9cb0]">Manage OAuth integration tokens and social publishing targets</p>
        </div>

        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} title="Refresh connections" />
          
          <div className="flex items-center gap-2">
            {OAUTH_PLATFORMS.map(({ id, label, variant }) => (
              <Button
                key={id}
                size="sm"
                variant={variant}
                isLoading={connectingPlatform === id}
                loadingText="Connecting..."
                onClick={() => handleOAuthLogin(id)}
              >
                Connect {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of connections */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : connections.length === 0 ? (
        <EmptyState
          icon={Wifi}
          title="No platform connections configured"
          description="Connect a YouTube account via OAuth to publish generated videos and Shorts."
          actionLabel="Connect YouTube"
          onAction={() => handleOAuthLogin('youtube')}
          actionLoading={connectingPlatform === 'youtube'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((conn) => {
            const isExpired = new Date(conn.expiresAt) <= new Date();
            const isHealthy = conn.healthStatus === 'Healthy' && !isExpired;

            return (
              <div
                key={conn.id}
                className="relative rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4 hover:border-[#2b2b3a] transition"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1.5 ${
                      isHealthy
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                  >
                    {isHealthy ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                    {isExpired ? 'Token Expired' : conn.healthStatus}
                  </span>
                  
                  <span className="text-[10px] text-[#6e6e80] font-mono">
                    Status: {conn.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {conn.platform}
                  </h3>
                  <p className="text-xs text-[#9c9cb0] mt-1 font-mono">
                    ID: {conn.externalAccountId || 'Default Account'}
                  </p>
                </div>

                <div className="bg-[#14141e] p-3 rounded-lg space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6e6e80]">Expires:</span>
                    <span className="text-white font-mono">
                      {new Date(conn.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[#1a1a24]/50 pt-4 text-xs">
                  <span className="text-[10px] text-[#6e6e80]">
                    Connected {new Date(conn.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Edit2}
                      onClick={() => openEditDialog(conn)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      onClick={() => setDeletingConnectionId(conn.id)}
                      className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Modal */}
      {deletingConnectionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Disconnect Platform</h3>
            <p className="text-sm text-[#9c9cb0]">
              Are you sure you want to disconnect this platform integration? Automated publishing target channels will fail.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeletingConnectionId(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={deleteMutation.isPending}
                loadingText="Disconnecting..."
                onClick={() => deleteMutation.mutate(deletingConnectionId)}
              >
                Disconnect Platform
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog Modal */}
      {isDialogOpen && editingConnection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <h3 className="text-lg font-bold text-white">Edit Platform Connection</h3>
              <button onClick={() => setIsDialogOpen(false)} className="text-[#6e6e80] hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {errorText && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
                {errorText}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-sm">
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

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Health Status Override
                </label>
                <select
                  {...register('healthStatus')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                >
                  <option value="Healthy">Healthy</option>
                  <option value="Unhealthy">Unhealthy</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#1a1a24] pt-4">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={updateMutation.isPending}
                  loadingText="Saving..."
                >
                  Save Connection
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformConnectionsView;
