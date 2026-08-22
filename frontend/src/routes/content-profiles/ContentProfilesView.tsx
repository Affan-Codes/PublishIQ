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
  AlertTriangle,
  FileText,
  Music,
  Sliders,
  ShieldAlert,
  Hash,
  MessageSquare,
  Sparkles,
  Layers,
  Image,
  Check,
  Film,
  Square,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Eye,
  Layout,
} from 'lucide-react';

const contentProfileSchema = z.object({
  name: z.string().min(1, 'Profile name is required').max(100),
  notes: z.string().max(500).optional().nullable(),
  status: z.enum(['Active', 'Disabled']),
  contentTypeId: z.string().uuid('Invalid ContentType selection'),
  promptVersionId: z.string().uuid('Invalid PromptVersion selection'),
  templateVersionId: z.string().uuid('Invalid TemplateVersion selection'),
  language: z.enum(['English', 'Hindi', 'Urdu', 'HindiRoman', 'UrduRoman']),
  tone: z.string().min(1, 'Tone is required'),
  writingStyle: z.string().min(1, 'Writing style is required'),
});

type ContentProfileBaseFormValues = z.infer<typeof contentProfileSchema>;

interface ContentProfile {
  id: string;
  name: string;
  notes?: string | null;
  status: 'Active' | 'Disabled';
  language: 'English' | 'Hindi' | 'Urdu' | 'HindiRoman' | 'UrduRoman';
  tone: string;
  writingStyle: string;
  contentTypeId: string;
  promptVersionId: string;
  templateVersionId: string;
  contentType: { name: string };
  promptVersion: { id?: string; versionNumber: number; status?: string; prompt: { name: string } };
  templateVersion: { id?: string; versionNumber: number; status?: string; template: { name: string } };
  promptVariables: Record<string, any>;
  brandingRules: { text?: string; position?: string; color?: string; opacity?: number };
  watermarkRules: { text?: string; position?: string; opacity?: number };
  captionStrategy: { template?: string; prefix?: string; suffix?: string };
  hashtagStrategy: { tags?: string[]; mode?: string };
  musicSelectionRules: { mood?: string; genre?: string; minDurationSeconds?: number; maxDurationSeconds?: number };
  backgroundSelectionRules?: {
    selectionMode?: 'Off' | 'Manual' | 'AI';
    manualAssetId?: string;
    mood?: string;
    style?: string;
    theme?: string;
    tags?: string[];
    orientation?: 'portrait' | 'landscape' | 'square';
  };
  renderingConfiguration: { resolution?: string; fps?: number; branding?: string; watermark?: string; animation?: { preset?: string } };
  validationRules: { bannedWords?: string[]; maxLength?: number; minLength?: number; strictProfanity?: boolean };
}

const ANIMATION_PRESET_OPTIONS = [
  {
    key: 'None',
    label: 'None (Static)',
    description: 'Static image without zoom or pan motion',
    badge: 'Static',
    icon: Square,
  },
  {
    key: 'SlowZoomIn',
    label: 'Slow Zoom In',
    description: 'Smooth camera push from 1.0x to 1.10x',
    badge: '1.0x → 1.10x',
    icon: ZoomIn,
  },
  {
    key: 'SlowZoomOut',
    label: 'Slow Zoom Out',
    description: 'Smooth camera pull-back from 1.10x to 1.0x',
    badge: '1.10x → 1.0x',
    icon: ZoomOut,
  },
  {
    key: 'PanLeft',
    label: 'Pan Left',
    description: 'Horizontal camera sweep from right to left',
    badge: 'Right → Left',
    icon: ArrowLeft,
  },
  {
    key: 'PanRight',
    label: 'Pan Right',
    description: 'Horizontal camera sweep from left to right',
    badge: 'Left → Right',
    icon: ArrowRight,
  },
  {
    key: 'PanUp',
    label: 'Pan Up',
    description: 'Vertical camera sweep from bottom to top',
    badge: 'Bottom → Top',
    icon: ArrowUp,
  },
  {
    key: 'PanDown',
    label: 'Pan Down',
    description: 'Vertical camera sweep from top to bottom',
    badge: 'Top → Bottom',
    icon: ArrowDown,
  },
];

function AnimationPresetCard({
  option,
  isSelected,
  onSelect,
}: {
  option: (typeof ANIMATION_PRESET_OPTIONS)[0];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = option.icon;

  return (
    <div
      onClick={onSelect}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border p-3 cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'border-purple-500 bg-purple-950/30 shadow-lg shadow-purple-950/40 ring-1 ring-purple-500'
          : 'border-[#1a1a24] bg-[#14141e] hover:border-[#2a2a3e] hover:bg-[#181826]'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className={`p-2 rounded-lg transition-colors ${
            isSelected
              ? 'bg-purple-600/25 text-purple-300'
              : 'bg-zinc-850 text-zinc-400 group-hover:bg-zinc-800 group-hover:text-zinc-200'
          }`}
        >
          <Icon size={18} />
        </div>
        <span
          className={`text-[9px] font-mono font-medium px-1.5 py-0.5 rounded border ${
            isSelected
              ? 'bg-purple-900/60 text-purple-200 border-purple-700/50'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800'
          }`}
        >
          {option.badge}
        </span>
      </div>

      <div className="space-y-0.5">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold ${isSelected ? 'text-purple-300' : 'text-white'}`}>
            {option.label}
          </span>
          {isSelected && <Check size={13} className="text-purple-400 shrink-0" />}
        </div>
        <p className="text-[10px] text-[#6e6e80] line-clamp-2 leading-tight">
          {option.description}
        </p>
      </div>
    </div>
  );
}

export const ContentProfilesView: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useNotifications();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ContentProfile | null>(null);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'branding' | 'background' | 'copy' | 'audio' | 'rendering'>('basic');

  // Structured Sub-Forms State
  const [promptVariablesList, setPromptVariablesList] = useState<{ key: string; value: string }[]>([]);
  const [brandingText, setBrandingText] = useState('');
  const [brandingPosition, setBrandingPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'>('bottom-right');
  const [brandingColor, setBrandingColor] = useState('#FFFFFF');
  const [brandingOpacity, setBrandingOpacity] = useState(0.85);

  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkPosition, setWatermarkPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'>('bottom-right');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.6);

  // Background Selection State
  const [bgSelectionMode, setBgSelectionMode] = useState<'Off' | 'Manual' | 'AI'>('Off');
  const [bgManualAssetId, setBgManualAssetId] = useState<string>('');
  const [bgMood, setBgMood] = useState<string>('');
  const [bgStyle, setBgStyle] = useState<string>('');
  const [bgTheme, setBgTheme] = useState<string>('');
  const [bgTagsInput, setBgTagsInput] = useState<string>('');
  const [bgOrientation, setBgOrientation] = useState<'portrait' | 'landscape' | 'square'>('portrait');

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
  const [renderAnimationPreset, setRenderAnimationPreset] = useState<string>('None');

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

  const { data: backgroundAssets = [] } = useQuery<any[]>({
    queryKey: ['background-assets'],
    queryFn: async () => {
      const res = await apiClient.get('/assets?type=Background');
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

  const handleRefreshAll = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['content-types'] });
    queryClient.invalidateQueries({ queryKey: ['prompts'] });
    queryClient.invalidateQueries({ queryKey: ['templates'] });
  };

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ContentProfileBaseFormValues>({
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
      fps: 30,
      animation: {
        preset: renderAnimationPreset || 'None',
      },
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

    let backgroundSelectionRules: any = {};
    if (bgSelectionMode === 'Manual') {
      backgroundSelectionRules = {
        selectionMode: 'Manual',
        manualAssetId: bgManualAssetId || undefined,
      };
    } else if (bgSelectionMode === 'AI') {
      const bgTags = bgTagsInput.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
      backgroundSelectionRules = {
        selectionMode: 'AI',
        mood: bgMood.trim() || undefined,
        style: bgStyle.trim() || undefined,
        theme: bgTheme.trim() || undefined,
        tags: bgTags.length > 0 ? bgTags : undefined,
        orientation: bgOrientation || undefined,
      };
    }

    return {
      ...values,
      notes: values.notes?.trim() || null,
      promptVariables,
      brandingRules,
      watermarkRules,
      captionStrategy,
      hashtagStrategy,
      musicSelectionRules,
      backgroundSelectionRules,
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
    if (bgSelectionMode === 'Manual' && !bgManualAssetId) {
      setErrorText('Manual background mode requires selecting a background asset.');
      setActiveTab('background');
      return;
    }
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

    // Reset background state
    setBgSelectionMode('Off');
    setBgManualAssetId('');
    setBgMood('');
    setBgStyle('');
    setBgTheme('');
    setBgTagsInput('');
    setBgOrientation('portrait');

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
    setRenderAnimationPreset('None');

    setBannedWordsInput('');
    setValMaxLength(300);
    setValMinLength(5);
    setValStrictProfanity(true);

    setSelectedPromptId('');
    setSelectedTemplateId('');

    reset({
      name: '',
      notes: '',
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

    // Populate background state
    const bgRules = profile.backgroundSelectionRules || {};
    setBgSelectionMode((bgRules.selectionMode as any) || 'Off');
    setBgManualAssetId(bgRules.manualAssetId || '');
    setBgMood(bgRules.mood || '');
    setBgStyle(bgRules.style || '');
    setBgTheme(bgRules.theme || '');
    setBgTagsInput(Array.isArray(bgRules.tags) ? bgRules.tags.join(', ') : '');
    setBgOrientation((bgRules.orientation as any) || 'portrait');

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
    setRenderAnimationPreset(profile.renderingConfiguration?.animation?.preset || 'None');

    setBannedWordsInput((profile.validationRules?.bannedWords || []).join(', '));
    setValMaxLength(profile.validationRules?.maxLength ?? 300);
    setValMinLength(profile.validationRules?.minLength ?? 5);
    setValStrictProfanity(profile.validationRules?.strictProfanity ?? true);

    reset({
      name: profile.name,
      notes: profile.notes || '',
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
                  {profile.notes && (
                    <p className="text-xs text-[#6e6e80] italic mt-1 line-clamp-2">
                      {profile.notes}
                    </p>
                  )}
                </div>

                {profile.promptVersion?.status === 'Deprecated' && (
                  <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs text-amber-300">
                    <AlertTriangle size={12} className="shrink-0 text-amber-400" />
                    <span>Uses Deprecated Prompt (v{profile.promptVersion.versionNumber})</span>
                  </div>
                )}

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
                  <div className="flex justify-between text-[11px] text-[#6e6e80] pt-1 border-t border-[#1a1a24]">
                    <span>Background:</span>
                    <span className="font-semibold text-purple-300">
                      {profile.backgroundSelectionRules?.selectionMode === 'Manual'
                        ? 'Manual (Pinned)'
                        : profile.backgroundSelectionRules?.selectionMode === 'AI'
                        ? `AI (${profile.backgroundSelectionRules.mood || 'Dynamic'})`
                        : 'Off (Black Canvas)'}
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
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog Modal */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm p-4 sm:p-6 flex justify-center items-start sm:items-center py-10 sm:py-12">
          <div className="w-full max-w-4xl rounded-2xl border border-[#1a1a24] bg-[#0e0e12] p-6 space-y-6 shadow-2xl my-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {editingProfile ? 'Edit Content Profile' : 'Create Content Profile'}
                </h3>
                <p className="text-xs text-[#9c9cb0]">
                  Configure production parameters, AI prompt versions, visual rules, and platform strategy
                </p>
              </div>
              <button
                onClick={closeDialog}
                className="text-[#6e6e80] hover:text-white transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {errorText && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{errorText}</span>
              </div>
            )}

            {/* Sub-form Navigation Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-[#1a1a24] pb-3">
              {[
                { id: 'basic', label: '1. General & Variables', icon: Sliders },
                { id: 'branding', label: '2. Branding & Watermark', icon: Layers },
                { id: 'background', label: '3. Background Rules', icon: Image },
                { id: 'copy', label: '4. Captions & Hashtags', icon: MessageSquare },
                { id: 'audio', label: '5. Music Rules', icon: Music },
                { id: 'rendering', label: '6. Render & Validation', icon: ShieldAlert },
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

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80] mb-1">
                      Notes / Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Operational profile for daily viral Hindi quotes"
                      {...register('notes')}
                      className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-white outline-none focus:border-purple-500"
                    />
                    {errors.notes && <p className="mt-1 text-xs text-red-400">{errors.notes.message}</p>}
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
                        <option value="HindiRoman">Hindi (Roman)</option>
                        <option value="Urdu">Urdu</option>
                        <option value="UrduRoman">Urdu (Roman)</option>
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
                          <option
                            key={pv.id}
                            value={pv.id}
                            className={pv.status === 'Deprecated' ? 'text-[#6e6e80]' : ''}
                          >
                            Version {pv.versionNumber} {pv.status === 'Deprecated' ? '(Deprecated)' : '(Active)'}
                          </option>
                        ))}
                      </select>
                      {errors.promptVersionId && <p className="mt-1 text-xs text-red-400">{errors.promptVersionId.message}</p>}

                      {promptVersions.find((pv: any) => pv.id === watch('promptVersionId'))?.status === 'Deprecated' && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-[11px] text-amber-300">
                          <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-400" />
                          <span>This profile uses a deprecated prompt version. It will continue working, but consider upgrading to an Active version.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Visual Template Card Picker */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#6e6e80]">
                        Visual Rendering Template
                      </label>
                      <span className="text-[11px] text-[#9c9cb0]">
                        Select template layout and version
                      </span>
                    </div>

                    <input type="hidden" {...register('templateVersionId')} />

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {templates.map((t: any) => {
                        const activeVer = t.versions?.find((v: any) => v.status === 'Active') || t.versions?.[0];
                        const isSelected = selectedTemplateId === t.id || watch('templateVersionId') === activeVer?.id;
                        const categoryName = activeVer?.category || 'MinimalQuote';

                        return (
                          <div
                            key={t.id}
                            onClick={() => {
                              setSelectedTemplateId(t.id);
                              if (activeVer) {
                                setValue('templateVersionId', activeVer.id, { shouldValidate: true });
                              }
                            }}
                            className={`rounded-xl border p-3 cursor-pointer transition flex flex-col justify-between space-y-2 relative ${
                              isSelected
                                ? 'bg-purple-950/20 border-purple-500 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500'
                                : 'bg-[#14141e] border-[#1a1a24] hover:border-[#2b2b3a]'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                  {categoryName}
                                </span>
                                {isSelected && (
                                  <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">
                                    <Check size={10} />
                                  </span>
                                )}
                              </div>

                              {activeVer?.previewImageUrl ? (
                                <div className="w-full h-24 rounded-lg bg-black overflow-hidden border border-white/10">
                                  <img
                                    src={activeVer.previewImageUrl}
                                    alt={t.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-full h-24 rounded-lg bg-[#0e0e14] border border-dashed border-[#2b2b3a] flex flex-col items-center justify-center text-[#6e6e80] gap-1">
                                  <Layout size={18} />
                                  <span className="text-[10px]">Visual Layout</span>
                                </div>
                              )}

                              <div>
                                <h4 className="font-bold text-xs text-white line-clamp-1">{t.name}</h4>
                                <span className="text-[10px] text-[#6e6e80]">
                                  Version {activeVer?.versionNumber ?? 1} ({activeVer?.status ?? 'Active'})
                                </span>
                              </div>
                            </div>

                            {isSelected && t.versions && t.versions.length > 1 && (
                              <div className="pt-2 border-t border-[#1a1a24]" onClick={(e) => e.stopPropagation()}>
                                <label className="text-[10px] text-[#6e6e80] font-semibold block mb-1">Select Version</label>
                                <select
                                  value={watch('templateVersionId')}
                                  onChange={(e) => setValue('templateVersionId', e.target.value, { shouldValidate: true })}
                                  className="w-full rounded bg-[#161620] border border-[#1a1a24] text-white text-[11px] px-2 py-1 outline-none focus:border-purple-500"
                                >
                                  {t.versions.map((tv: any) => (
                                    <option key={tv.id} value={tv.id}>
                                      v{tv.versionNumber} ({tv.status})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {errors.templateVersionId && (
                      <p className="mt-1 text-xs text-red-400">{errors.templateVersionId.message}</p>
                    )}
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

              {/* TAB 3: Background Rules */}
              {activeTab === 'background' && (
                <div className="space-y-6">
                  {/* Selection Mode Switch */}
                  <div className="rounded-xl border border-[#1a1a24] bg-[#14141e] p-4 space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                        <Image size={14} className="text-purple-400" />
                        Background Image Strategy
                      </h4>
                      <p className="text-[11px] text-[#6e6e80] mt-0.5">
                        Choose whether generated quotes use plain black, a pinned asset, or dynamic AI background matching.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setBgSelectionMode('Off')}
                        className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          bgSelectionMode === 'Off'
                            ? 'bg-purple-950/20 border-purple-500/50 text-white shadow-lg'
                            : 'bg-[#161620] border-[#1a1a24] text-[#9c9cb0] hover:text-white hover:border-[#2b2b3a]'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="font-bold text-xs">Off (Solid Black)</span>
                          {bgSelectionMode === 'Off' && <Check size={14} className="text-purple-400" />}
                        </div>
                        <span className="text-[10px] text-[#6e6e80]">Standard dark high-contrast backdrop</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBgSelectionMode('Manual')}
                        className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          bgSelectionMode === 'Manual'
                            ? 'bg-purple-950/20 border-purple-500/50 text-white shadow-lg'
                            : 'bg-[#161620] border-[#1a1a24] text-[#9c9cb0] hover:text-white hover:border-[#2b2b3a]'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="font-bold text-xs">Manual (Pinned Asset)</span>
                          {bgSelectionMode === 'Manual' && <Check size={14} className="text-purple-400" />}
                        </div>
                        <span className="text-[10px] text-[#6e6e80]">Pin a specific background image asset</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBgSelectionMode('AI')}
                        className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          bgSelectionMode === 'AI'
                            ? 'bg-purple-950/20 border-purple-500/50 text-white shadow-lg'
                            : 'bg-[#161620] border-[#1a1a24] text-[#9c9cb0] hover:text-white hover:border-[#2b2b3a]'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="font-bold text-xs">AI Selection</span>
                          {bgSelectionMode === 'AI' && <Check size={14} className="text-purple-400" />}
                        </div>
                        <span className="text-[10px] text-[#6e6e80]">Gemini selects best matching asset dynamically</span>
                      </button>
                    </div>
                  </div>

                  {/* Manual Mode Asset Picker */}
                  {bgSelectionMode === 'Manual' && (
                    <div className="rounded-xl border border-[#1a1a24] bg-[#14141e] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Select Pinned Background</h4>
                          <p className="text-[11px] text-[#6e6e80]">Choose an active confirmed background asset</p>
                        </div>
                        <span className="text-[11px] text-[#9c9cb0]">
                          {backgroundAssets.filter((a: any) => a.status === 'Active' && a.licenseStatus === 'Confirmed').length} available
                        </span>
                      </div>

                      {backgroundAssets.length === 0 ? (
                        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300">
                          No background assets found. Upload images in the Media Assets tab first.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-60 overflow-y-auto pr-1">
                          {backgroundAssets.map((asset: any) => {
                            const isSelected = bgManualAssetId === asset.id;
                            const isEligible = asset.status === 'Active' && asset.licenseStatus === 'Confirmed';

                            return (
                              <div
                                key={asset.id}
                                onClick={() => {
                                  if (isEligible) setBgManualAssetId(asset.id);
                                }}
                                className={`group relative rounded-lg border overflow-hidden transition cursor-pointer flex flex-col justify-between ${
                                  isSelected
                                    ? 'border-purple-500 bg-purple-950/30 ring-2 ring-purple-500/50'
                                    : isEligible
                                    ? 'border-[#1a1a24] bg-[#161620] hover:border-purple-500/40'
                                    : 'border-zinc-800/40 bg-zinc-900/40 opacity-50 cursor-not-allowed'
                                }`}
                              >
                                <div className="relative h-20 w-full bg-black/40">
                                  <img
                                    src={asset.filePath}
                                    alt={asset.name}
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                  {isSelected && (
                                    <div className="absolute inset-0 bg-purple-600/30 flex items-center justify-center">
                                      <div className="rounded-full bg-purple-500 p-1 text-white shadow-md">
                                        <Check size={14} />
                                      </div>
                                    </div>
                                  )}
                                  {asset.metadata?.orientation && (
                                    <span className="absolute top-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[8px] uppercase font-bold text-purple-300">
                                      {asset.metadata.orientation}
                                    </span>
                                  )}
                                </div>
                                <div className="p-2">
                                  <p className="text-[11px] font-semibold text-white truncate">{asset.name}</p>
                                  <p className="text-[10px] text-[#6e6e80] truncate">
                                    {asset.metadata?.mood || 'Default'} • {asset.metadata?.style || 'Photo'}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Mode Rules Configuration */}
                  {bgSelectionMode === 'AI' && (
                    <div className="rounded-xl border border-[#1a1a24] bg-[#14141e] p-4 space-y-4">
                      <div className="rounded-lg bg-purple-950/20 border border-purple-500/20 p-3 text-xs text-purple-300 flex items-start gap-2">
                        <Sparkles size={16} className="shrink-0 text-purple-400 mt-0.5" />
                        <div>
                          <strong>Dynamic Content-Aware Selection:</strong> Gemini analyzes the generated quote and chooses the best candidate from your workspace background catalog during pipeline execution.
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-[#9c9cb0] mb-1">Preferred Mood</label>
                          <input
                            type="text"
                            placeholder="e.g. Calm, Inspiring, Dark"
                            value={bgMood}
                            onChange={(e) => setBgMood(e.target.value)}
                            className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-[#9c9cb0] mb-1">Preferred Style</label>
                          <input
                            type="text"
                            placeholder="e.g. Photo, Gradient, Minimalist"
                            value={bgStyle}
                            onChange={(e) => setBgStyle(e.target.value)}
                            className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-[#9c9cb0] mb-1">Theme Filter</label>
                          <input
                            type="text"
                            placeholder="e.g. Nature, Urban, Abstract"
                            value={bgTheme}
                            onChange={(e) => setBgTheme(e.target.value)}
                            className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-[#9c9cb0] mb-1">Preferred Orientation</label>
                          <select
                            value={bgOrientation}
                            onChange={(e) => setBgOrientation(e.target.value as any)}
                            className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                          >
                            <option value="portrait">Portrait (9:16)</option>
                            <option value="landscape">Landscape (16:9)</option>
                            <option value="square">Square (1:1)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-[#9c9cb0] mb-1">Target Tags (Comma-Separated)</label>
                        <input
                          type="text"
                          placeholder="e.g. sunset, mountains, serene, night"
                          value={bgTagsInput}
                          onChange={(e) => setBgTagsInput(e.target.value)}
                          className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  )}
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
                        <div className="flex items-center justify-between rounded-lg border border-[#1a1a24] bg-[#161620] px-3 py-2 text-xs text-zinc-300">
                          <span className="font-medium text-white">30 FPS</span>
                          <span className="text-[10px] text-purple-400 font-mono bg-purple-950/60 border border-purple-800/40 px-1.5 py-0.5 rounded">
                            Standard Engine
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Motion & Animation Preset Visual Selector */}
                  <div className="rounded-xl border border-[#1a1a24] bg-[#14141e] p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                          <Film size={14} className="text-purple-400" />
                          Motion & Animation Preset
                        </h4>
                        <p className="text-[11px] text-[#6e6e80]">
                          Cinematic camera motion applied directly to the background plate in FFmpeg.
                        </p>
                      </div>
                      <span className="text-[10px] font-mono font-medium text-purple-300 bg-purple-950/80 border border-purple-800/40 px-2 py-0.5 rounded-md">
                        Selected: {ANIMATION_PRESET_OPTIONS.find((p) => p.key === renderAnimationPreset)?.label || renderAnimationPreset}
                      </span>
                    </div>

                    {/* Live CSS Preview Panel + Preset Cards Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pt-1">
                      {/* Live CSS Preview Screen */}
                      <div className="md:col-span-4 flex flex-col items-center justify-center p-3 rounded-xl border border-[#1e1e2d] bg-black/40">
                        <div className="flex items-center gap-1.5 mb-2.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          <Eye size={13} className="text-purple-400" />
                          Live Motion Preview
                        </div>

                        {/* 9:16 Viewport */}
                        <div className="relative aspect-[9/16] w-36 max-w-full overflow-hidden rounded-lg border border-purple-500/30 bg-zinc-950 shadow-xl">
                          <style>{`
                            @keyframes livePreviewZoomIn {
                              0% { transform: scale(1.0); }
                              100% { transform: scale(1.15); }
                            }
                            @keyframes livePreviewZoomOut {
                              0% { transform: scale(1.15); }
                              100% { transform: scale(1.0); }
                            }
                            @keyframes livePreviewPanLeft {
                              0% { transform: scale(1.2) translateX(8%); }
                              100% { transform: scale(1.2) translateX(-8%); }
                            }
                            @keyframes livePreviewPanRight {
                              0% { transform: scale(1.2) translateX(-8%); }
                              100% { transform: scale(1.2) translateX(8%); }
                            }
                            @keyframes livePreviewPanUp {
                              0% { transform: scale(1.2) translateY(8%); }
                              100% { transform: scale(1.2) translateY(-8%); }
                            }
                            @keyframes livePreviewPanDown {
                              0% { transform: scale(1.2) translateY(-8%); }
                              100% { transform: scale(1.2) translateY(8%); }
                            }
                          `}</style>
                          {/* Animated Background Layer */}
                          <img
                            src={
                              backgroundAssets.find((a: any) => a.id === bgManualAssetId)?.url ||
                              'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1080&q=80'
                            }
                            alt="Background Preview"
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{
                              animation:
                                renderAnimationPreset === 'SlowZoomIn'
                                  ? 'livePreviewZoomIn 3.5s ease-in-out infinite alternate'
                                  : renderAnimationPreset === 'SlowZoomOut'
                                  ? 'livePreviewZoomOut 3.5s ease-in-out infinite alternate'
                                  : renderAnimationPreset === 'PanLeft'
                                  ? 'livePreviewPanLeft 3.5s ease-in-out infinite alternate'
                                  : renderAnimationPreset === 'PanRight'
                                  ? 'livePreviewPanRight 3.5s ease-in-out infinite alternate'
                                  : renderAnimationPreset === 'PanUp'
                                  ? 'livePreviewPanUp 3.5s ease-in-out infinite alternate'
                                  : renderAnimationPreset === 'PanDown'
                                  ? 'livePreviewPanDown 3.5s ease-in-out infinite alternate'
                                  : 'none',
                            }}
                          />

                          {/* Scrim Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80 pointer-events-none" />

                          {/* Foreground Mock Typography */}
                          <div className="absolute inset-0 flex flex-col justify-between items-center p-2.5 text-center pointer-events-none z-10">
                            <span className="text-[7px] font-bold text-zinc-300 uppercase tracking-widest">
                              {brandingText || 'PUBLISHIQ'}
                            </span>
                            <p className="text-[9px] font-semibold text-white leading-tight drop-shadow">
                              "The journey of a thousand miles begins with a single step."
                            </p>
                            <span className="text-[7px] text-zinc-400 font-mono">
                              {watermarkText || '@publishiq'}
                            </span>
                          </div>
                        </div>

                        <span className="mt-2 text-[10px] text-zinc-500 font-medium text-center">
                          Simulated CSS motion (Rendered via FFmpeg)
                        </span>
                      </div>

                      {/* Preset Cards Selector */}
                      <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {ANIMATION_PRESET_OPTIONS.map((option) => (
                          <AnimationPresetCard
                            key={option.key}
                            option={option}
                            isSelected={renderAnimationPreset === option.key}
                            onSelect={() => setRenderAnimationPreset(option.key)}
                          />
                        ))}
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
