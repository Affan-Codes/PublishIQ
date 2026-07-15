import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '../../lib/api-client.js';
import { Plus, Edit2, Trash2, X, AlertCircle } from 'lucide-react';

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ContentProfile | null>(null);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Queries
  const { data: profiles = [], isLoading, isError, error } = useQuery<ContentProfile[]>({
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

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContentProfileFormValues>({
    resolver: zodResolver(contentProfileSchema),
  });

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
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.message || 'Failed to create profile');
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
      closeDialog();
    },
    onError: (err: any) => {
      setErrorText(err.message || 'Failed to update profile');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/content-profiles/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-profiles'] });
      setDeletingProfileId(null);
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete content profile.');
      setDeletingProfileId(null);
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

    // Fetch details to find prompt and template IDs
    const res = await apiClient.get(`/content-profiles/${profile.id}`);
    const details = res.data.data;
    
    setSelectedPromptId(details.promptVersion.promptId);
    setSelectedTemplateId(details.templateVersion.templateId);

    reset({
      name: details.name,
      status: details.status,
      contentTypeId: details.contentTypeId,
      promptVersionId: details.promptVersionId,
      templateVersionId: details.templateVersionId,
      language: details.language,
      tone: details.tone,
      writingStyle: details.writingStyle,
      promptVariablesJson: JSON.stringify(details.promptVariables, null, 2),
      brandingRulesJson: JSON.stringify(details.brandingRules, null, 2),
      watermarkRulesJson: JSON.stringify(details.watermarkRules, null, 2),
      captionStrategyJson: JSON.stringify(details.captionStrategy, null, 2),
      hashtagStrategyJson: JSON.stringify(details.hashtagStrategy, null, 2),
      musicSelectionRulesJson: JSON.stringify(details.musicSelectionRules, null, 2),
      renderingConfigurationJson: JSON.stringify(details.renderingConfiguration, null, 2),
      validationRulesJson: JSON.stringify(details.validationRules, null, 2),
    });

    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingProfile(null);
    setSelectedPromptId('');
    setSelectedTemplateId('');
    setErrorText(null);
    reset();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Content Profiles</h2>
          <p className="text-sm text-[#9c9cb0]">Configure prompts, languages, and branding presets for channels</p>
        </div>
        <button
          onClick={openCreateDialog}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
        >
          <Plus className="h-4 w-4" /> Add Profile
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
            <h3 className="font-semibold text-white">Error loading profiles</h3>
            <p className="text-sm mt-1">{(error as any)?.message || 'Please check your connection and try again.'}</p>
          </div>
        </div>
      )}

      {/* Data list */}
      {!isLoading && !isError && (
        <>
          {profiles.length === 0 ? (
            <div className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-12 text-center text-[#6e6e80]">
              <p className="text-sm">No content profiles created. Click "Add Profile" to create one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {profiles.map((profile) => (
                <div key={profile.id} className="rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-4 hover:border-purple-500/30 transition">
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-[#161620] px-2.5 py-0.5 font-mono text-xs text-purple-400 border border-[#222230]">
                      Type: {profile.contentType?.name || 'N/A'}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      profile.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-500'
                    }`}>
                      {profile.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white">{profile.name}</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#9c9cb0] bg-[#161620]/30 p-3 rounded-lg border border-[#1a1a24]">
                      <p>Language: <span className="text-white font-medium">{profile.language}</span></p>
                      <p>Tone: <span className="text-white font-medium">{profile.tone}</span></p>
                      <p className="col-span-2 line-clamp-1">Prompt: <span className="text-purple-400 font-medium">{profile.promptVersion?.prompt?.name} (v{profile.promptVersion?.versionNumber})</span></p>
                      <p className="col-span-2 line-clamp-1">Template: <span className="text-purple-400 font-medium">{profile.templateVersion?.template?.name} (v{profile.templateVersion?.versionNumber})</span></p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-[#1a1a24]/50">
                    <button
                      onClick={() => openEditDialog(profile)}
                      className="text-purple-400 hover:text-purple-300"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeletingProfileId(profile.id)}
                      className="text-red-400 hover:text-red-300"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create / Edit Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
          <div className="w-full max-w-2xl rounded-xl border border-[#222230] bg-[#0e0e12] p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4 mb-6">
              <h3 className="text-lg font-bold text-white">
                {editingProfile ? 'Edit Content Profile' : 'Add Content Profile'}
              </h3>
              <button onClick={closeDialog} className="text-[#6e6e80] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Profile Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Shayari Urdu Channel Profile"
                    {...register('name')}
                    className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                  />
                  {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Content Type</label>
                  <select
                    {...register('contentTypeId')}
                    className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                  >
                    <option value="">Select Content Type...</option>
                    {contentTypes.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {errors.contentTypeId && <p className="mt-1 text-xs text-red-400">{errors.contentTypeId.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Language</label>
                  <select
                    {...register('language')}
                    className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Urdu">Urdu</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Tone</label>
                  <input
                    type="text"
                    placeholder="e.g. Inspiring"
                    {...register('tone')}
                    className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                  />
                  {errors.tone && <p className="mt-1 text-xs text-red-400">{errors.tone.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">Writing Style</label>
                  <input
                    type="text"
                    placeholder="e.g. Poetry"
                    {...register('writingStyle')}
                    className="mt-2 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                  />
                  {errors.writingStyle && <p className="mt-1 text-xs text-red-400">{errors.writingStyle.message}</p>}
                </div>
              </div>

              {/* Version Pinning Controls */}
              <div className="grid grid-cols-2 gap-4 bg-[#161620]/30 p-4 rounded-xl border border-[#1a1a24]">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Pin Prompt Version</h4>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Select Prompt</label>
                    <select
                      value={selectedPromptId}
                      onChange={(e) => {
                        setSelectedPromptId(e.target.value);
                      }}
                      className="mt-1.5 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                    >
                      <option value="">Choose Prompt...</option>
                      {prompts.map((pr: any) => (
                        <option key={pr.id} value={pr.id}>{pr.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Pin Specific Version</label>
                    <select
                      {...register('promptVersionId')}
                      className="mt-1.5 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                    >
                      <option value="">Select Version Pin...</option>
                      {promptVersions.map((v: any) => (
                        <option key={v.id} value={v.id}>Version {v.versionNumber} ({v.status})</option>
                      ))}
                    </select>
                    {errors.promptVersionId && <p className="mt-1 text-[10px] text-red-400">{errors.promptVersionId.message}</p>}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Pin Template Version</h4>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Select Template</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => {
                        setSelectedTemplateId(e.target.value);
                      }}
                      className="mt-1.5 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                    >
                      <option value="">Choose Template...</option>
                      {templates.map((tpl: any) => (
                        <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Pin Specific Version</label>
                    <select
                      {...register('templateVersionId')}
                      className="mt-1.5 w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                    >
                      <option value="">Select Version Pin...</option>
                      {templateVersions.map((v: any) => (
                        <option key={v.id} value={v.id}>Version {v.versionNumber} ({v.status})</option>
                      ))}
                    </select>
                    {errors.templateVersionId && <p className="mt-1 text-[10px] text-red-400">{errors.templateVersionId.message}</p>}
                  </div>
                </div>
              </div>

              {/* JSON Configurations Grid */}
              <div className="space-y-4 pt-4 border-t border-[#1a1a24]/50">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Configurations (JSON)</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Prompt Variables</label>
                    <textarea rows={3} {...register('promptVariablesJson')} className="mt-1.5 w-full rounded-lg border border-[#1a1a24] bg-[#161620] p-2 text-xs font-mono text-white outline-none focus:border-purple-500" />
                    {errors.promptVariablesJson && <p className="text-[10px] text-red-400">{errors.promptVariablesJson.message}</p>}
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Branding Rules</label>
                    <textarea rows={3} {...register('brandingRulesJson')} className="mt-1.5 w-full rounded-lg border border-[#1a1a24] bg-[#161620] p-2 text-xs font-mono text-white outline-none focus:border-purple-500" />
                    {errors.brandingRulesJson && <p className="text-[10px] text-red-400">{errors.brandingRulesJson.message}</p>}
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Watermark Rules</label>
                    <textarea rows={3} {...register('watermarkRulesJson')} className="mt-1.5 w-full rounded-lg border border-[#1a1a24] bg-[#161620] p-2 text-xs font-mono text-white outline-none focus:border-purple-500" />
                    {errors.watermarkRulesJson && <p className="text-[10px] text-red-400">{errors.watermarkRulesJson.message}</p>}
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Caption Strategy</label>
                    <textarea rows={3} {...register('captionStrategyJson')} className="mt-1.5 w-full rounded-lg border border-[#1a1a24] bg-[#161620] p-2 text-xs font-mono text-white outline-none focus:border-purple-500" />
                    {errors.captionStrategyJson && <p className="text-[10px] text-red-400">{errors.captionStrategyJson.message}</p>}
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Hashtag Strategy</label>
                    <textarea rows={3} {...register('hashtagStrategyJson')} className="mt-1.5 w-full rounded-lg border border-[#1a1a24] bg-[#161620] p-2 text-xs font-mono text-white outline-none focus:border-purple-500" />
                    {errors.hashtagStrategyJson && <p className="text-[10px] text-red-400">{errors.hashtagStrategyJson.message}</p>}
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Music Selection Rules</label>
                    <textarea rows={3} {...register('musicSelectionRulesJson')} className="mt-1.5 w-full rounded-lg border border-[#1a1a24] bg-[#161620] p-2 text-xs font-mono text-white outline-none focus:border-purple-500" />
                    {errors.musicSelectionRulesJson && <p className="text-[10px] text-red-400">{errors.musicSelectionRulesJson.message}</p>}
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Rendering Configuration</label>
                    <textarea rows={3} {...register('renderingConfigurationJson')} className="mt-1.5 w-full rounded-lg border border-[#1a1a24] bg-[#161620] p-2 text-xs font-mono text-white outline-none focus:border-purple-500" />
                    {errors.renderingConfigurationJson && <p className="text-[10px] text-red-400">{errors.renderingConfigurationJson.message}</p>}
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6e6e80]">Validation Rules</label>
                    <textarea rows={3} {...register('validationRulesJson')} className="mt-1.5 w-full rounded-lg border border-[#1a1a24] bg-[#161620] p-2 text-xs font-mono text-white outline-none focus:border-purple-500" />
                    {errors.validationRulesJson && <p className="text-[10px] text-red-400">{errors.validationRulesJson.message}</p>}
                  </div>
                </div>
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
              </div>

              {errorText && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-200">
                  {errorText}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1a1a24]/50">
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
                  {editingProfile ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingProfileId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-red-500/20 bg-[#0e0e12] p-6 shadow-2xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">Delete Content Profile?</h3>
              <p className="text-sm text-[#9c9cb0] mt-2">
                This action cannot be undone. Verify that no Channels are currently referencing this profile.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingProfileId(null)}
                className="rounded-lg border border-[#1a1a24] px-4 py-2 text-sm font-semibold text-[#9c9cb0] hover:bg-[#161620] transition"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingProfileId)}
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

export default ContentProfilesView;
