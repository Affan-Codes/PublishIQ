import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Switch,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Edit,
  Play,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Sparkles,
  Shield,
  FileText,
  Layers,
  Music,
  Image as ImageIcon,
  Video,
  Check,
  Calendar,
  Clock,
} from 'lucide-react-native';
import { useContentProfileDetailQuery } from '../../../hooks/queries/useContentProfileDetailQuery';
import { useContentProfileReadinessQuery } from '../../../hooks/queries/useContentProfileReadinessQuery';
import { useContentTypesQuery } from '../../../hooks/queries/useContentTypesQuery';
import { usePromptsQuery } from '../../../hooks/queries/usePromptsQuery';
import { useTemplatesQuery } from '../../../hooks/queries/useTemplatesQuery';
import {
  useUpdateContentProfileMutation,
  useDryRunProfileMutation,
  useDeleteContentProfileMutation,
} from '../../../hooks/mutations/useContentProfileMutations';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { tokens } from '../../../design/tokens';
import { formatDateTime } from '../../../lib/format';
import { getStatusBadge } from '../../../lib/status';
import {
  ContentProfile,
  Language,
  ContentProfileStatus,
  PromptVersion,
  TemplateVersion,
} from '../../../types/domain';

interface ReadOnlyRowProps {
  label: string;
  value?: string | number | boolean | null;
  isCode?: boolean;
  colorSwatch?: string;
}

function ReadOnlyRow({ label, value, isCode, colorSwatch }: ReadOnlyRowProps) {
  const displayValue =
    value === null || value === undefined || value === '' ? '—' : String(value);

  return (
    <View style={styles.readOnlyRow}>
      <Text style={styles.readOnlyLabel}>{label}</Text>
      <View style={styles.readOnlyValueWrapper}>
        {colorSwatch ? (
          <View style={[styles.inlineColorSwatch, { backgroundColor: colorSwatch }]} />
        ) : null}
        <Text
          style={[styles.readOnlyValue, isCode && styles.monospaceText]}
          numberOfLines={3}
        >
          {displayValue}
        </Text>
      </View>
    </View>
  );
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <Card style={styles.sectionCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Toggle ${title}`}
        onPress={onToggle}
        style={styles.sectionHeader}
      >
        <View style={styles.sectionHeaderLeft}>
          <Icon size={16} color={tokens.colors.primaryLight} />
          <Text style={styles.sectionHeaderTitle}>{title}</Text>
        </View>
        {isOpen ? (
          <ChevronUp size={18} color={tokens.colors.textSubtle} />
        ) : (
          <ChevronDown size={18} color={tokens.colors.textSubtle} />
        )}
      </Pressable>
      {isOpen ? <View style={styles.sectionBody}>{children}</View> : null}
    </Card>
  );
}

const LANGUAGES: Language[] = [
  'English',
  'Hindi',
  'Urdu',
  'HindiRoman',
  'UrduRoman',
];

const POSITIONS = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'center',
] as const;

const ANIMATION_PRESETS = [
  'None',
  'SlowZoomIn',
  'SlowZoomOut',
  'PanLeft',
  'PanRight',
  'PanUp',
  'PanDown',
] as const;

export default function ContentProfileDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // Mode & Dialog state
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Collapsible section state for read-only view
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    branding: false,
    watermark: false,
    caption: false,
    hashtag: false,
    music: false,
    background: false,
    rendering: false,
    validation: false,
  });

  // Collapsible section state for edit view
  const [expandedEditSection, setExpandedEditSection] = useState<string | null>('branding');

  // Form field state (Basic)
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ContentProfileStatus>('Active');
  const [language, setLanguage] = useState<Language>('English');
  const [tone, setTone] = useState('');
  const [writingStyle, setWritingStyle] = useState('');
  const [contentTypeId, setContentTypeId] = useState('');
  const [promptVersionId, setPromptVersionId] = useState('');
  const [templateVersionId, setTemplateVersionId] = useState('');

  // Form field state (Branding)
  const [brandingText, setBrandingText] = useState('');
  const [brandingPosition, setBrandingPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'>('bottom-right');
  const [brandingColor, setBrandingColor] = useState('#ffffff');
  const [brandingOpacity, setBrandingOpacity] = useState('0.8');

  // Form field state (Watermark)
  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkPosition, setWatermarkPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'>('bottom-left');
  const [watermarkOpacity, setWatermarkOpacity] = useState('0.5');

  // Form field state (Caption)
  const [captionTemplate, setCaptionTemplate] = useState('');
  const [captionPrefix, setCaptionPrefix] = useState('');
  const [captionSuffix, setCaptionSuffix] = useState('');

  // Form field state (Hashtag)
  const [hashtagTags, setHashtagTags] = useState('');
  const [hashtagMode, setHashtagMode] = useState<'append' | 'prepend' | 'replace' | 'none'>('append');

  // Form field state (Music)
  const [musicMood, setMusicMood] = useState('');
  const [musicGenre, setMusicGenre] = useState('');
  const [musicTempo, setMusicTempo] = useState('');
  const [musicMinDuration, setMusicMinDuration] = useState('');
  const [musicMaxDuration, setMusicMaxDuration] = useState('');

  // Form field state (Background)
  const [bgSelectionMode, setBgSelectionMode] = useState<'Manual' | 'AI'>('AI');
  const [bgManualAssetId, setBgManualAssetId] = useState('');
  const [bgMood, setBgMood] = useState('');
  const [bgStyle, setBgStyle] = useState('');
  const [bgTheme, setBgTheme] = useState('');
  const [bgTags, setBgTags] = useState('');
  const [bgOrientation, setBgOrientation] = useState<'portrait' | 'landscape' | 'square'>('portrait');

  // Form field state (Rendering)
  const [animationPreset, setAnimationPreset] = useState<(typeof ANIMATION_PRESETS)[number]>('SlowZoomIn');

  // Form field state (Validation)
  const [bannedWords, setBannedWords] = useState('');
  const [minLength, setMinLength] = useState('10');
  const [maxLength, setMaxLength] = useState('280');
  const [strictProfanity, setStrictProfanity] = useState(true);

  // Form validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Query hooks
  const {
    data: profile,
    isLoading: isProfileLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useContentProfileDetailQuery(id);

  const { data: readiness, refetch: refetchReadiness } = useContentProfileReadinessQuery(id);
  const { data: contentTypes = [] } = useContentTypesQuery();
  const { data: prompts = [] } = usePromptsQuery();
  const { data: templates = [] } = useTemplatesQuery();

  // Mutation hooks
  const updateMutation = useUpdateContentProfileMutation();
  const dryRunMutation = useDryRunProfileMutation();
  const deleteMutation = useDeleteContentProfileMutation();

  const populateFromProfile = (p: ContentProfile) => {
    setName(p.name || '');
    setNotes(p.notes || '');
    setStatus(p.status || 'Active');
    setLanguage(p.language || 'English');
    setTone(p.tone || '');
    setWritingStyle(p.writingStyle || '');
    setContentTypeId(p.contentTypeId || '');
    setPromptVersionId(p.promptVersionId || '');
    setTemplateVersionId(p.templateVersionId || '');

    const branding = p.brandingRules || {};
    setBrandingText(branding.text || '');
    setBrandingPosition(branding.position || 'bottom-right');
    setBrandingColor(branding.color || '#ffffff');
    setBrandingOpacity(branding.opacity !== undefined ? String(branding.opacity) : '0.8');

    const watermark = p.watermarkRules || {};
    setWatermarkText(watermark.text || '');
    setWatermarkPosition(watermark.position || 'bottom-left');
    setWatermarkOpacity(watermark.opacity !== undefined ? String(watermark.opacity) : '0.5');

    const caption = p.captionStrategy || {};
    setCaptionTemplate(caption.template || '');
    setCaptionPrefix(caption.prefix || '');
    setCaptionSuffix(caption.suffix || '');

    const hashtag = p.hashtagStrategy || {};
    setHashtagTags(Array.isArray(hashtag.tags) ? hashtag.tags.join(', ') : '');
    setHashtagMode(hashtag.mode || 'append');

    const music = p.musicSelectionRules || {};
    setMusicMood(music.mood || '');
    setMusicGenre(music.genre || '');
    setMusicTempo(music.tempo || '');
    setMusicMinDuration(
      music.minDurationSeconds !== undefined ? String(music.minDurationSeconds) : ''
    );
    setMusicMaxDuration(
      music.maxDurationSeconds !== undefined ? String(music.maxDurationSeconds) : ''
    );

    const bg = p.backgroundSelectionRules || {};
    setBgSelectionMode(bg.selectionMode || 'AI');
    setBgManualAssetId(bg.manualAssetId || '');
    setBgMood(bg.mood || '');
    setBgStyle(bg.style || '');
    setBgTheme(bg.theme || '');
    setBgTags(Array.isArray(bg.tags) ? bg.tags.join(', ') : '');
    setBgOrientation(bg.orientation || 'portrait');

    const rendering = p.renderingConfiguration || {};
    setAnimationPreset(rendering.animation?.preset || 'SlowZoomIn');

    const validation = p.validationRules || {};
    setBannedWords(
      Array.isArray(validation.bannedWords) ? validation.bannedWords.join(', ') : ''
    );
    setMinLength(
      validation.minLength !== undefined ? String(validation.minLength) : '10'
    );
    setMaxLength(
      validation.maxLength !== undefined ? String(validation.maxLength) : '280'
    );
    setStrictProfanity(validation.strictProfanity ?? true);
  };

  useEffect(() => {
    if (profile) {
      populateFromProfile(profile);
    }
  }, [profile]);

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const toggleEditSection = (sectionKey: string) => {
    setExpandedEditSection((prev) => (prev === sectionKey ? null : sectionKey));
  };

  const handleRefreshAll = () => {
    refetch();
    refetchReadiness();
  };

  const handleDryRun = () => {
    dryRunMutation.mutate(id, {
      onSuccess: () => {
        router.push('/jobs' as any);
      },
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setIsDeleteDialogOpen(false);
        router.replace('/content-profiles' as any);
      },
    });
  };

  const handleCancelEdit = () => {
    if (profile) {
      populateFromProfile(profile);
    }
    setFormErrors({});
    setIsEditing(false);
  };

  const handleSave = () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Profile name is required';
    if (!tone.trim()) errors.tone = 'Tone is required';
    if (!writingStyle.trim()) errors.writingStyle = 'Writing style is required';
    if (!contentTypeId) errors.contentTypeId = 'Content type is required';
    if (!promptVersionId) errors.promptVersionId = 'Prompt version is required';
    if (!templateVersionId) errors.templateVersionId = 'Template version is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    const payload: Record<string, unknown> = {
      name: name.trim(),
      notes: notes.trim() ? notes.trim() : null,
      status,
      language,
      tone: tone.trim(),
      writingStyle: writingStyle.trim(),
      contentTypeId,
      promptVersionId,
      templateVersionId,
      brandingRules: {
        text: brandingText.trim() || undefined,
        position: brandingPosition,
        color: brandingColor.trim() || undefined,
        opacity: brandingOpacity !== '' ? parseFloat(brandingOpacity) : undefined,
      },
      watermarkRules: {
        text: watermarkText.trim() || undefined,
        position: watermarkPosition,
        opacity: watermarkOpacity !== '' ? parseFloat(watermarkOpacity) : undefined,
      },
      captionStrategy: {
        template: captionTemplate.trim() || undefined,
        prefix: captionPrefix.trim() || undefined,
        suffix: captionSuffix.trim() || undefined,
      },
      hashtagStrategy: {
        tags: hashtagTags
          ? hashtagTags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        mode: hashtagMode,
      },
      musicSelectionRules: {
        mood: musicMood.trim() || undefined,
        genre: musicGenre.trim() || undefined,
        tempo: musicTempo.trim() || undefined,
        minDurationSeconds:
          musicMinDuration !== '' ? parseInt(musicMinDuration, 10) : undefined,
        maxDurationSeconds:
          musicMaxDuration !== '' ? parseInt(musicMaxDuration, 10) : undefined,
      },
      backgroundSelectionRules: {
        selectionMode: bgSelectionMode,
        manualAssetId:
          bgSelectionMode === 'Manual' && bgManualAssetId.trim()
            ? bgManualAssetId.trim()
            : undefined,
        mood: bgMood.trim() || undefined,
        style: bgStyle.trim() || undefined,
        theme: bgTheme.trim() || undefined,
        tags: bgTags
          ? bgTags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        orientation: bgOrientation,
      },
      renderingConfiguration: {
        animation: {
          preset: animationPreset,
        },
      },
      validationRules: {
        bannedWords: bannedWords
          ? bannedWords.split(',').map((w) => w.trim()).filter(Boolean)
          : [],
        minLength: minLength !== '' ? parseInt(minLength, 10) : undefined,
        maxLength: maxLength !== '' ? parseInt(maxLength, 10) : undefined,
        strictProfanity,
      },
    };

    updateMutation.mutate(
      { id, params: payload },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
      }
    );
  };

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <ErrorState
          title="Failed to load content profile"
          message={(error as any)?.message}
          onRetry={handleRefreshAll}
          onRefresh={handleRefreshAll}
        />
      </View>
    );
  }

  if (isProfileLoading || !profile) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card style={styles.skeletonCard}>
          <Skeleton width={180} height={20} />
          <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
          <View style={[styles.rowBetween, { marginTop: 16 }]}>
            <Skeleton width={90} height={24} borderRadius={tokens.radius.pill} />
            <Skeleton width={120} height={32} borderRadius={tokens.radius.button} />
          </View>
        </Card>
        <Card style={styles.skeletonCard}>
          <Skeleton width={140} height={16} />
          <View style={{ marginTop: 12, gap: 10 }}>
            <Skeleton width="100%" height={14} />
            <Skeleton width="100%" height={14} />
            <Skeleton width="100%" height={14} />
            <Skeleton width="100%" height={14} />
          </View>
        </Card>
        <Card style={styles.skeletonCard}>
          <Skeleton width={160} height={16} />
          <View style={{ marginTop: 12, gap: 10 }}>
            <Skeleton width="100%" height={14} />
            <Skeleton width="80%" height={14} />
          </View>
        </Card>
      </ScrollView>
    );
  }

  const allPromptVersions: { id: string; label: string }[] = [];
  prompts.forEach((p) => {
    (p.versions || []).forEach((v: PromptVersion) => {
      allPromptVersions.push({
        id: v.id,
        label: `${p.name} (v${v.versionNumber})`,
      });
    });
  });

  const allTemplateVersions: { id: string; label: string }[] = [];
  templates.forEach((t) => {
    (t.versions || []).forEach((v: TemplateVersion) => {
      allTemplateVersions.push({
        id: v.id,
        label: `${t.name} (v${v.versionNumber})`,
      });
    });
  });

  const profileStatusBadge = getStatusBadge(profile.status);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={handleRefreshAll}
          tintColor={tokens.colors.primaryLight}
        />
      }
      keyboardShouldPersistTaps="handled"
    >
      {/* Readiness Banner (visible in both modes) */}
      {readiness ? (
        <Card
          style={[
            styles.readinessCard,
            readiness.ready ? styles.readinessCardSuccess : styles.readinessCardWarning,
          ]}
        >
          <View style={styles.readinessHeader}>
            {readiness.ready ? (
              <CheckCircle2 size={18} color={tokens.colors.successLight} />
            ) : (
              <AlertTriangle size={18} color={tokens.colors.warningLight} />
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.readinessTitle,
                  readiness.ready
                    ? styles.readinessTextSuccess
                    : styles.readinessTextWarning,
                ]}
              >
                {readiness.ready
                  ? 'Ready for Pipeline Generation'
                  : `${readiness.missing.length} Missing Configuration ${
                      readiness.missing.length === 1 ? 'Item' : 'Items'
                    }`}
              </Text>
              {!readiness.ready ? (
                <Text style={styles.readinessSubtitle}>
                  Resolve configuration warnings before initiating content generation.
                </Text>
              ) : null}
            </View>
            <Badge
              label={readiness.ready ? 'Ready' : 'Incomplete'}
              variant={readiness.ready ? 'success' : 'warning'}
              size="sm"
            />
          </View>
          {!readiness.ready && readiness.missing && readiness.missing.length > 0 ? (
            <View style={styles.missingList}>
              {readiness.missing.map((item, idx) => (
                <View key={idx} style={styles.missingItemRow}>
                  <Text style={styles.missingItemBullet}>•</Text>
                  <Text style={styles.missingItemText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* READ-ONLY VIEW */}
      {!isEditing ? (
        <>
          {/* Header & Overview Card */}
          <Card style={styles.overviewCard}>
            <View style={styles.rowBetween}>
              <View style={styles.titleWrap}>
                <Text style={styles.profileTitle}>{profile.name}</Text>
                <Badge
                  label={profileStatusBadge.label}
                  variant={profileStatusBadge.variant}
                  size="md"
                />
              </View>
            </View>

            {profile.notes ? (
              <Text style={styles.profileNotes}>{profile.notes}</Text>
            ) : null}

            {/* Timestamps */}
            <View style={styles.timestampRow}>
              <View style={styles.timestampItem}>
                <Calendar size={13} color={tokens.colors.textSubtle} />
                <Text style={styles.timestampText}>
                  Created: {formatDateTime(profile.createdAt)}
                </Text>
              </View>
              <View style={styles.timestampItem}>
                <Clock size={13} color={tokens.colors.textSubtle} />
                <Text style={styles.timestampText}>
                  Updated: {formatDateTime(profile.updatedAt)}
                </Text>
              </View>
            </View>

            {/* Action Bar */}
            <View style={styles.actionRow}>
              <Button
                variant="primary"
                size="sm"
                icon={Edit}
                onPress={() => setIsEditing(true)}
              >
                Edit Profile
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={Play}
                isLoading={dryRunMutation.isPending}
                loadingText="Running..."
                onPress={handleDryRun}
              >
                Dry Run
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                textStyle={{ color: tokens.colors.destructiveLight }}
                onPress={() => setIsDeleteDialogOpen(true)}
              >
                Delete
              </Button>
            </View>
          </Card>

          {/* Core Configuration Card */}
          <Card style={styles.coreConfigCard}>
            <Text style={styles.cardHeaderTitle}>Core Configuration</Text>
            <View style={styles.rowsWrapper}>
              <ReadOnlyRow label="Target Language" value={profile.language} />
              <ReadOnlyRow label="Tone" value={profile.tone} />
              <ReadOnlyRow label="Writing Style" value={profile.writingStyle} />
              <ReadOnlyRow
                label="Content Type"
                value={profile.contentType?.name || profile.contentTypeId}
              />
              <ReadOnlyRow
                label="Prompt Version"
                value={
                  profile.promptVersion
                    ? `${profile.promptVersion.prompt?.name || 'Prompt'} (v${profile.promptVersion.versionNumber})`
                    : profile.promptVersionId
                }
              />
              <ReadOnlyRow
                label="Template Version"
                value={
                  profile.templateVersion
                    ? `${profile.templateVersion.template?.name || 'Template'} (v${profile.templateVersion.versionNumber})`
                    : profile.templateVersionId
                }
              />
            </View>
          </Card>

          {/* Sub-object collapsible sections */}
          <View style={styles.sectionsList}>
            {/* 1. Branding Rules */}
            <CollapsibleSection
              title="Branding Rules"
              icon={Sparkles}
              isOpen={!collapsedSections.branding}
              onToggle={() => toggleSection('branding')}
            >
              <ReadOnlyRow
                label="Branding Text"
                value={profile.brandingRules?.text || 'None'}
              />
              <ReadOnlyRow
                label="Position"
                value={profile.brandingRules?.position || 'bottom-right'}
              />
              <ReadOnlyRow
                label="Color"
                value={profile.brandingRules?.color || '#ffffff'}
                colorSwatch={profile.brandingRules?.color || '#ffffff'}
              />
              <ReadOnlyRow
                label="Opacity"
                value={
                  profile.brandingRules?.opacity !== undefined
                    ? `${Math.round(profile.brandingRules.opacity * 100)}% (${profile.brandingRules.opacity})`
                    : '80% (0.8)'
                }
              />
            </CollapsibleSection>

            {/* 2. Watermark Rules */}
            <CollapsibleSection
              title="Watermark Rules"
              icon={Shield}
              isOpen={!collapsedSections.watermark}
              onToggle={() => toggleSection('watermark')}
            >
              <ReadOnlyRow
                label="Watermark Text"
                value={profile.watermarkRules?.text || 'None'}
              />
              <ReadOnlyRow
                label="Position"
                value={profile.watermarkRules?.position || 'bottom-left'}
              />
              <ReadOnlyRow
                label="Opacity"
                value={
                  profile.watermarkRules?.opacity !== undefined
                    ? `${Math.round(profile.watermarkRules.opacity * 100)}% (${profile.watermarkRules.opacity})`
                    : '50% (0.5)'
                }
              />
            </CollapsibleSection>

            {/* 3. Caption Strategy */}
            <CollapsibleSection
              title="Caption Strategy"
              icon={FileText}
              isOpen={!collapsedSections.caption}
              onToggle={() => toggleSection('caption')}
            >
              <ReadOnlyRow
                label="Caption Template"
                value={profile.captionStrategy?.template || 'None'}
              />
              <ReadOnlyRow
                label="Prefix"
                value={profile.captionStrategy?.prefix || 'None'}
              />
              <ReadOnlyRow
                label="Suffix"
                value={profile.captionStrategy?.suffix || 'None'}
              />
            </CollapsibleSection>

            {/* 4. Hashtag Strategy */}
            <CollapsibleSection
              title="Hashtag Strategy"
              icon={Layers}
              isOpen={!collapsedSections.hashtag}
              onToggle={() => toggleSection('hashtag')}
            >
              <ReadOnlyRow
                label="Strategy Mode"
                value={profile.hashtagStrategy?.mode || 'append'}
              />
              <ReadOnlyRow
                label="Tags"
                value={
                  Array.isArray(profile.hashtagStrategy?.tags) &&
                  profile.hashtagStrategy.tags.length > 0
                    ? profile.hashtagStrategy.tags.join(', ')
                    : 'None'
                }
              />
            </CollapsibleSection>

            {/* 5. Music Selection Rules */}
            <CollapsibleSection
              title="Music Selection Rules"
              icon={Music}
              isOpen={!collapsedSections.music}
              onToggle={() => toggleSection('music')}
            >
              <ReadOnlyRow
                label="Mood"
                value={profile.musicSelectionRules?.mood || 'Any'}
              />
              <ReadOnlyRow
                label="Genre"
                value={profile.musicSelectionRules?.genre || 'Any'}
              />
              <ReadOnlyRow
                label="Tempo"
                value={profile.musicSelectionRules?.tempo || 'Any'}
              />
              <ReadOnlyRow
                label="Duration Bounds"
                value={`${profile.musicSelectionRules?.minDurationSeconds ?? 0}s – ${
                  profile.musicSelectionRules?.maxDurationSeconds ?? 'Unlimited'
                }s`}
              />
            </CollapsibleSection>

            {/* 6. Background Selection Rules */}
            <CollapsibleSection
              title="Background Selection Rules"
              icon={ImageIcon}
              isOpen={!collapsedSections.background}
              onToggle={() => toggleSection('background')}
            >
              <ReadOnlyRow
                label="Selection Mode"
                value={profile.backgroundSelectionRules?.selectionMode || 'AI'}
              />
              {profile.backgroundSelectionRules?.selectionMode === 'Manual' ? (
                <ReadOnlyRow
                  label="Manual Asset ID"
                  value={profile.backgroundSelectionRules?.manualAssetId || 'None'}
                  isCode
                />
              ) : null}
              <ReadOnlyRow
                label="Mood"
                value={profile.backgroundSelectionRules?.mood || 'Any'}
              />
              <ReadOnlyRow
                label="Style"
                value={profile.backgroundSelectionRules?.style || 'Any'}
              />
              <ReadOnlyRow
                label="Theme"
                value={profile.backgroundSelectionRules?.theme || 'Any'}
              />
              <ReadOnlyRow
                label="Tags"
                value={
                  Array.isArray(profile.backgroundSelectionRules?.tags) &&
                  profile.backgroundSelectionRules.tags.length > 0
                    ? profile.backgroundSelectionRules.tags.join(', ')
                    : 'None'
                }
              />
              <ReadOnlyRow
                label="Orientation"
                value={profile.backgroundSelectionRules?.orientation || 'portrait'}
              />
            </CollapsibleSection>

            {/* 7. Rendering Configuration */}
            <CollapsibleSection
              title="Rendering Configuration"
              icon={Video}
              isOpen={!collapsedSections.rendering}
              onToggle={() => toggleSection('rendering')}
            >
              <ReadOnlyRow
                label="Animation Preset"
                value={
                  profile.renderingConfiguration?.animation?.preset || 'SlowZoomIn'
                }
              />
            </CollapsibleSection>

            {/* 8. Validation Rules */}
            <CollapsibleSection
              title="Validation & Quality Rules"
              icon={AlertTriangle}
              isOpen={!collapsedSections.validation}
              onToggle={() => toggleSection('validation')}
            >
              <ReadOnlyRow
                label="Strict Profanity Filter"
                value={
                  profile.validationRules?.strictProfanity ? 'Enabled' : 'Disabled'
                }
              />
              <ReadOnlyRow
                label="Min Text Length"
                value={`${profile.validationRules?.minLength ?? 10} characters`}
              />
              <ReadOnlyRow
                label="Max Text Length"
                value={`${profile.validationRules?.maxLength ?? 280} characters`}
              />
              <ReadOnlyRow
                label="Banned Words"
                value={
                  Array.isArray(profile.validationRules?.bannedWords) &&
                  profile.validationRules.bannedWords.length > 0
                    ? profile.validationRules.bannedWords.join(', ')
                    : 'None'
                }
              />
            </CollapsibleSection>
          </View>
        </>
      ) : (
        /* EDIT VIEW */
        <Card style={styles.formCard}>
          {/* Edit Header */}
          <View style={styles.editHeaderRow}>
            <View>
              <Text style={styles.editModeTitle}>Edit Content Profile</Text>
              <Text style={styles.editModeSubtitle}>
                Update profile parameters and pipeline rules
              </Text>
            </View>
            <View style={styles.editHeaderButtons}>
              <Button
                variant="outline"
                size="sm"
                icon={X}
                onPress={handleCancelEdit}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Save}
                isLoading={updateMutation.isPending}
                loadingText="Saving..."
                onPress={handleSave}
              >
                Save
              </Button>
            </View>
          </View>

          {/* Profile Name */}
          <Field
            label="Profile Name"
            value={name}
            onChangeText={setName}
            error={formErrors.name}
            required
            placeholder="e.g. Daily Inspiration Shorts"
          />

          {/* Notes */}
          <Field
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="Operational notes or channel target description"
          />

          {/* Status */}
          <View style={styles.inputGroupArea}>
            <Text style={styles.groupLabel}>Status</Text>
            <SegmentedControl<ContentProfileStatus>
              options={[
                { id: 'Active', label: 'Active' },
                { id: 'Disabled', label: 'Disabled' },
              ]}
              selectedId={status}
              onChange={setStatus}
            />
          </View>

          {/* Language Selector */}
          <View style={styles.inputGroupArea}>
            <Text style={styles.groupLabel}>Target Language</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerRow}
            >
              {LANGUAGES.map((lang) => {
                const isSelected = language === lang;
                return (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setLanguage(lang)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextSelected,
                      ]}
                    >
                      {lang}
                    </Text>
                    {isSelected ? <Check size={14} color="#fff" /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Tone & Style */}
          <View style={styles.twoColumnRow}>
            <View style={{ flex: 1 }}>
              <Field
                label="Tone"
                value={tone}
                onChangeText={setTone}
                error={formErrors.tone}
                required
                placeholder="Inspiring, Witty"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Writing Style"
                value={writingStyle}
                onChangeText={setWritingStyle}
                error={formErrors.writingStyle}
                required
                placeholder="Direct, Punchy"
              />
            </View>
          </View>

          {/* Content Type Picker */}
          <View style={styles.inputGroupArea}>
            <Text style={styles.groupLabel}>
              Content Type <Text style={styles.asterisk}>*</Text>
            </Text>
            {formErrors.contentTypeId ? (
              <Text style={styles.fieldErrorText}>{formErrors.contentTypeId}</Text>
            ) : null}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerRow}
            >
              {contentTypes.map((t) => {
                const isSelected = contentTypeId === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setContentTypeId(t.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextSelected,
                      ]}
                    >
                      {t.name}
                    </Text>
                    {isSelected ? <Check size={14} color="#fff" /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Prompt Version Picker */}
          <View style={styles.inputGroupArea}>
            <Text style={styles.groupLabel}>
              Prompt Version <Text style={styles.asterisk}>*</Text>
            </Text>
            {formErrors.promptVersionId ? (
              <Text style={styles.fieldErrorText}>{formErrors.promptVersionId}</Text>
            ) : null}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerRow}
            >
              {allPromptVersions.map((pv) => {
                const isSelected = promptVersionId === pv.id;
                return (
                  <TouchableOpacity
                    key={pv.id}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setPromptVersionId(pv.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextSelected,
                      ]}
                    >
                      {pv.label}
                    </Text>
                    {isSelected ? <Check size={14} color="#fff" /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Template Version Picker */}
          <View style={styles.inputGroupArea}>
            <Text style={styles.groupLabel}>
              Template Version <Text style={styles.asterisk}>*</Text>
            </Text>
            {formErrors.templateVersionId ? (
              <Text style={styles.fieldErrorText}>{formErrors.templateVersionId}</Text>
            ) : null}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerRow}
            >
              {allTemplateVersions.map((tv) => {
                const isSelected = templateVersionId === tv.id;
                return (
                  <TouchableOpacity
                    key={tv.id}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setTemplateVersionId(tv.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextSelected,
                      ]}
                    >
                      {tv.label}
                    </Text>
                    {isSelected ? <Check size={14} color="#fff" /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Collapsible Edit Sections */}
          <View style={styles.editSectionsContainer}>
            {/* 1. Branding & Watermark */}
            <View style={styles.accordionBox}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => toggleEditSection('branding')}
              >
                <View style={styles.accordionHeaderTitleWrap}>
                  <Sparkles size={16} color={tokens.colors.primaryLight} />
                  <Text style={styles.accordionTitle}>Branding & Watermark Rules</Text>
                </View>
                {expandedEditSection === 'branding' ? (
                  <ChevronUp size={18} color={tokens.colors.textSubtle} />
                ) : (
                  <ChevronDown size={18} color={tokens.colors.textSubtle} />
                )}
              </TouchableOpacity>
              {expandedEditSection === 'branding' ? (
                <View style={styles.accordionBody}>
                  <Field
                    label="Branding Text"
                    value={brandingText}
                    onChangeText={setBrandingText}
                    placeholder="e.g. @PublishIQ"
                  />
                  <View style={styles.inputGroupArea}>
                    <Text style={styles.groupLabel}>Branding Position</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.pickerRow}
                    >
                      {POSITIONS.map((pos) => (
                        <TouchableOpacity
                          key={pos}
                          style={[
                            styles.chip,
                            brandingPosition === pos && styles.chipSelected,
                          ]}
                          onPress={() => setBrandingPosition(pos)}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              brandingPosition === pos && styles.chipTextSelected,
                            ]}
                          >
                            {pos}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  <View style={styles.twoColumnRow}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Branding Color"
                        value={brandingColor}
                        onChangeText={setBrandingColor}
                        placeholder="#ffffff"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Branding Opacity (0.0 - 1.0)"
                        value={brandingOpacity}
                        onChangeText={setBrandingOpacity}
                        keyboardType="decimal-pad"
                        placeholder="0.8"
                      />
                    </View>
                  </View>

                  <Field
                    label="Watermark Text"
                    value={watermarkText}
                    onChangeText={setWatermarkText}
                    placeholder="Optional watermark text"
                  />
                  <View style={styles.inputGroupArea}>
                    <Text style={styles.groupLabel}>Watermark Position</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.pickerRow}
                    >
                      {POSITIONS.map((pos) => (
                        <TouchableOpacity
                          key={pos}
                          style={[
                            styles.chip,
                            watermarkPosition === pos && styles.chipSelected,
                          ]}
                          onPress={() => setWatermarkPosition(pos)}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              watermarkPosition === pos && styles.chipTextSelected,
                            ]}
                          >
                            {pos}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  <Field
                    label="Watermark Opacity (0.0 - 1.0)"
                    value={watermarkOpacity}
                    onChangeText={setWatermarkOpacity}
                    keyboardType="decimal-pad"
                    placeholder="0.5"
                  />
                </View>
              ) : null}
            </View>

            {/* 2. Caption & Hashtag Strategy */}
            <View style={styles.accordionBox}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => toggleEditSection('caption')}
              >
                <View style={styles.accordionHeaderTitleWrap}>
                  <FileText size={16} color={tokens.colors.primaryLight} />
                  <Text style={styles.accordionTitle}>Caption & Hashtags Strategy</Text>
                </View>
                {expandedEditSection === 'caption' ? (
                  <ChevronUp size={18} color={tokens.colors.textSubtle} />
                ) : (
                  <ChevronDown size={18} color={tokens.colors.textSubtle} />
                )}
              </TouchableOpacity>
              {expandedEditSection === 'caption' ? (
                <View style={styles.accordionBody}>
                  <Field
                    label="Caption Template"
                    value={captionTemplate}
                    onChangeText={setCaptionTemplate}
                    placeholder="{{quote}} — {{author}}"
                  />
                  <View style={styles.twoColumnRow}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Prefix"
                        value={captionPrefix}
                        onChangeText={setCaptionPrefix}
                        placeholder="Daily Motivation: "
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Suffix"
                        value={captionSuffix}
                        onChangeText={setCaptionSuffix}
                        placeholder=" #motivation"
                      />
                    </View>
                  </View>
                  <Field
                    label="Default Hashtags (comma-separated)"
                    value={hashtagTags}
                    onChangeText={setHashtagTags}
                    placeholder="quotes, motivation, inspiration"
                  />
                  <View style={styles.inputGroupArea}>
                    <Text style={styles.groupLabel}>Hashtag Placement Mode</Text>
                    <SegmentedControl<'append' | 'prepend' | 'replace' | 'none'>
                      options={[
                        { id: 'append', label: 'Append' },
                        { id: 'prepend', label: 'Prepend' },
                        { id: 'replace', label: 'Replace' },
                        { id: 'none', label: 'None' },
                      ]}
                      selectedId={hashtagMode}
                      onChange={setHashtagMode}
                    />
                  </View>
                </View>
              ) : null}
            </View>

            {/* 3. Music Selection Rules */}
            <View style={styles.accordionBox}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => toggleEditSection('music')}
              >
                <View style={styles.accordionHeaderTitleWrap}>
                  <Music size={16} color={tokens.colors.primaryLight} />
                  <Text style={styles.accordionTitle}>Music Selection Rules</Text>
                </View>
                {expandedEditSection === 'music' ? (
                  <ChevronUp size={18} color={tokens.colors.textSubtle} />
                ) : (
                  <ChevronDown size={18} color={tokens.colors.textSubtle} />
                )}
              </TouchableOpacity>
              {expandedEditSection === 'music' ? (
                <View style={styles.accordionBody}>
                  <Field
                    label="Music Mood"
                    value={musicMood}
                    onChangeText={setMusicMood}
                    placeholder="Inspirational, Chill, Energetic"
                  />
                  <View style={styles.twoColumnRow}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Genre"
                        value={musicGenre}
                        onChangeText={setMusicGenre}
                        placeholder="Ambient, Lo-Fi"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Tempo"
                        value={musicTempo}
                        onChangeText={setMusicTempo}
                        placeholder="Slow, Medium, Fast"
                      />
                    </View>
                  </View>
                  <View style={styles.twoColumnRow}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Min Duration (sec)"
                        value={musicMinDuration}
                        onChangeText={setMusicMinDuration}
                        keyboardType="number-pad"
                        placeholder="15"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Max Duration (sec)"
                        value={musicMaxDuration}
                        onChangeText={setMusicMaxDuration}
                        keyboardType="number-pad"
                        placeholder="60"
                      />
                    </View>
                  </View>
                </View>
              ) : null}
            </View>

            {/* 4. Background Selection Rules */}
            <View style={styles.accordionBox}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => toggleEditSection('background')}
              >
                <View style={styles.accordionHeaderTitleWrap}>
                  <ImageIcon size={16} color={tokens.colors.primaryLight} />
                  <Text style={styles.accordionTitle}>Background Selection Rules</Text>
                </View>
                {expandedEditSection === 'background' ? (
                  <ChevronUp size={18} color={tokens.colors.textSubtle} />
                ) : (
                  <ChevronDown size={18} color={tokens.colors.textSubtle} />
                )}
              </TouchableOpacity>
              {expandedEditSection === 'background' ? (
                <View style={styles.accordionBody}>
                  <View style={styles.inputGroupArea}>
                    <Text style={styles.groupLabel}>Selection Mode</Text>
                    <SegmentedControl<'Manual' | 'AI'>
                      options={[
                        { id: 'AI', label: 'AI Selected' },
                        { id: 'Manual', label: 'Manual Asset' },
                      ]}
                      selectedId={bgSelectionMode}
                      onChange={setBgSelectionMode}
                    />
                  </View>
                  {bgSelectionMode === 'Manual' ? (
                    <Field
                      label="Manual Asset UUID"
                      value={bgManualAssetId}
                      onChangeText={setBgManualAssetId}
                      monospace
                      placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                    />
                  ) : null}
                  <View style={styles.twoColumnRow}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Background Mood"
                        value={bgMood}
                        onChangeText={setBgMood}
                        placeholder="Peaceful, Dark, Cinematic"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Style"
                        value={bgStyle}
                        onChangeText={setBgStyle}
                        placeholder="Minimalist, Abstract"
                      />
                    </View>
                  </View>
                  <Field
                    label="Theme"
                    value={bgTheme}
                    onChangeText={setBgTheme}
                    placeholder="Nature, Space, Cityscape"
                  />
                  <Field
                    label="Tags (comma-separated)"
                    value={bgTags}
                    onChangeText={setBgTags}
                    placeholder="clouds, ocean, mountains"
                  />
                  <View style={styles.inputGroupArea}>
                    <Text style={styles.groupLabel}>Orientation</Text>
                    <SegmentedControl<'portrait' | 'landscape' | 'square'>
                      options={[
                        { id: 'portrait', label: 'Portrait' },
                        { id: 'landscape', label: 'Landscape' },
                        { id: 'square', label: 'Square' },
                      ]}
                      selectedId={bgOrientation}
                      onChange={setBgOrientation}
                    />
                  </View>
                </View>
              ) : null}
            </View>

            {/* 5. Rendering & Animation */}
            <View style={styles.accordionBox}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => toggleEditSection('rendering')}
              >
                <View style={styles.accordionHeaderTitleWrap}>
                  <Video size={16} color={tokens.colors.primaryLight} />
                  <Text style={styles.accordionTitle}>Rendering & Animation</Text>
                </View>
                {expandedEditSection === 'rendering' ? (
                  <ChevronUp size={18} color={tokens.colors.textSubtle} />
                ) : (
                  <ChevronDown size={18} color={tokens.colors.textSubtle} />
                )}
              </TouchableOpacity>
              {expandedEditSection === 'rendering' ? (
                <View style={styles.accordionBody}>
                  <Text style={styles.groupLabel}>Animation Preset</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.pickerRow}
                  >
                    {ANIMATION_PRESETS.map((preset) => (
                      <TouchableOpacity
                        key={preset}
                        style={[
                          styles.chip,
                          animationPreset === preset && styles.chipSelected,
                        ]}
                        onPress={() => setAnimationPreset(preset)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            animationPreset === preset && styles.chipTextSelected,
                          ]}
                        >
                          {preset}
                        </Text>
                        {animationPreset === preset ? (
                          <Check size={14} color="#fff" />
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            {/* 6. Validation Rules */}
            <View style={styles.accordionBox}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => toggleEditSection('validation')}
              >
                <View style={styles.accordionHeaderTitleWrap}>
                  <AlertTriangle size={16} color={tokens.colors.primaryLight} />
                  <Text style={styles.accordionTitle}>Content Quality & Validation</Text>
                </View>
                {expandedEditSection === 'validation' ? (
                  <ChevronUp size={18} color={tokens.colors.textSubtle} />
                ) : (
                  <ChevronDown size={18} color={tokens.colors.textSubtle} />
                )}
              </TouchableOpacity>
              {expandedEditSection === 'validation' ? (
                <View style={styles.accordionBody}>
                  <Field
                    label="Banned Words (comma-separated)"
                    value={bannedWords}
                    onChangeText={setBannedWords}
                    placeholder="prohibited words or phrases"
                  />
                  <View style={styles.twoColumnRow}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Min Length (chars)"
                        value={minLength}
                        onChangeText={setMinLength}
                        keyboardType="number-pad"
                        placeholder="10"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Max Length (chars)"
                        value={maxLength}
                        onChangeText={setMaxLength}
                        keyboardType="number-pad"
                        placeholder="280"
                      />
                    </View>
                  </View>
                  <View style={styles.switchRow}>
                    <View style={styles.switchTextWrap}>
                      <Text style={styles.switchTitle}>Strict Profanity Filter</Text>
                      <Text style={styles.switchSubtitle}>
                        Automatically reject generated text containing vulgarities
                      </Text>
                    </View>
                    <Switch
                      value={strictProfanity}
                      onValueChange={setStrictProfanity}
                      trackColor={{
                        false: tokens.colors.surfaceRaised,
                        true: tokens.colors.primary,
                      }}
                      thumbColor="#ffffff"
                    />
                  </View>
                </View>
              ) : null}
            </View>
          </View>

          {/* Bottom Save Action */}
          <Button
            variant="primary"
            size="lg"
            icon={Save}
            isLoading={updateMutation.isPending}
            loadingText="Saving Configuration..."
            onPress={handleSave}
            style={styles.bottomSaveButton}
          >
            Save Configuration
          </Button>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={isDeleteDialogOpen}
        title="Delete Content Profile"
        message={`Are you sure you want to permanently delete "${profile.name}"? Channels referencing this profile will lose their default pipeline generation profile.`}
        confirmLabel="Delete Profile"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bgApp,
  },
  content: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.md,
    paddingBottom: 48,
  },
  errorContainer: {
    flex: 1,
    padding: tokens.spacing.xl,
    justifyContent: 'center',
    backgroundColor: tokens.colors.bgApp,
  },
  skeletonCard: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.sm,
  },
  readinessCard: {
    padding: tokens.spacing.base,
    borderWidth: 1,
    gap: tokens.spacing.sm,
  },
  readinessCardSuccess: {
    backgroundColor: tokens.colors.successBgSubtle,
    borderColor: tokens.colors.successBorderSubtle,
  },
  readinessCardWarning: {
    backgroundColor: tokens.colors.warningBgSubtle,
    borderColor: tokens.colors.warningBorderSubtle,
  },
  readinessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  readinessTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '700',
  },
  readinessSubtitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
    marginTop: 2,
  },
  readinessTextSuccess: {
    color: tokens.colors.successLight,
  },
  readinessTextWarning: {
    color: tokens.colors.warningLight,
  },
  missingList: {
    paddingLeft: 28,
    gap: 4,
    marginTop: 4,
  },
  missingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  missingItemBullet: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.warningLight,
  },
  missingItemText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textPrimary,
  },
  overviewCard: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    gap: 8,
  },
  profileTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.text,
    flex: 1,
  },
  profileNotes: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.textMuted,
    lineHeight: 18,
  },
  timestampRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: tokens.spacing.sm,
  },
  timestampItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timestampText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: tokens.spacing.md,
  },
  coreConfigCard: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.md,
  },
  cardHeaderTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  rowsWrapper: {
    gap: 10,
  },
  readOnlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  readOnlyLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.textMuted,
    width: 140,
  },
  readOnlyValueWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  readOnlyValue: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.textPrimary,
    textAlign: 'right',
  },
  inlineColorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  monospaceText: {
    fontFamily: 'Courier',
    fontSize: 12,
  },
  sectionsList: {
    gap: tokens.spacing.md,
  },
  sectionCard: {
    padding: 0,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.base,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  sectionBody: {
    paddingHorizontal: tokens.spacing.base,
    paddingBottom: tokens.spacing.base,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    gap: 6,
  },
  formCard: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.base,
  },
  editHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    paddingBottom: tokens.spacing.md,
    gap: 8,
  },
  editModeTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  editModeSubtitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
    marginTop: 2,
  },
  editHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputGroupArea: {
    gap: 8,
  },
  groupLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
  },
  asterisk: {
    color: tokens.colors.destructiveLight,
  },
  fieldErrorText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.destructiveLight,
  },
  pickerRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.radius.input,
    backgroundColor: tokens.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  chipSelected: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primaryLight,
  },
  chipText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.textMuted,
  },
  chipTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  editSectionsContainer: {
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
  },
  accordionBox: {
    backgroundColor: tokens.colors.surfaceRaised,
    borderRadius: tokens.radius.input,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
  },
  accordionHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accordionTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  accordionBody: {
    padding: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    gap: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  switchTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  switchTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  switchSubtitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
    marginTop: 2,
  },
  bottomSaveButton: {
    marginTop: tokens.spacing.sm,
  },
});
