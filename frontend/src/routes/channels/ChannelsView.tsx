import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import apiClient from '../../lib/api-client.js';
import { Plus, Trash2, Edit2, Copy, X, Calendar, Settings, RefreshCw, Layers } from 'lucide-react';

const cronRegex = /^(\*|([0-5]?\d)(-[0-5]?\d)?(\/[0-5]?\d)?)( +(\*|([0-9]|1\d|2[0-3])(-([0-9]|1\d|2[0-3]))?(\/([0-9]|1\d|2[0-3]))?)){4}$/;

const channelSchema = z.object({
  name: z.string().min(1, 'Channel name is required').max(100),
  contentProfileId: z.string().uuid('Please select a Content Profile'),
  automationMode: z.enum(['Manual', 'Automatic', 'Hybrid']),
  status: z.enum(['Active', 'Disabled']),
  scheduleCron: z.string().regex(cronRegex, 'Must be a valid 5-field cron expression (e.g. "0 9 * * *")'),
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
  contentProfile: ContentProfile;
  automationMode: 'Manual' | 'Automatic' | 'Hybrid';
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Queries
  const { data: channels = [], isLoading: isChannelsLoading } = useQuery<Channel[]>({
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
      setDeletingChannelId(null);
      if (selectedChannel?.id === deletingChannelId) {
        setSelectedChannel(null);
      }
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to delete channel');
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/channels/${id}/duplicate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error?.message || 'Failed to duplicate channel');
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Channels</h2>
          <p className="text-sm text-[#9c9cb0]">Manage video configurations, linked platforms, and cron schedules</p>
        </div>
        <button
          onClick={openCreateDialog}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 cursor-pointer"
        >
          <Plus size={16} />
          Create Channel
        </button>
      </div>

      {/* Grid of channels */}
      {isChannelsLoading ? (
        <div className="flex h-64 items-center justify-center">
          <RefreshCw className="animate-spin text-purple-500" size={32} />
        </div>
      ) : channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#1a1a24] bg-[#0e0e12] py-16 text-center">
          <Layers size={48} className="text-[#6e6e80] mb-4" />
          <h3 className="text-lg font-bold text-white">No publishing channels configured</h3>
          <p className="text-sm text-[#9c9cb0] max-w-sm mt-1">
            Channels specify your publication targets, linking content templates to platform connections.
          </p>
          <button
            onClick={openCreateDialog}
            className="mt-6 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 cursor-pointer"
          >
            Create Channel
          </button>
        </div>
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
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    channel.status === 'Active'
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
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                      pc.status === 'Disabled' || pc.healthStatus !== 'Healthy'
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
                    title="Duplicate Channel"
                    className="text-[#6e6e80] hover:text-purple-400 cursor-pointer"
                  >
                    <Copy size={14} />
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

      {/* Slideover / Detail Modal */}
      {selectedChannel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedChannel(null)} />
          <div className="relative z-10 w-full max-w-md border-l border-[#1a1a24] bg-[#0e0e12] p-8 shadow-2xl overflow-y-auto">
            <button
              onClick={() => setSelectedChannel(null)}
              className="absolute right-4 top-4 text-[#6e6e80] hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-bold text-white mb-6">Channel Details</h3>

            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Name</h4>
                <p className="mt-1 text-lg font-bold text-white">{selectedChannel.name}</p>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Status</h4>
                <span
                  className={`inline-block mt-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    selectedChannel.status === 'Active'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {selectedChannel.status}
                </span>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Linked Content Profile</h4>
                <p className="mt-1 text-sm font-medium text-white">
                  {selectedChannel.contentProfile?.name || 'None'}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Automation Settings</h4>
                <div className="mt-2 rounded-lg border border-[#1a1a24] bg-[#161620]/50 p-4 space-y-2 text-xs">
                  <p className="text-[#9c9cb0]">
                    Automation Mode:{' '}
                    <span className="font-semibold text-white">{selectedChannel.automationMode}</span>
                  </p>
                  <p className="text-[#9c9cb0]">
                    Cron Frequency:{' '}
                    <span className="font-semibold text-white font-mono">{selectedChannel.scheduleCron}</span>
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Publishing Configurations</h4>
                <div className="mt-2 rounded-lg border border-[#1a1a24] bg-[#161620]/50 p-4 space-y-2 text-xs">
                  <p className="text-[#9c9cb0]">
                    Max Video Duration:{' '}
                    <span className="font-semibold text-white">
                      {selectedChannel.publishingConfiguration?.maxDurationSeconds ?? 60} seconds
                    </span>
                  </p>
                  <p className="text-[#9c9cb0]">
                    Auto tags enablement:{' '}
                    <span className="font-semibold text-white">
                      {selectedChannel.publishingConfiguration?.autoTagEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-2">Connected Platforms</h4>
                <div className="space-y-2">
                  {selectedChannel.platformConnections.map((pc) => (
                    <div key={pc.id} className="flex items-center justify-between rounded-lg border border-[#1a1a24] p-3 text-xs bg-[#161620]/25">
                      <span className="font-medium text-white">{pc.platform}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        pc.status === 'Active' && pc.healthStatus === 'Healthy'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {pc.status === 'Disabled' ? 'Disabled' : pc.healthStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-[#1a1a24] justify-end">
                <button
                  onClick={(e) => {
                    openEditDialog(selectedChannel, e);
                    setSelectedChannel(null);
                  }}
                  className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
                >
                  <Edit2 size={12} />
                  Edit Channel
                </button>
                <button
                  onClick={() => setDeletingChannelId(selectedChannel.id)}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 cursor-pointer"
                >
                  <Trash2 size={12} />
                  Delete Channel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsDialogOpen(false)} />
          <div className="relative z-10 w-full max-w-2xl rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-8 shadow-2xl my-8">
            <button
              onClick={() => setIsDialogOpen(false)}
              className="absolute right-4 top-4 text-[#6e6e80] hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-bold text-white mb-6">
              {editingChannel ? 'Edit Channel' : 'Create Channel'}
            </h3>

            {errorText && (
              <div className="mb-4 rounded-lg bg-red-950/40 border border-red-900/50 p-4 text-sm text-red-400">
                {errorText}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                    Channel Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shayari Shorts Channel"
                    {...register('name')}
                    className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none"
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                    Content Profile
                  </label>
                  <select
                    {...register('contentProfileId')}
                    className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none"
                  >
                    <option value="">-- Select Content Profile --</option>
                    {contentProfiles.map((profile) => (
                      <option
                        key={profile.id}
                        value={profile.id}
                        disabled={profile.status !== 'Active'}
                      >
                        {profile.name} {profile.status === 'Disabled' ? '(Disabled)' : ''}
                      </option>
                    ))}
                  </select>
                  {errors.contentProfileId && (
                    <p className="mt-1 text-xs text-red-400">{errors.contentProfileId.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                    Automation Mode
                  </label>
                  <select
                    {...register('automationMode')}
                    className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none"
                  >
                    <option value="Manual">Manual</option>
                    <option value="Automatic">Automatic</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                    Cron Frequency
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0 9 * * *"
                    {...register('scheduleCron')}
                    className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white focus:border-purple-500 outline-none font-mono"
                  />
                  {errors.scheduleCron && (
                    <p className="mt-1 text-xs text-red-400">{errors.scheduleCron.message}</p>
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

              {/* publishingConfiguration controls */}
              <div className="rounded-lg border border-[#1a1a24] p-4 bg-[#161620]/25 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#9c9cb0] flex items-center gap-1">
                  <Settings size={14} />
                  Publishing Configurations
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#6e6e80]">
                      Max Video Duration (seconds)
                    </label>
                    <input
                      type="number"
                      placeholder="60"
                      {...register('maxDurationSeconds', { valueAsNumber: true })}
                      className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2 text-sm text-white focus:border-purple-500 outline-none"
                    />
                    {errors.maxDurationSeconds && (
                      <p className="mt-1 text-xs text-red-400">{errors.maxDurationSeconds.message}</p>
                    )}
                  </div>

                  <div className="flex items-center h-full pt-6">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#9c9cb0] cursor-pointer">
                      <input
                        type="checkbox"
                        {...register('autoTagEnabled')}
                        className="rounded border-[#1a1a24] bg-[#161620] text-purple-600 focus:ring-purple-500 focus:ring-offset-[#0e0e12]"
                      />
                      Enable Auto-hashtag Strategy on publications
                    </label>
                  </div>
                </div>
              </div>

              {/* Platform connection checkbox matrix */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-2">
                  Select Platform Connections
                </label>
                {platformConnections.length === 0 ? (
                  <p className="text-xs text-red-400">
                    No Platform Connections found. Please configure a Platform Connection first.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded-lg border border-[#1a1a24] p-4 bg-[#161620]/25">
                    {platformConnections.map((pc) => {
                      const isLinked = watchedConnections.includes(pc.id);
                      const isDisabled = pc.status === 'Disabled';
                      return (
                        <div
                          key={pc.id}
                          onClick={() => !isDisabled && onConnectionToggle(pc.id)}
                          className={`flex items-center justify-between rounded p-2 text-xs border cursor-pointer transition ${
                            isDisabled
                              ? 'border-[#22171a] opacity-50 cursor-not-allowed'
                              : isLinked
                              ? 'border-purple-500/50 bg-purple-500/5 text-white'
                              : 'border-[#1a1a24] hover:bg-[#161620]/50 text-[#9c9cb0]'
                          }`}
                        >
                          <div>
                            <span className="font-semibold text-white">{pc.platform}</span>
                            <span className="block text-[10px] text-[#6e6e80] mt-0.5 font-mono">
                              Health: {pc.healthStatus}
                            </span>
                          </div>
                          {isDisabled && (
                            <span className="rounded bg-red-950/40 border border-red-900/50 px-1.5 py-0.5 text-[9px] font-semibold text-red-400">
                              Disabled
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {errors.platformConnectionIds && (
                  <p className="mt-1 text-xs text-red-400">{errors.platformConnectionIds.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1a1a24]">
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
                  {editingChannel ? 'Save Changes' : 'Create Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingChannelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDeletingChannelId(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Delete Channel</h3>
            <p className="text-sm text-[#9c9cb0] mb-6">
              Are you sure you want to delete this channel? This action cannot be undone and will purge its publishing histories.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingChannelId(null)}
                className="rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2 text-sm font-semibold text-white hover:bg-[#222230] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingChannelId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChannelsView;
