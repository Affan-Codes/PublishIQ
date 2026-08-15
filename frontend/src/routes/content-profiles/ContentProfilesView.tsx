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
import {
  Plus,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  FileText,
  Music,
  Sliders,
  ShieldAlert,
  Hash,
  MessageSquare,
  Sparkles,
  Layers,
  Image,
} from 'lucide-react';

const contentProfileSchema = z.object({
  name: z.string().min(1, 'Profile name is required').max(100),
  status: z.enum(['Active', 'Disabled']),
  contentTypeId: z.string().uuid('Invalid ContentType selection'),
  promptVersionId: z.string().uuid('Invalid PromptVersion selection'),
  templateVersionId: z.string().uuid('Invalid TemplateVersion selection'),
  language: z.enum(['English', 'Hindi', 'Urdu']),
  tone: z.string().min(1, 'Tone is required'),
  writingStyle: z.string().min(1, 'Writing style is required'),
});

type ContentProfileBaseFormValues = z.infer<typeof contentProfileSchema>;

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
  promptVariables: Record<string, any>;
  brandingRules: { text?: string; position?: string; color?: string; opacity?: number };
  watermarkRules: { text?: string; position?: string; opacity?: number };
  captionStrategy: { template?: string; prefix?: string; suffix?: string };
  hashtagStrategy: { tags?: string[]; mode?: string };
  musicSelectionRules: { mood?: string; genre?: string; minDurationSeconds?: number; maxDurationSeconds?: number };
  renderingConfiguration: { resolution?: string; fps?: number; branding?: string; watermark?: string };
  validationRules: { bannedWords?: string[]; maxLength?: number; minLength?: number; strictProfanity?: boolean };
}

export const ContentProfilesView: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useNotifications();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ContentProfile | null>(null);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'branding' | 'copy' | 'audio' | 'rendering'>('basic');

  // Structured Sub-Forms State
  const [promptVariablesList, setPromptVariablesList] = useState<{ key: string; value: string }[]>([]);
  const [brandingText, setBrandingText] = useState('');
  const [brandingPosition, setBrandingPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'>('bottom-right');
  const [brandingColor, setBrandingColor] = useState('#FFFFFF');
  const [brandingOpacity, setBrandingOpacity] = useState(0.85);

  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkPosition, setWatermarkPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'>('bottom-right');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.6);

  const [captionTemplate, setCaptionTemplate] = useState('{{text}}');
  const [captionPrefix, setCaptionPrefix] = useState('');
  const [captionSuffix, setCaptionSuffix] = useState('');

  const [hashtagInput, setHashtagInput] = useState('');
  const [hashtagMode, setHashtagMode] = useState<'append' | 'prepend' | 'replace' | 'none'>('append');

  const [musicMood, setMusicMood] = useState('Inspiring');
  const [musicGenre, setMusicGenre] = useState('Acoustic');
  const [musicMinDuration, setMusicMinDuration] = useState(10);
  const [musicMaxDuration, setMusicMaxDuration] = useState(60);

  const [renderResolution, setRenderResolution] = useState('1080x1920');
  const [renderFps, setRenderFps] = useState(30);

  const [bannedWordsInput, setBannedWordsInput] = useState('');
  const [valMaxLength, setValMaxLength] = useState(300);
  const [valMinLength, setValMinLength] = useState(5);
  const [valStrictProfanity, setValStrictProfanity] = useState(true);

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

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContentProfileBaseFormValues>({
    resolver: zodResolver(contentProfileSchema),
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingProfile(null);
    setSelectedPromptId('');
    setSelectedTemplateId('');
    setErrorText(null);
    setActiveTab('basic');
  };

  const buildStructuredPayload = (values: ContentProfileBaseFormValues) => {
    const promptVariables: Record<string, string> = {};
    promptVariablesList.forEach(({ key, value }) => {
      if (key.trim()) {
        promptVariables[key.trim()] = value;
      }
    });

    const brandingRules: any = {};
    if (brandingText.trim()) brandingRules.text = brandingText.trim();
    if (brandingPosition) brandingRules.position = brandingPosition;
    if (brandingColor) brandingRules.color = brandingColor;
    if (brandingOpacity !== undefined) brandingRules.opacity = Number(brandingOpacity);

    const watermarkRules: any = {};
    if (watermarkText.trim()) watermarkRules.text = watermarkText.trim();
    if (watermarkPosition) watermarkRules.position = watermarkPosition;
    if (watermarkOpacity !== undefined) watermarkRules.opacity = Number(watermarkOpacity);

    const captionStrategy: any = {};
    if (captionTemplate.trim()) captionStrategy.template = captionTemplate.trim();
    if (captionPrefix.trim()) captionStrategy.prefix = captionPrefix.trim();
    if (captionSuffix.trim()) captionStrategy.suffix = captionSuffix.trim();

    const hashtagStrategy: any = {};
    const tags = hashtagInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);
    if (tags.length > 0) hashtagStrategy.tags = tags;
    if (hashtagMode) hashtagStrategy.mode = hashtagMode;

    const musicSelectionRules: any = {
      mood: musicMood,
      genre: musicGenre,
      minDurationSeconds: Number(musicMinDuration) || 10,
      maxDurationSeconds: Number(musicMaxDuration) || 60,
    };

    const renderingConfiguration: any = {
      resolution: renderResolution,
      fps: Number(renderFps) || 30,
    };
    if (brandingText.trim()) renderingConfiguration.branding = brandingText.trim();
    if (watermarkText.trim()) renderingConfiguration.watermark = watermarkText.trim();

    const validationRules: any = {
      maxLength: Number(valMaxLength) || 300,
      minLength: Number(valMinLength) || 5,
      strictProfanity: Boolean(valStrictProfanity),
    };
    const banned = bannedWordsInput
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean);
    if (banned.length > 0) validationRules.bannedWords = banned;

    return {
      ...values,
      promptVariables,
      brandingRules,
      watermarkRules,
      captionStrategy,
      hashtagStrategy,
      musicSelectionRules,
      renderingConfiguration,
      validationRules,
    };
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
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
    mutationFn: async (payload: any) => {
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

  const onSubmit = (values: ContentProfileBaseFormValues) => {
    setErrorText(null);
    const payload = buildStructuredPayload(values);
    if (editingProfile) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const openCreateDialog = () => {
    setEditingProfile(null);
    setSelectedPromptId('');
    setSelectedTemplateId('');
    setErrorText(null);
    setActiveTab('basic');

    // Reset sub-form states
    setPromptVariablesList([]);
    setBrandingText('');
    setBrandingPosition('bottom-right');
    setBrandingColor('#FFFFFF');
    setBrandingOpacity(0.85);

    setWatermarkText('');
    setWatermarkPosition('bottom-right');
    setWatermarkOpacity(0.6);

    setCaptionTemplate('{{text}}');
    setCaptionPrefix('');
    setCaptionSuffix('');

    setHashtagInput('quotes, poetry, motivation');
    setHashtagMode('append');

    setMusicMood('Inspiring');
    setMusicGenre('Acoustic');
    setMusicMinDuration(10);
    setMusicMaxDuration(60);

    setRenderResolution('1080x1920');
    setRenderFps(30);

    setBannedWordsInput('');
    setValMaxLength(300);
    setValMinLength(5);
    setValStrictProfanity(true);

    reset({
      name: '',
      status: 'Active',
      language: 'English',
      tone: 'Inspiring',
      writingStyle: 'Poetic',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = async (profile: ContentProfile) => {
    setEditingProfile(profile);
    setErrorText(null);
    setActiveTab('basic');

    const promptId = profile.promptVersion?.prompt ? (profile.promptVersion as any).promptId || '' : '';
    const templateId = profile.templateVersion?.template ? (profile.templateVersion as any).templateId || '' : '';

    setSelectedPromptId(promptId);
    setSelectedTemplateId(templateId);

    // Populate sub-form states
    const pvList = Object.entries(profile.promptVariables || {}).map(([key, value]) => ({
      key,
      value: String(value),
    }));
    setPromptVariablesList(pvList);

    setBrandingText(profile.brandingRules?.text || '');
    setBrandingPosition((profile.brandingRules?.position as any) || 'bottom-right');
    setBrandingColor(profile.brandingRules?.color || '#FFFFFF');
    setBrandingOpacity(profile.brandingRules?.opacity ?? 0.85);

    setWatermarkText(profile.watermarkRules?.text || '');
    setWatermarkPosition((profile.watermarkRules?.position as any) || 'bottom-right');
    setWatermarkOpacity(profile.watermarkRules?.opacity ?? 0.6);

    setCaptionTemplate(profile.captionStrategy?.template || '{{text}}');
    setCaptionPrefix(profile.captionStrategy?.prefix || '');
    setCaptionSuffix(profile.captionStrategy?.suffix || '');

    setHashtagInput((profile.hashtagStrategy?.tags || []).join(', '));
    setHashtagMode((profile.hashtagStrategy?.mode as any) || 'append');

    setMusicMood(profile.musicSelectionRules?.mood || 'Inspiring');
    setMusicGenre(profile.musicSelectionRules?.genre || 'Acoustic');
    setMusicMinDuration(profile.musicSelectionRules?.minDurationSeconds ?? 10);
    setMusicMaxDuration(profile.musicSelectionRules?.maxDurationSeconds ?? 60);

    setRenderResolution(profile.renderingConfiguration?.resolution || '1080x1920');
    setRenderFps(profile.renderingConfiguration?.fps ?? 30);

    setBannedWordsInput((profile.validationRules?.bannedWords || []).join(', '));
    setValMaxLength(profile.validationRules?.maxLength ?? 300);
    setValMinLength(profile.validationRules?.minLength ?? 5);
    setValStrictProfanity(profile.validationRules?.strictProfanity ?? true);

    reset({
      name: profile.name,
      status: profile.status,
      contentTypeId: profile.contentTypeId,
      promptVersionId: profile.promptVersionId,
      templateVersionId: profile.templateVersionId,
      language: profile.language,
      tone: profile.tone,
      writingStyle: profile.writingStyle,
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
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
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

                <div className="bg-[#14141e] p-3 rounded-lg space-y-1.5 text-xs">
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
                  <div className="flex justify-between text-[11px] text-[#6e6e80] pt-1 border-t border-[#1a1a24]">
                    <span>Music: {profile.musicSelectionRules?.mood || 'Inspiring'} / {profile.musicSelectionRules?.genre || 'Acoustic'}</span>
                    <span>{profile.renderingConfiguration?.resolution || '1080x1920'}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {editingProfile ? 'Edit Content Profile' : 'Create New Content Profile'}
                </h3>
                <p className="text-xs text-[#9c9cb0]">Define pipeline behavior, branding overlays, copywriting, audio & validation rules</p>
              </div>
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

            {/* Navigation Tabs */}
            <div className="flex border-b border-[#1a1a24] gap-2 pb-1">
              {[
                { id: 'basic', label: '1. General & Variables', icon: Sliders },
                { id: 'branding', label: '2. Branding & Watermark', icon: Image },
                { id: 'copy', label: '3. Caption & Hashtags', icon: MessageSquare },
                { id: 'audio', label: '4. Music Rules', icon: Music },
                { id: 'rendering', label: '5. Render & Validation', icon: ShieldAlert },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      active
                        ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                        : 'text-[#6e6e80] hover:text-white hover:bg-[#14141e]'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-sm">
              {/* TAB 1: General & Variables */}
              {activeTab === 'basic' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                        Profile Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Hindi Shayari Master Profile"
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
                        placeholder="e.g. Inspiring, Romantic, Philosophical"
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
                      placeholder="e.g. Poetic, Rhyming, Philosophical"
                      {...register('writingStyle')}
                      className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                    />
                    {errors.writingStyle && <p className="mt-1 text-xs text-red-400">{errors.writingStyle.message}</p>}
                  </div>

                  {/* Prompt Variables Builder */}
                  <div className="rounded-xl border border-[#1a1a24] bg-[#14141e] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Custom Prompt Variables</h4>
                        <p className="text-[11px] text-[#6e6e80]">Define variable values required by the prompt template</p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Plus}
                        type="button"
                        onClick={() => setPromptVariablesList([...promptVariablesList, { key: '', value: '' }])}
                      >
                        Add Variable
                      </Button>
                    </div>

                    {promptVariablesList.length === 0 ? (
                      <p className="text-xs text-[#6e6e80] italic">No custom variables defined. Default prompt settings will apply.</p>
                    ) : (
                      <div className="space-y-2">
                        {promptVariablesList.map((item, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Key (e.g. author)"
                              value={item.key}
                              onChange={(e) => {
                                const next = [...promptVariablesList];
                                next[index].key = e.target.value;
                                setPromptVariablesList(next);
                              }}
                              className="w-1/2 rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500 font-mono"
                            />
                            <input
                              type="text"
                              placeholder="Value (e.g. Rumi)"
                              value={item.value}
                              onChange={(e) => {
                                const next = [...promptVariablesList];
                                next[index].value = e.target.value;
                                setPromptVariablesList(next);
                              }}
                              className="w-1/2 rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setPromptVariablesList(promptVariablesList.filter((_, i) => i !== index));
                              }}
                              className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: Branding & Watermark */}
              {activeTab === 'branding' && (
                <div className="space-y-6">
                  {/* Branding Rules */}
                  <div className="rounded-xl border border-[#1a1a24] bg-[#14141e] p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                      <Image size={14} className="text-purple-400" />
                      Visual Branding Overlay
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-[#9c9cb0] mb-1">Branding Label Text</label>
                        <input
                          type="text"
                          placeholder="e.g. PUBLISHIQ"
                          value={brandingText}
                          onChange={(e) => setBrandingText(e.target.value)}
                          className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#9c9cb0] mb-1">Screen Position</label>
                        <select
                          value={brandingPosition}
                          onChange={(e) => setBrandingPosition(e.target.value as any)}
                          className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                        >
                          <option value="top-left">Top Left</option>
                          <option value="top-right">Top Right</option>
                          <option value="bottom-left">Bottom Left</option>
                          <option value="bottom-right">Bottom Right</option>
                          <option value="center">Center</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[#9c9cb0] mb-1">Color (Hex/RGB)</label>
                        <input
                          type="text"
                          placeholder="#FFFFFF"
                          value={brandingColor}
                          onChange={(e) => setBrandingColor(e.target.value)}
                          className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#9c9cb0] mb-1">Opacity: {brandingOpacity}</label>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={brandingOpacity}
                          onChange={(e) => setBrandingOpacity(parseFloat(e.target.value))}
                          className="w-full accent-purple-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Watermark Rules */}
                  <div className="rounded-xl border border-[#1a1a24] bg-[#14141e] p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                      <Layers size={14} className="text-purple-400" />
                      Watermark Overlay
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-[#9c9cb0] mb-1">Watermark Handle</label>
                        <input
                          type="text"
                          placeholder="e.g. @dailyquotes"
                          value={watermarkText}
                          onChange={(e) => setWatermarkText(e.target.value)}
                          className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#9c9cb0] mb-1">Position</label>
                        <select
                          value={watermarkPosition}
                          onChange={(e) => setWatermarkPosition(e.target.value as any)}
                          className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                        >
                          <option value="bottom-right">Bottom Right</option>
                          <option value="bottom-left">Bottom Left</option>
                          <option value="top-right">Top Right</option>
                          <option value="top-left">Top Left</option>
                          <option value="center">Center</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[#9c9cb0] mb-1">Opacity: {watermarkOpacity}</label>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={watermarkOpacity}
                          onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                          className="w-full accent-purple-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Caption & Hashtags */}
              {activeTab === 'copy' && (
                <div className="space-y-6">
                  {/* Caption Strategy */}
                  <div className="rounded-xl border border-[#1a1a24] bg-[#14141e] p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                      <MessageSquare size={14} className="text-purple-400" />
                      Social Media Caption Strategy
                    </h4>
                    <div>
                      <label className="block text-xs text-[#9c9cb0] mb-1">Caption Template Body</label>
                      <textarea
                        rows={3}
                        placeholder="e.g. 💡 Daily Inspiration:\n\n{{text}}\n\nFollow for more quotes!"
                        value={captionTemplate}
                        onChange={(e) => setCaptionTemplate(e.target.value)}
                        className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] p-3 text-xs text-white outline-none focus:border-purple-500 font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-[#9c9cb0] mb-1">Prefix Text</label>
                        <input
                          type="text"
                          placeholder="e.g. ✨ "
                          value={captionPrefix}
                          onChange={(e) => setCaptionPrefix(e.target.value)}
                          className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#9c9cb0] mb-1">Suffix Text</label>
                        <input
                          type="text"
                          placeholder="e.g. #shorts"
                          value={captionSuffix}
                          onChange={(e) => setCaptionSuffix(e.target.value)}
                          className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hashtag Strategy */}
                  <div className="rounded-xl border border-[#1a1a24] bg-[#14141e] p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                      <Hash size={14} className="text-purple-400" />
                      Hashtag Placement Strategy
                    </h4>
                    <div>
                      <label className="block text-xs text-[#9c9cb0] mb-1">Tags (comma separated)</label>
                      <input
                        type="text"
                        placeholder="quote, shayari, wisdom, poetry, motivation"
                        value={hashtagInput}
                        onChange={(e) => setHashtagInput(e.target.value)}
                        className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#9c9cb0] mb-1">Placement Mode</label>
                      <select
                        value={hashtagMode}
                        onChange={(e) => setHashtagMode(e.target.value as any)}
                        className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                      >
                        <option value="append">Append to end of post</option>
                        <option value="prepend">Prepend to start</option>
                        <option value="replace">Replace post hashtags</option>
                        <option value="none">Disabled</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Music Selection Rules */}
              {activeTab === 'audio' && (
                <div className="rounded-xl border border-[#1a1a24] bg-[#14141e] p-4 space-y-4">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                    <Music size={14} className="text-purple-400" />
                    Background Music Rotation Rules
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[#9c9cb0] mb-1">Preferred Mood</label>
                      <select
                        value={musicMood}
                        onChange={(e) => setMusicMood(e.target.value)}
                        className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                      >
                        <option value="Inspiring">Inspiring</option>
                        <option value="Calm">Calm</option>
                        <option value="Energetic">Energetic</option>
                        <option value="Dramatic">Dramatic</option>
                        <option value="Melancholic">Melancholic</option>
                        <option value="Reflective">Reflective</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-[#9c9cb0] mb-1">Preferred Genre</label>
                      <select
                        value={musicGenre}
                        onChange={(e) => setMusicGenre(e.target.value)}
                        className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                      >
                        <option value="Acoustic">Acoustic</option>
                        <option value="Ambient">Ambient</option>
                        <option value="Classical">Classical</option>
                        <option value="Electronic">Electronic</option>
                        <option value="Cinematic">Cinematic</option>
                        <option value="Lo-Fi">Lo-Fi</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-[#9c9cb0] mb-1">Min Track Duration (sec)</label>
                      <input
                        type="number"
                        min={5}
                        max={300}
                        value={musicMinDuration}
                        onChange={(e) => setMusicMinDuration(parseInt(e.target.value) || 10)}
                        className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-[#9c9cb0] mb-1">Max Track Duration (sec)</label>
                      <input
                        type="number"
                        min={10}
                        max={600}
                        value={musicMaxDuration}
                        onChange={(e) => setMusicMaxDuration(parseInt(e.target.value) || 60)}
                        className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: Rendering & Validation */}
              {activeTab === 'rendering' && (
                <div className="space-y-6">
                  {/* Rendering Configuration */}
                  <div className="rounded-xl border border-[#1a1a24] bg-[#14141e] p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                      <Sparkles size={14} className="text-purple-400" />
                      Video Rendering Pipeline Settings
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-[#9c9cb0] mb-1">Output Resolution</label>
                        <select
                          value={renderResolution}
                          onChange={(e) => setRenderResolution(e.target.value)}
                          className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                        >
                          <option value="1080x1920">1080x1920 (Vertical 9:16 - Reels/Shorts)</option>
                          <option value="1920x1080">1920x1080 (Landscape 16:9 - YouTube)</option>
                          <option value="1080x1080">1080x1080 (Square 1:1 - Feed)</option>
                          <option value="720x1280">720x1280 (HD 9:16)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-[#9c9cb0] mb-1">Frame Rate (FPS)</label>
                        <select
                          value={renderFps}
                          onChange={(e) => setRenderFps(parseInt(e.target.value) || 30)}
                          className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                        >
                          <option value={30}>30 FPS</option>
                          <option value={60}>60 FPS</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Validation Rules */}
                  <div className="rounded-xl border border-[#1a1a24] bg-[#14141e] p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                      <ShieldAlert size={14} className="text-purple-400" />
                      Content Validation Rules
                    </h4>
                    <div>
                      <label className="block text-xs text-[#9c9cb0] mb-1">Banned Words (comma separated)</label>
                      <input
                        type="text"
                        placeholder="spam, clickbait, swearword, prohibited"
                        value={bannedWordsInput}
                        onChange={(e) => setBannedWordsInput(e.target.value)}
                        className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-[#9c9cb0] mb-1">Min Length (chars)</label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={valMinLength}
                          onChange={(e) => setValMinLength(parseInt(e.target.value) || 5)}
                          className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#9c9cb0] mb-1">Max Length (chars)</label>
                        <input
                          type="number"
                          min={10}
                          max={2000}
                          value={valMaxLength}
                          onChange={(e) => setValMaxLength(parseInt(e.target.value) || 300)}
                          className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500 font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="strictProfanityCheck"
                        checked={valStrictProfanity}
                        onChange={(e) => setValStrictProfanity(e.target.checked)}
                        className="rounded border-[#1a1a24] bg-[#161620] text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="strictProfanityCheck" className="text-xs text-white cursor-pointer">
                        Enforce Strict Base System Profanity Filtering
                      </label>
                    </div>
                  </div>
                </div>
              )}

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
