import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import apiClient from '../../lib/api-client.js';
import { Plus, Trash2, Edit2, X, AlertTriangle, CheckCircle, Wifi, RefreshCw } from 'lucide-react';

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
  { id: 'facebook', label: 'Facebook', bg: 'bg-blue-700 hover:bg-blue-600' },
  { id: 'instagram', label: 'Instagram', bg: 'bg-pink-700 hover:bg-pink-600' },
  { id: 'youtube', label: 'YouTube', bg: 'bg-red-700 hover:bg-red-600' },
] as const;

export const PlatformConnectionsView: React.FC = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<PlatformConnection | null>(null);
  const [deletingConnectionId, setDeletingConnectionId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Queries
  const { data: connections = [], isLoading } = useQuery<PlatformConnection[]>({
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
      setDeletingConnectionId(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to delete connection');
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
    try {
      const res = await apiClient.get(`/oauth/${platformName.toLowerCase()}/authorize`);
      if (res.data?.data?.url) {
        window.location.href = res.data.data.url;
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || `Failed to initiate ${platformName} OAuth login`);
    }
  };

  const onSubmit = (values: ConnectionFormValues) => {
    setErrorText(null);
    if (editingConnection) {
      updateMutation.mutate(values);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Platform Connections</h2>
          <p className="text-sm text-[#9c9cb0]">Manage integrations and tokens for publishing destinations</p>
        </div>
        <div className="flex items-center gap-2">
          {OAUTH_PLATFORMS.map(({ id, label, bg }) => (
            <button
              key={id}
              onClick={() => handleOAuthLogin(id)}
              className={`flex items-center gap-1.5 rounded-lg ${bg} px-3 py-2 text-xs font-semibold text-white transition cursor-pointer`}
            >
              <Plus size={14} />
              OAuth {label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <RefreshCw className="animate-spin text-purple-500" size={32} />
        </div>
      ) : connections.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#1a1a24] bg-[#0e0e12] py-16 text-center">
          <Wifi size={48} className="text-[#6e6e80] mb-4" />
          <h3 className="text-lg font-bold text-white">No platform connections connected</h3>
          <p className="text-sm text-[#9c9cb0] max-w-sm mt-1">
            PublishIQ requires at least one active connection to push generated Reels or Shorts to platforms.
          </p>
          <div className="flex items-center gap-3 mt-6">
            {OAUTH_PLATFORMS.map(({ id, label, bg }) => (
              <button
                key={id}
                onClick={() => handleOAuthLogin(id)}
                className={`flex items-center gap-1.5 rounded-lg ${bg} px-4 py-2.5 text-sm font-semibold text-white transition cursor-pointer`}
              >
                <Plus size={16} />
                Connect {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Table View */
        <div className="overflow-hidden rounded-xl border border-[#1a1a24] bg-[#0e0e12]">
          <table className="w-full text-left text-sm text-white">
            <thead className="bg-[#12121a] text-xs font-semibold uppercase tracking-wider text-[#6e6e80] border-b border-[#1a1a24]">
              <tr>
                <th className="px-6 py-4">Platform</th>
                <th className="px-6 py-4">Account / Display Name</th>
                <th className="px-6 py-4">Health Status</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Expires At</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a24]">
              {connections.map((conn) => (
                <tr key={conn.id} className="hover:bg-[#14141c] transition-colors">
                  <td className="px-6 py-4 font-medium flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${
                      conn.platform === 'YouTube' ? 'bg-red-500' :
                      conn.platform === 'Instagram' ? 'bg-pink-500' : 'bg-blue-500'
                    }`} />
                    {conn.platform}
                  </td>
                  <td className="px-6 py-4 text-[#9c9cb0]">
                    {conn.displayName || conn.externalAccountId || 'Connected Account'}
                  </td>
                  <td className="px-6 py-4">
                    {conn.healthStatus === 'Healthy' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                        <CheckCircle size={12} />
                        Healthy
                      </span>
                    ) : conn.healthStatus === 'Expired' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400 border border-amber-500/20">
                        <AlertTriangle size={12} />
                        Expired
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 border border-red-500/20">
                        <AlertTriangle size={12} />
                        {conn.healthStatus}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      conn.status === 'Active'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                    }`}>
                      {conn.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#9c9cb0] font-mono text-xs">
                    {new Date(conn.expiresAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditDialog(conn)}
                        className="rounded-lg p-2 text-[#6e6e80] hover:bg-[#1a1a24] hover:text-white transition"
                        title="Edit Connection Status"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeletingConnectionId(conn.id)}
                        className="rounded-lg p-2 text-[#6e6e80] hover:bg-red-500/10 hover:text-red-400 transition"
                        title="Delete Connection"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Connection Dialog */}
      {isDialogOpen && editingConnection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4 mb-4">
              <h3 className="text-xl font-bold text-white">
                Edit {editingConnection.platform} Connection
              </h3>
              <button
                onClick={() => setIsDialogOpen(false)}
                className="text-[#6e6e80] hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            {errorText && (
              <div className="mb-4 rounded-lg bg-red-950/40 border border-red-900/50 p-4 text-sm text-red-400">
                {errorText}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                  Account Name
                </label>
                <input
                  type="text"
                  disabled
                  value={editingConnection.displayName || editingConnection.externalAccountId || 'Connected Account'}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-[#9c9cb0] outline-none cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                  Status
                </label>
                <select
                  {...register('status')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Disabled">Disabled</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1a1a24]">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="rounded-lg bg-[#161620] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f1f2e]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingConnectionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Disconnect Platform Account</h3>
            <p className="mt-2 text-sm text-[#9c9cb0]">
              Are you sure you want to disconnect this platform connection? This will prevent automated publishing to this target.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeletingConnectionId(null)}
                className="rounded-lg bg-[#161620] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f1f2e] transition"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingConnectionId)}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformConnectionsView;
