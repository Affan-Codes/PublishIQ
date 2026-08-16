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
import { Plus, Trash2, Edit2, Copy, X, Calendar, Layers } from 'lucide-react';

// Regex for standard 5-field cron validation (supports wildcard steps like */2, ranges, lists)
const cronRegex = /^((?:\*|[0-5]?\d)(?:-[0-5]?\d)?(?:\/[0-5]?\d)?(?:,(?:\*|[0-5]?\d)(?:-[0-5]?\d)?(?:\/[0-5]?\d)?)*)\s+((?:\*|(?:[0-9]|1\d|2[0-3]))(?:-(?:[0-9]|1\d|2[0-3]))?(?:\/(?:[0-9]|1\d|2[0-3]))?(?:,(?:\*|(?:[0-9]|1\d|2[0-3]))(?:-(?:[0-9]|1\d|2[0-3]))?(?:\/(?:[0-9]|1\d|2[0-3]))?)*)\s+((?:\*|(?:[1-9]|[12]\d|3[01]))(?:-(?:[1-9]|[12]\d|3[01]))?(?:\/(?:[1-9]|[12]\d|3[01]))?(?:,(?:\*|(?:[1-9]|[12]\d|3[01]))(?:-(?:[1-9]|[12]\d|3[01]))?(?:\/(?:[1-9]|[12]\d|3[01]))?)*)\s+((?:\*|(?:[1-9]|1[02]))(?:-(?:[1-9]|1[02]))?(?:\/(?:[1-9]|1[02]))?(?:,(?:\*|(?:[1-9]|1[02]))(?:-(?:[1-9]|1[02]))?(?:\/(?:[1-9]|1[02]))?)*)\s+((?:\*|[0-7])(?:-[0-7])?(?:\/[0-7])?(?:,(?:\*|[0-7])(?:-[0-7])?(?:\/[0-7])?)*)$/;

const channelSchema = z.object({
  name: z.string().min(1, 'Channel name is required').max(100),
  contentProfileId: z.string().uuid('Please select a Content Profile'),
  automationMode: z.enum(['Manual', 'Automatic', 'Hybrid', 'FullyAutomated']),
  status: z.enum(['Active', 'Disabled']),
  scheduleCron: z.string().regex(cronRegex, 'Must be a valid 5-field cron expression (e.g. "*/2 * * * *" or "0 9 * * *")'),
  maxDurationSeconds: z.number().min(5, 'Duration must be at least 5 seconds').max(3600, 'Duration cannot exceed 1 hour'),
  autoTagEnabled: z.boolean(),
  platformConnectionIds: z.array(z.string().uuid()).min(1, 'Select at least one platform connection'),
});

type ChannelFormValues = z.infer<typeof channelSchema>;

interface ContentProfile {
  id: string;
  name: string;
  status: 'Active' | 'Disabled';
}

interface PlatformConnection {
  id: string;
  platform: 'YouTube' | 'Instagram' | 'Facebook';
  status: 'Active' | 'Disabled';
  healthStatus: 'Healthy' | 'Unhealthy' | 'Expired' | 'Unknown';
}

interface Channel {
  id: string;
  name: string;
  contentProfileId: string;
  contentProfile?: ContentProfile | { id: string; name: string; status?: string };
  automationMode: 'Manual' | 'Automatic' | 'Hybrid' | 'FullyAutomated';
  status: 'Active' | 'Disabled';
  scheduleCron: string;
  publishingConfiguration: {
    maxDurationSeconds?: number;
    autoTagEnabled?: boolean;
  };
  platformConnections: PlatformConnection[];
}

export const ChannelsView: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useNotifications();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Queries
  const { data: channels = [], isLoading: isChannelsLoading, isFetching, isError, error, refetch } = useQuery<Channel[]>({
    queryKey: ['channels'],
    queryFn: async () => {
      const res = await apiClient.get('/channels');
      return res.data.data;
    },
  });

  const { data: contentProfiles = [] } = useQuery<ContentProfile[]>({
    queryKey: ['content-profiles'],
    queryFn: async () => {
      const res = await apiClient.get('/content-profiles');
      return res.data.data;
    },
  });

  const { data: platformConnections = [] } = useQuery<PlatformConnection[]>({
    queryKey: ['platform-connections'],
    queryFn: async () => {
      const res = await apiClient.get('/platform-connections');
      return res.data.data;
    },
  });

  // Forms
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ChannelFormValues>({
    resolver: zodResolver(channelSchema),
    defaultValues: {
      automationMode: 'Hybrid',
      status: 'Active',
      scheduleCron: '0 9 * * *',
      maxDurationSeconds: 60,
      autoTagEnabled: true,
      platformConnectionIds: [],
    },
  });

  const watchedConnections = watch('platformConnectionIds') || [];

  // Manual refresh all queries
  const handleRefreshAll = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['content-profiles'] });
    queryClient.invalidateQueries({ queryKey: ['platform-connections'] });
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (values: ChannelFormValues) => {
      const payload = {
        name: values.name,
        contentProfileId: values.contentProfileId,
        automationMode: values.automationMode,
        status: values.status,
        scheduleCron: values.scheduleCron,
        publishingConfiguration: {
          maxDurationSeconds: values.maxDurationSeconds,
          autoTagEnabled: values.autoTagEnabled,
        },
        platformConnectionIds: values.platformConnectionIds,
      };
      await apiClient.post('/channels', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      addToast('Channel created successfully', 'success');
      setIsDialogOpen(false);
      reset();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || 'Failed to create channel');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ChannelFormValues) => {
      const payload = {
        name: values.name,
        contentProfileId: values.contentProfileId,
        automationMode: values.automationMode,
        status: values.status,
        scheduleCron: values.scheduleCron,
        publishingConfiguration: {
          maxDurationSeconds: values.maxDurationSeconds,
          autoTagEnabled: values.autoTagEnabled,
        },
        platformConnectionIds: values.platformConnectionIds,
      };
      await apiClient.put(`/channels/${editingChannel!.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      addToast('Channel updated successfully', 'success');
      setIsDialogOpen(false);
      setEditingChannel(null);
      reset();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || 'Failed to update channel');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/channels/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      addToast('Channel deleted successfully', 'success');
      setDeletingChannelId(null);
      if (selectedChannel?.id === deletingChannelId) {
        setSelectedChannel(null);
      }
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to delete channel', 'error');
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      setDuplicatingId(id);
      await apiClient.post(`/channels/${id}/duplicate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      addToast('Channel duplicated successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || 'Failed to duplicate channel', 'error');
    },
    onSettled: () => {
      setDuplicatingId(null);
    },
  });

  const openCreateDialog = () => {
    setErrorText(null);
    setEditingChannel(null);
    reset({
      name: '',
      contentProfileId: contentProfiles[0]?.id || '',
      automationMode: 'Hybrid',
      status: 'Active',
      scheduleCron: '0 9 * * *',
      maxDurationSeconds: 60,
      autoTagEnabled: true,
      platformConnectionIds: [],
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (channel: Channel, e: React.MouseEvent) => {
    e.stopPropagation();
    setErrorText(null);
    setEditingChannel(channel);

    reset({
      name: channel.name,
      contentProfileId: channel.contentProfileId,
      automationMode: channel.automationMode,
      status: channel.status,
      scheduleCron: channel.scheduleCron,
      maxDurationSeconds: channel.publishingConfiguration?.maxDurationSeconds ?? 60,
      autoTagEnabled: channel.publishingConfiguration?.autoTagEnabled ?? true,
      platformConnectionIds: channel.platformConnections.map((pc) => pc.id),
    });
    setIsDialogOpen(true);
  };

  const onConnectionToggle = (id: string) => {
    const current = [...watchedConnections];
    const idx = current.indexOf(id);
    if (idx > -1) {
      current.splice(idx, 1);
    } else {
      current.push(id);
    }
    setValue('platformConnectionIds', current, { shouldValidate: true });
  };

  const onSubmit = (values: ChannelFormValues) => {
    setErrorText(null);
    if (editingChannel) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  if (isError) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Channels</h2>
            <p className="text-sm text-[#9c9cb0]">Manage video configurations, linked platforms, and cron schedules</p>
          </div>
          <RefreshButton onRefresh={handleRefreshAll} isRefreshing={isFetching} />
        </div>
        <ErrorState
          title="Failed to load publishing channels"
          message={(error as any)?.message || 'An error occurred while fetching channels.'}
          onRetry={handleRefreshAll}
          onRefresh={handleRefreshAll}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Channels</h2>
          <p className="text-sm text-[#9c9cb0]">Manage video configurations, linked platforms, and cron schedules</p>
        </div>
        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={handleRefreshAll} isRefreshing={isFetching} title="Refresh channels" />
          <Button icon={Plus} onClick={openCreateDialog}>
            Create Channel
          </Button>
        </div>
      </div>

      {/* Grid of channels */}
      {isChannelsLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : channels.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No publishing channels configured"
          description="Channels specify your publication targets, linking content templates to platform connections and execution schedules."
          actionLabel="Create Channel"
          onAction={openCreateDialog}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel) => (
            <div
              key={channel.id}
              onClick={() => setSelectedChannel(channel)}
              className="group relative rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4 cursor-pointer hover:border-[#2b2b3a] transition"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${channel.status === 'Active'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                    }`}
                >
                  {channel.status}
                </span>
                <span className="text-[10px] text-[#6e6e80] font-mono">
                  {channel.automationMode} Mode
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition">
                  {channel.name}
                </h3>
                <p className="text-xs text-[#9c9cb0] mt-1 line-clamp-1">
                  Profile: {channel.contentProfile?.name || 'Unassigned'}
                </p>
              </div>

              {/* Connected Platforms */}
              <div className="flex gap-1.5 flex-wrap">
                {channel.platformConnections.map((pc) => (
                  <span
                    key={pc.id}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${pc.status === 'Disabled' || pc.healthStatus !== 'Healthy'
                        ? 'bg-amber-950/20 border-amber-900/50 text-amber-400'
                        : 'bg-purple-950/20 border-purple-900/50 text-purple-400'
                      }`}
                  >
                    {pc.platform}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-[#1a1a24]/50 pt-4 text-xs">
                <div className="flex items-center gap-1 text-[#6e6e80]">
                  <Calendar size={12} />
                  <span>{channel.scheduleCron}</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateMutation.mutate(channel.id);
                    }}
                    disabled={duplicateMutation.isPending && duplicatingId === channel.id}
                    title="Duplicate Channel"
                    className="text-[#6e6e80] hover:text-purple-400 cursor-pointer disabled:opacity-50"
                  >
                    <Copy size={14} className={duplicateMutation.isPending && duplicatingId === channel.id ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={(e) => openEditDialog(channel, e)}
                    className="text-[#6e6e80] hover:text-purple-400 cursor-pointer"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingChannelId(channel.id);
                    }}
                    className="text-[#6e6e80] hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details View Drawer/Modal */}
      {selectedChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedChannel.name}</h3>
                <p className="text-xs text-[#9c9cb0]">Channel Configuration Inspector</p>
              </div>
              <button
                onClick={() => setSelectedChannel(null)}
                className="text-[#6e6e80] hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 bg-[#14141e] p-4 rounded-lg">
                <div>
                  <span className="text-xs text-[#6e6e80] uppercase tracking-wider font-semibold">Status</span>
                  <p className="text-white font-medium mt-1">{selectedChannel.status}</p>
                </div>
                <div>
                  <span className="text-xs text-[#6e6e80] uppercase tracking-wider font-semibold">Mode</span>
                  <p className="text-white font-medium mt-1">{selectedChannel.automationMode}</p>
                </div>
                <div>
                  <span className="text-xs text-[#6e6e80] uppercase tracking-wider font-semibold">Content Profile</span>
                  <p className="text-white font-medium mt-1">{selectedChannel.contentProfile?.name || 'None'}</p>
                </div>
                <div>
                  <span className="text-xs text-[#6e6e80] uppercase tracking-wider font-semibold">Cron Schedule</span>
                  <p className="text-white font-medium mt-1 font-mono">{selectedChannel.scheduleCron}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-2">
                  Publishing Settings
                </h4>
                <div className="bg-[#14141e] p-4 rounded-lg space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#9c9cb0]">Max Video Duration:</span>
                    <span className="text-white font-mono">
                      {selectedChannel.publishingConfiguration?.maxDurationSeconds ?? 60} seconds
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9c9cb0]">Auto Hashtags:</span>
                    <span className="text-white font-mono">
                      {selectedChannel.publishingConfiguration?.autoTagEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-2">
                  Connected Platforms
                </h4>
                <div className="space-y-2">
                  {selectedChannel.platformConnections.length === 0 ? (
                    <p className="text-xs text-[#6e6e80] italic">No platforms linked</p>
                  ) : (
                    selectedChannel.platformConnections.map((pc) => (
                      <div
                        key={pc.id}
                        className="flex items-center justify-between bg-[#14141e] px-3 py-2 rounded-lg text-xs"
                      >
                        <span className="font-semibold text-white">{pc.platform}</span>
                        <div className="flex gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${pc.healthStatus === 'Healthy'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                              }`}
                          >
                            {pc.healthStatus}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${pc.status === 'Active'
                                ? 'bg-purple-500/10 text-purple-400'
                                : 'bg-gray-500/10 text-gray-400'
                              }`}
                          >
                            {pc.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#1a1a24] pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedChannel(null)}
              >
                Close
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={Edit2}
                onClick={(e) => {
                  setSelectedChannel(null);
                  openEditDialog(selectedChannel, e);
                }}
              >
                Edit Configuration
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingChannelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Delete Channel</h3>
            <p className="text-sm text-[#9c9cb0]">
              Are you sure you want to delete this channel? Active automated schedules will be permanently stopped.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeletingChannelId(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={deleteMutation.isPending}
                loadingText="Deleting..."
                onClick={() => deleteMutation.mutate(deletingChannelId)}
              >
                Delete Channel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog Modal */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm p-4 sm:p-6 flex justify-center items-start sm:items-center py-10 sm:py-12">
          <div className="w-full max-w-xl rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <h3 className="text-lg font-bold text-white">
                {editingChannel ? 'Edit Channel Configuration' : 'Create New Channel'}
              </h3>
              <button
                onClick={() => setIsDialogOpen(false)}
                className="text-[#6e6e80] hover:text-white cursor-pointer"
              >
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
                  Channel Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Daily Shayari Shorts"
                  {...register('name')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white placeholder-[#6e6e80] outline-none focus:border-purple-500"
                />
                {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                    Content Profile
                  </label>
                  <select
                    {...register('contentProfileId')}
                    className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                  >
                    <option value="">Select a Content Profile</option>
                    {contentProfiles.map((cp) => (
                      <option key={cp.id} value={cp.id}>
                        {cp.name}
                      </option>
                    ))}
                  </select>
                  {errors.contentProfileId && (
                    <p className="mt-1 text-xs text-red-400">{errors.contentProfileId.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                    Automation Mode
                  </label>
                  <select
                    {...register('automationMode')}
                    className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                  >
                    <option value="Hybrid">Hybrid (Requires Approval)</option>
                    <option value="Automatic">Automatic (Instant Pipeline)</option>
                    <option value="Manual">Manual</option>
                    <option value="FullyAutomated">Fully Automated</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                    Schedule Cron Expression
                  </label>
                  <input
                    type="text"
                    placeholder="0 9 * * *"
                    {...register('scheduleCron')}
                    className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white font-mono outline-none focus:border-purple-500"
                  />
                  {errors.scheduleCron && (
                    <p className="mt-1 text-xs text-red-400">{errors.scheduleCron.message}</p>
                  )}
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
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-2">
                  Target Platform Connections
                </label>
                {platformConnections.length === 0 ? (
                  <p className="text-xs text-[#6e6e80] italic">
                    No platform connections available. Please connect a YouTube account under Platform Connections.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto bg-[#14141e] p-3 rounded-lg border border-[#1a1a24]">
                    {platformConnections.map((pc) => {
                      const checked = watchedConnections.includes(pc.id);
                      return (
                        <label
                          key={pc.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border text-xs transition ${checked
                              ? 'bg-purple-950/40 border-purple-500/50 text-white'
                              : 'bg-[#181824] border-[#222234] text-[#9c9cb0] hover:text-white'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onConnectionToggle(pc.id)}
                            className="hidden"
                          />
                          <span className="font-semibold">{pc.platform}</span>
                          <span
                            className={`ml-auto text-[10px] ${pc.healthStatus === 'Healthy' ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                          >
                            {pc.healthStatus}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {errors.platformConnectionIds && (
                  <p className="mt-1 text-xs text-red-400">{errors.platformConnectionIds.message}</p>
                )}
              </div>

              <div className="border-t border-[#1a1a24] pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-3">
                  Publishing Settings
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#9c9cb0] mb-1">Max Duration (Seconds)</label>
                    <input
                      type="number"
                      {...register('maxDurationSeconds', { valueAsNumber: true })}
                      className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                      <input
                        type="checkbox"
                        {...register('autoTagEnabled')}
                        className="rounded border-[#1a1a24] bg-[#161620] text-purple-600 focus:ring-purple-500"
                      />
                      <span>Auto-Generate Tag Metadata</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#1a1a24] pt-4">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={createMutation.isPending || updateMutation.isPending}
                  loadingText="Saving..."
                >
                  {editingChannel ? 'Save Changes' : 'Create Channel'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChannelsView;
