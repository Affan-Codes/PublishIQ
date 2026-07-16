import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import apiClient from '../../lib/api-client.js';
import { Plus, Trash2, Edit2, X, AlertTriangle, CheckCircle, Wifi, RefreshCw } from 'lucide-react';

const connectionSchema = z.object({
  platform: z.enum(['YouTube', 'Instagram', 'Facebook']),
  accessTokenHex: z.string().regex(/^[0-9a-fA-F]+$/, 'Access token must be a valid hexadecimal string'),
  refreshTokenHex: z.string().regex(/^[0-9a-fA-F]+$/, 'Refresh token must be a valid hexadecimal string'),
  expiresAt: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid expiration date'),
  scopes: z.string().min(1, 'At least one scope is required'),
  healthStatus: z.enum(['Healthy', 'Unhealthy', 'Expired', 'Unknown']),
  status: z.enum(['Active', 'Disabled']),
});

type ConnectionFormValues = z.infer<typeof connectionSchema>;

interface PlatformConnection {
  id: string;
  platform: 'YouTube' | 'Instagram' | 'Facebook';
  expiresAt: string;
  scopes: string[];
  healthStatus: 'Healthy' | 'Unhealthy' | 'Expired' | 'Unknown';
  status: 'Active' | 'Disabled';
  accessTokenHex: string;
  refreshTokenHex: string;
  createdAt: string;
}

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
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      platform: 'YouTube',
      healthStatus: 'Healthy',
      status: 'Active',
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (values: ConnectionFormValues) => {
      const payload = {
        ...values,
        expiresAt: new Date(values.expiresAt).toISOString(),
        scopes: values.scopes.split(',').map((s) => s.trim()).filter(Boolean),
      };
      await apiClient.post('/platform-connections', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-connections'] });
      setIsDialogOpen(false);
      reset();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || 'Failed to connect platform');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ConnectionFormValues) => {
      const payload = {
        ...values,
        expiresAt: new Date(values.expiresAt).toISOString(),
        scopes: values.scopes.split(',').map((s) => s.trim()).filter(Boolean),
      };
      await apiClient.put(`/platform-connections/${editingConnection!.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-connections'] });
      setEditingConnection(null);
      reset();
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

  const openCreateDialog = () => {
    setErrorText(null);
    setEditingConnection(null);
    reset({
      platform: 'YouTube',
      accessTokenHex: '',
      refreshTokenHex: '',
      expiresAt: '',
      scopes: 'youtube.upload, youtube.readonly',
      healthStatus: 'Healthy',
      status: 'Active',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (conn: PlatformConnection) => {
    setErrorText(null);
    setEditingConnection(conn);
    
    // Format date for datetime-local input
    const date = new Date(conn.expiresAt);
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISODate = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);

    reset({
      platform: conn.platform,
      accessTokenHex: conn.accessTokenHex,
      refreshTokenHex: conn.refreshTokenHex,
      expiresAt: localISODate,
      scopes: conn.scopes.join(', '),
      healthStatus: conn.healthStatus,
      status: conn.status,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (values: ConnectionFormValues) => {
    setErrorText(null);
    if (editingConnection) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
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
        <button
          onClick={openCreateDialog}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 cursor-pointer"
        >
          <Plus size={16} />
          Connect Account
        </button>
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
          <button
            onClick={openCreateDialog}
            className="mt-6 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 cursor-pointer"
          >
            Connect Account
          </button>
        </div>
      ) : (
        /* Connection Grid */
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className={`rounded-xl border p-6 space-y-4 bg-[#0e0e12] transition hover:-translate-y-0.5 hover:shadow-lg ${
                conn.status === 'Disabled'
                  ? 'border-[#22171a] bg-[#100b0c]/40'
                  : 'border-[#1a1a24] hover:border-[#2b2b3a]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">{conn.platform}</h3>
                  {conn.status === 'Disabled' && (
                    <span className="rounded bg-red-950/40 border border-red-900/50 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                      Disabled
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      conn.healthStatus === 'Healthy'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : conn.healthStatus === 'Expired'
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {conn.healthStatus === 'Healthy' ? (
                      <CheckCircle size={12} />
                    ) : (
                      <AlertTriangle size={12} />
                    )}
                    {conn.healthStatus}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <p className="text-[#9c9cb0]">
                  Token Expiry:{' '}
                  <span className="font-semibold text-white">
                    {new Date(conn.expiresAt).toLocaleDateString()}{' '}
                    {new Date(conn.expiresAt).toLocaleTimeString()}
                  </span>
                </p>
                <p className="text-[#6e6e80] font-mono break-all mt-1">
                  Access Token: {conn.accessTokenHex.slice(0, 16)}...
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#6e6e80] uppercase tracking-wider">
                  Granted Scopes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {conn.scopes.map((s) => (
                    <span
                      key={s}
                      className="rounded bg-[#161620] px-2 py-0.5 font-mono text-[10px] text-[#9c9cb0] border border-[#222230]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#1a1a24]/50 text-xs">
                <button
                  onClick={() => openEditDialog(conn)}
                  className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 cursor-pointer"
                >
                  <Edit2 size={12} />
                  Edit
                </button>
                <button
                  onClick={() => setDeletingConnectionId(conn.id)}
                  className="flex items-center gap-1.5 text-red-400 hover:text-red-300 cursor-pointer"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsDialogOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-8 shadow-2xl">
            <button
              onClick={() => setIsDialogOpen(false)}
              className="absolute right-4 top-4 text-[#6e6e80] hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-bold text-white mb-6">
              {editingConnection ? 'Edit Connection' : 'Connect Account'}
            </h3>

            {errorText && (
              <div className="mb-4 rounded-lg bg-red-950/40 border border-red-900/50 p-4 text-sm text-red-400">
                {errorText}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                  Platform
                </label>
                <select
                  {...register('platform')}
                  disabled={!!editingConnection}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none"
                >
                  <option value="YouTube">YouTube</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Facebook">Facebook Pages</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                  Access Token (Hex String Mock)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5d41402abc4b2a76b9719d911017c592"
                  {...register('accessTokenHex')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white placeholder-[#6e6e80] focus:border-purple-500 outline-none font-mono"
                />
                {errors.accessTokenHex && (
                  <p className="mt-1 text-xs text-red-400">{errors.accessTokenHex.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                  Refresh Token (Hex String Mock)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 711017c5925d41402abc4b2a76b9719d"
                  {...register('refreshTokenHex')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white placeholder-[#6e6e80] focus:border-purple-500 outline-none font-mono"
                />
                {errors.refreshTokenHex && (
                  <p className="mt-1 text-xs text-red-400">{errors.refreshTokenHex.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                    Expires At
                  </label>
                  <input
                    type="datetime-local"
                    {...register('expiresAt')}
                    className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none"
                  />
                  {errors.expiresAt && (
                    <p className="mt-1 text-xs text-red-400">{errors.expiresAt.message}</p>
                  )}
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
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                  Health Status
                </label>
                <select
                  {...register('healthStatus')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none"
                >
                  <option value="Healthy">Healthy</option>
                  <option value="Unhealthy">Unhealthy</option>
                  <option value="Expired">Expired</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                  Scopes (Comma Separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. content_publish, read_stream"
                  {...register('scopes')}
                  className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white placeholder-[#6e6e80] focus:border-purple-500 outline-none"
                />
                {errors.scopes && (
                  <p className="mt-1 text-xs text-red-400">{errors.scopes.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2 text-sm font-semibold text-white hover:bg-[#222230] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 cursor-pointer"
                >
                  {editingConnection ? 'Save Changes' : 'Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingConnectionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDeletingConnectionId(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Disconnect Platform Connection</h3>
            <p className="text-sm text-[#9c9cb0] mb-6">
              Are you sure you want to disconnect this platform integration? Any active channels relying on this credential will fail validation.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingConnectionId(null)}
                className="rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2 text-sm font-semibold text-white hover:bg-[#222230] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingConnectionId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 cursor-pointer"
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
