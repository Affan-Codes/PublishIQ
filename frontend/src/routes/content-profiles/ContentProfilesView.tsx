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
import { Plus, Edit2, Trash2, X, AlertCircle, FileText } from 'lucide-react';

const contentProfileSchema = z.object({
  name: z.string().min(1, 'Profile name is required').max(100),
  status: z.enum(['Active', 'Disabled']),
  contentTypeId: z.string().uuid('Invalid ContentType selection'),
  promptVersionId: z.string().uuid('Invalid PromptVersion selection'),
  templateVersionId: z.string().uuid('Invalid TemplateVersion selection'),
  language: z.enum(['English', 'Hindi', 'Urdu']),
  tone: z.string().min(1, 'Tone is required'),
  writingStyle: z.string().min(1, 'Writing style is required'),
  promptVariablesJson: z.string().refine((val) => {
    try { JSON.parse(val); return true; } catch { return false; }
  }, 'Must be a valid JSON object'),
  brandingRulesJson: z.string().refine((val) => {
    try { JSON.parse(val); return true; } catch { return false; }
  }, 'Must be a valid JSON object'),
  watermarkRulesJson: z.string().refine((val) => {
    try { JSON.parse(val); return true; } catch { return false; }
  }, 'Must be a valid JSON object'),
  captionStrategyJson: z.string().refine((val) => {
    try { JSON.parse(val); return true; } catch { return false; }
  }, 'Must be a valid JSON object'),
  hashtagStrategyJson: z.string().refine((val) => {
    try { JSON.parse(val); return true; } catch { return false; }
  }, 'Must be a valid JSON object'),
  musicSelectionRulesJson: z.string().refine((val) => {
    try { JSON.parse(val); return true; } catch { return false; }
  }, 'Must be a valid JSON object'),
  renderingConfigurationJson: z.string().refine((val) => {
    try { JSON.parse(val); return true; } catch { return false; }
  }, 'Must be a valid JSON object'),
  validationRulesJson: z.string().refine((val) => {
    try { JSON.parse(val); return true; } catch { return false; }
  }, 'Must be a valid JSON object'),
});

type ContentProfileFormValues = z.infer<typeof contentProfileSchema>;

interface ContentProfile {
  id: string;
  name: string;
  status: 'Active' | 'Disabled';
  language: 'English' | 'Hindi' | 'Urdu';
  tone: string;
  writingStyle: string;
  contentTypeId: string;
  promptVersionId: string;
  templateVersionId: string;
  contentType: { name: string };
  promptVersion: { versionNumber: number; prompt: { name: string } };
  templateVersion: { versionNumber: number; template: { name: string } };
  promptVariables: any;
  brandingRules: any;
  watermarkRules: any;
  captionStrategy: any;
  hashtagStrategy: any;
  musicSelectionRules: any;
  renderingConfiguration: any;
  validationRules: any;
}

export const ContentProfilesView: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useNotifications();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ContentProfile | null>(null);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Queries
  const { data: profiles = [], isLoading, isFetching, isError, error, refetch } = useQuery<ContentProfile[]>({
    queryKey: ['content-profiles'],
    queryFn: async () => {
      const res = await apiClient.get('/content-profiles');
      return res.data.data;
    },
  });

  const { data: contentTypes = [] } = useQuery({
    queryKey: ['content-types'],
    queryFn: async () => {
      const res = await apiClient.get('/content-types');
      return res.data.data;
    },
  });

  const { data: prompts = [] } = useQuery({
    queryKey: ['prompts'],
    queryFn: async () => {
      const res = await apiClient.get('/prompts');
      return res.data.data;
    },
  });

  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const { data: promptVersions = [] } = useQuery({
    queryKey: ['prompt-versions', selectedPromptId],
    queryFn: async () => {
      if (!selectedPromptId) return [];
      const res = await apiClient.get(`/prompts/${selectedPromptId}/versions`);
      return res.data.data;
    },
    enabled: !!selectedPromptId,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await apiClient.get('/templates');
      return res.data.data;
    },
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const { data: templateVersions = [] } = useQuery({
    queryKey: ['template-versions', selectedTemplateId],
    queryFn: async () => {
      if (!selectedTemplateId) return [];
      const res = await apiClient.get(`/templates/${selectedTemplateId}/versions`);
      return res.data.data;
    },
    enabled: !!selectedTemplateId,
  });

  const handleRefreshAll = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['content-types'] });
    queryClient.invalidateQueries({ queryKey: ['prompts'] });
    queryClient.invalidateQueries({ queryKey: ['templates'] });
  };

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContentProfileFormValues>({
    resolver: zodResolver(contentProfileSchema),
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingProfile(null);
    setSelectedPromptId('');
    setSelectedTemplateId('');
    setErrorText(null);
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (values: ContentProfileFormValues) => {
      const payload = {
        name: values.name,
        status: values.status,
        contentTypeId: values.contentTypeId,
        promptVersionId: values.promptVersionId,
        templateVersionId: values.templateVersionId,
        language: values.language,
        tone: values.tone,
        writingStyle: values.writingStyle,
        promptVariables: JSON.parse(values.promptVariablesJson),
        brandingRules: JSON.parse(values.brandingRulesJson),
        watermarkRules: JSON.parse(values.watermarkRulesJson),
        captionStrategy: JSON.parse(values.captionStrategyJson),
        hashtagStrategy: JSON.parse(values.hashtagStrategyJson),
        musicSelectionRules: JSON.parse(values.musicSelectionRulesJson),
        renderingConfiguration: JSON.parse(values.renderingConfigurationJson),
        validationRules: JSON.parse(values.validationRulesJson),
      };
      const res = await apiClient.post('/content-profiles', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-profiles'] });
      addToast('Content profile created successfully', 'success');
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || err.message || 'Failed to create profile');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ContentProfileFormValues) => {
      const payload = {
        name: values.name,
        status: values.status,
        contentTypeId: values.contentTypeId,
        promptVersionId: values.promptVersionId,
        templateVersionId: values.templateVersionId,
        language: values.language,
        tone: values.tone,
        writingStyle: values.writingStyle,
        promptVariables: JSON.parse(values.promptVariablesJson),
        brandingRules: JSON.parse(values.brandingRulesJson),
        watermarkRules: JSON.parse(values.watermarkRulesJson),
        captionStrategy: JSON.parse(values.captionStrategyJson),
        hashtagStrategy: JSON.parse(values.hashtagStrategyJson),
        musicSelectionRules: JSON.parse(values.musicSelectionRulesJson),
        renderingConfiguration: JSON.parse(values.renderingConfigurationJson),
        validationRules: JSON.parse(values.validationRulesJson),
      };
      const res = await apiClient.put(`/content-profiles/${editingProfile?.id}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-profiles'] });
      addToast('Content profile updated successfully', 'success');
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.response?.data?.error?.message || err.message || 'Failed to update profile');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/content-profiles/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-profiles'] });
      addToast('Content profile deleted successfully', 'success');
      setDeletingProfileId(null);
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error?.message || err.message || 'Failed to delete content profile', 'error');
    },
  });

  const onSubmit = (values: ContentProfileFormValues) => {
    setErrorText(null);
    if (editingProfile) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const openCreateDialog = () => {
    setEditingProfile(null);
    setSelectedPromptId('');
    setSelectedTemplateId('');
    setErrorText(null);
    reset({
      name: '',
      status: 'Active',
      language: 'English',
      tone: 'Inspiring',
      writingStyle: 'Poetic',
      promptVariablesJson: '{}',
      brandingRulesJson: '{}',
      watermarkRulesJson: '{}',
      captionStrategyJson: '{}',
      hashtagStrategyJson: '{}',
      musicSelectionRulesJson: '{}',
      renderingConfigurationJson: '{}',
      validationRulesJson: '{}',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = async (profile: ContentProfile) => {
    setEditingProfile(profile);
    setErrorText(null);

    const promptId = profile.promptVersion?.prompt ? (profile.promptVersion as any).promptId || '' : '';
    const templateId = profile.templateVersion?.template ? (profile.templateVersion as any).templateId || '' : '';

    setSelectedPromptId(promptId);
    setSelectedTemplateId(templateId);

    reset({
      name: profile.name,
      status: profile.status,
      contentTypeId: profile.contentTypeId,
      promptVersionId: profile.promptVersionId,
      templateVersionId: profile.templateVersionId,
      language: profile.language,
      tone: profile.tone,
      writingStyle: profile.writingStyle,
      promptVariablesJson: JSON.stringify(profile.promptVariables || {}, null, 2),
      brandingRulesJson: JSON.stringify(profile.brandingRules || {}, null, 2),
      watermarkRulesJson: JSON.stringify(profile.watermarkRules || {}, null, 2),
      captionStrategyJson: JSON.stringify(profile.captionStrategy || {}, null, 2),
      hashtagStrategyJson: JSON.stringify(profile.hashtagStrategy || {}, null, 2),
      musicSelectionRulesJson: JSON.stringify(profile.musicSelectionRules || {}, null, 2),
      renderingConfigurationJson: JSON.stringify(profile.renderingConfiguration || {}, null, 2),
      validationRulesJson: JSON.stringify(profile.validationRules || {}, null, 2),
    });
    setIsDialogOpen(true);
  };

  if (isError) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Content Profiles</h2>
            <p className="text-sm text-[#9c9cb0]">Configure rules and templates for automated quote generation</p>
          </div>
          <RefreshButton onRefresh={handleRefreshAll} isRefreshing={isFetching} />
        </div>
        <ErrorState
          title="Failed to load content profiles"
          message={(error as any)?.message || 'An error occurred while fetching content profiles.'}
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
          <h2 className="text-2xl font-bold tracking-tight text-white">Content Profiles</h2>
          <p className="text-sm text-[#9c9cb0]">Configure rules and templates for automated quote generation</p>
        </div>
        <div className="flex items-center gap-3">
          <RefreshButton onRefresh={handleRefreshAll} isRefreshing={isFetching} title="Refresh content profiles" />
          <Button icon={Plus} onClick={openCreateDialog}>
            Create Profile
          </Button>
        </div>
      </div>

      {/* Profiles Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : profiles.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No content profiles configured"
          description="Content profiles combine AI prompts, visual templates, music rules, and hashtag strategies to govern content generation."
          actionLabel="Create Profile"
          onAction={openCreateDialog}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4 flex flex-col justify-between hover:border-[#2b2b3a] transition"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      profile.status === 'Active'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {profile.status}
                  </span>
                  <span className="text-[10px] text-[#6e6e80] font-mono">
                    {profile.language} • {profile.tone}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white">{profile.name}</h3>
                  <p className="text-xs text-[#9c9cb0] mt-1">
                    Type: {profile.contentType?.name || 'Unassigned'}
                  </p>
                </div>

                <div className="bg-[#14141e] p-3 rounded-lg space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6e6e80]">Prompt:</span>
                    <span className="text-white truncate max-w-[160px]">
                      {profile.promptVersion?.prompt?.name} (v{profile.promptVersion?.versionNumber})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6e6e80]">Template:</span>
                    <span className="text-white truncate max-w-[160px]">
                      {profile.templateVersion?.template?.name} (v{profile.templateVersion?.versionNumber})
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#1a1a24]/50 pt-4">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Edit2}
                  onClick={() => openEditDialog(profile)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  onClick={() => setDeletingProfileId(profile.id)}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProfileId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Delete Content Profile</h3>
            <p className="text-sm text-[#9c9cb0]">
              Are you sure you want to delete this profile? Channels referencing this profile will require updating.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeletingProfileId(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={deleteMutation.isPending}
                loadingText="Deleting..."
                onClick={() => deleteMutation.mutate(deletingProfileId)}
              >
                Delete Profile
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog Modal */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <h3 className="text-lg font-bold text-white">
                {editingProfile ? 'Edit Content Profile' : 'Create New Content Profile'}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                    Profile Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hindi Shayari Profile"
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
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                    Content Type
                  </label>
                  <select
                    {...register('contentTypeId')}
                    className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                  >
                    <option value="">Select Content Type</option>
                    {contentTypes.map((ct: any) => (
                      <option key={ct.id} value={ct.id}>{ct.name}</option>
                    ))}
                  </select>
                  {errors.contentTypeId && <p className="mt-1 text-xs text-red-400">{errors.contentTypeId.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                    Language
                  </label>
                  <select
                    {...register('language')}
                    className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Urdu">Urdu</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                    Tone
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Inspiring"
                    {...register('tone')}
                    className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                  />
                  {errors.tone && <p className="mt-1 text-xs text-red-400">{errors.tone.message}</p>}
                </div>
              </div>

              {/* Version Selectors */}
              <div className="grid grid-cols-2 gap-4 bg-[#14141e] p-4 rounded-xl border border-[#1a1a24]">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                    Prompt Definition
                  </label>
                  <select
                    value={selectedPromptId}
                    onChange={(e) => setSelectedPromptId(e.target.value)}
                    className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white text-xs outline-none focus:border-purple-500 mb-2"
                  >
                    <option value="">Select Prompt</option>
                    {prompts.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>

                  <select
                    {...register('promptVersionId')}
                    className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white text-xs outline-none focus:border-purple-500"
                  >
                    <option value="">Select Version</option>
                    {promptVersions.map((pv: any) => (
                      <option key={pv.id} value={pv.id}>Version {pv.versionNumber} ({pv.status})</option>
                    ))}
                  </select>
                  {errors.promptVersionId && <p className="mt-1 text-xs text-red-400">{errors.promptVersionId.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                    Template Definition
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white text-xs outline-none focus:border-purple-500 mb-2"
                  >
                    <option value="">Select Template</option>
                    {templates.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>

                  <select
                    {...register('templateVersionId')}
                    className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white text-xs outline-none focus:border-purple-500"
                  >
                    <option value="">Select Version</option>
                    {templateVersions.map((tv: any) => (
                      <option key={tv.id} value={tv.id}>Version {tv.versionNumber} ({tv.status})</option>
                    ))}
                  </select>
                  {errors.templateVersionId && <p className="mt-1 text-xs text-red-400">{errors.templateVersionId.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                  Writing Style
                </label>
                <input
                  type="text"
                  placeholder="e.g. Poetic"
                  {...register('writingStyle')}
                  className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                />
                {errors.writingStyle && <p className="mt-1 text-xs text-red-400">{errors.writingStyle.message}</p>}
              </div>

              {/* JSON Strategy Configurations */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                  JSON Rule Strategies
                </h4>
                
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <label className="block text-[#9c9cb0] mb-1 font-sans">Prompt Variables JSON</label>
                    <textarea {...register('promptVariablesJson')} rows={2} className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] p-2 text-white outline-none focus:border-purple-500" />
                  </div>
                  <div>
                    <label className="block text-[#9c9cb0] mb-1 font-sans">Branding Rules JSON</label>
                    <textarea {...register('brandingRulesJson')} rows={2} className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] p-2 text-white outline-none focus:border-purple-500" />
                  </div>
                  <div>
                    <label className="block text-[#9c9cb0] mb-1 font-sans">Caption Strategy JSON</label>
                    <textarea {...register('captionStrategyJson')} rows={2} className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] p-2 text-white outline-none focus:border-purple-500" />
                  </div>
                  <div>
                    <label className="block text-[#9c9cb0] mb-1 font-sans">Hashtag Strategy JSON</label>
                    <textarea {...register('hashtagStrategyJson')} rows={2} className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] p-2 text-white outline-none focus:border-purple-500" />
                  </div>
                </div>
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
                  {editingProfile ? 'Save Changes' : 'Create Profile'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentProfilesView;
