import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  Copy,
  RefreshCw,
  Trash2,
  Sparkles,
  AlertTriangle,
  Film,
  ExternalLink,
  Hash,
  Calendar,
  Layers,
  Radio,
  Clock,
  CheckCircle2,
} from 'lucide-react-native';
import { useGeneratedContentDetailQuery } from '../../../hooks/queries/useGeneratedContentDetailQuery';
import { useChannelsQuery } from '../../../hooks/queries/useChannelsQuery';
import {
  useDuplicateContentMutation,
  useRegenerateContentMutation,
  useDeleteContentMutation,
} from '../../../hooks/mutations/useContentMutations';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Sheet } from '../../../components/ui/Sheet';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Skeleton, SkeletonCard } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { formatDateTime, formatRelativeTime, formatMediaUrl } from '../../../lib/format';
import { isRTL, getRTLTextStyle } from '../../../lib/rtl';
import { tokens } from '../../../design/tokens';

export default function GeneratedContentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [isDuplicateSheetOpen, setIsDuplicateSheetOpen] = useState(false);
  const [isRegenerateSheetOpen, setIsRegenerateSheetOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [targetChannelId, setTargetChannelId] = useState<string>('');
  const [imageError, setImageError] = useState(false);

  const { data: channels = [] } = useChannelsQuery();
  const {
    data: content,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useGeneratedContentDetailQuery(id || '');

  const duplicateMutation = useDuplicateContentMutation();
  const regenerateMutation = useRegenerateContentMutation();
  const deleteMutation = useDeleteContentMutation();

  const handleOpenVideoUrl = async (url: string | null) => {
    if (!url) return;
    const fullUrl = formatMediaUrl(url);
    if (fullUrl.startsWith('http://') || fullUrl.startsWith('https://')) {
      const supported = await Linking.canOpenURL(fullUrl);
      if (supported) {
        await Linking.openURL(fullUrl);
      }
    }
  };

  const handleDuplicate = async () => {
    if (!targetChannelId || !content) return;
    try {
      await duplicateMutation.mutateAsync({ id: content.id, channelId: targetChannelId });
      setIsDuplicateSheetOpen(false);
      setTargetChannelId('');
      router.push('/(app)/(tabs)/jobs');
    } catch {}
  };

  const handleRegenerate = async () => {
    if (!targetChannelId || !content) return;
    try {
      await regenerateMutation.mutateAsync({ id: content.id, channelId: targetChannelId });
      setIsRegenerateSheetOpen(false);
      setTargetChannelId('');
      router.push('/(app)/(tabs)/jobs');
    } catch {}
  };

  const handleDelete = async () => {
    if (!content) return;
    try {
      await deleteMutation.mutateAsync(content.id);
      setIsDeleteDialogOpen(false);
      router.back();
    } catch {}
  };

  const formattedHashtags = useMemo(() => {
    if (!content?.hashtags) return null;
    if (Array.isArray(content.hashtags)) {
      return content.hashtags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
    }
    if (typeof content.hashtags === 'object') {
      return Object.values(content.hashtags).map((val) => String(val));
    }
    return [String(content.hashtags)];
  }, [content?.hashtags]);

  if (isError) {
    return (
      <View style={styles.centerContainer}>
        <ErrorState
          title="Failed to load generated content"
          message={(error as any)?.message || 'Unable to retrieve generated content details.'}
          onRetry={refetch}
          onRefresh={refetch}
        />
      </View>
    );
  }

  // Loading: image/video + typography skeleton
  if (isLoading || !content) {
    return (
      <View style={styles.loadingContainer}>
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <Skeleton width={100} height={22} borderRadius={tokens.radius.pill} />
            <Skeleton width={70} height={22} borderRadius={tokens.radius.pill} />
          </View>
          <Skeleton width={160} height={14} style={{ marginTop: 8 }} />
          {/* Typography skeleton */}
          <Skeleton width="100%" height={90} borderRadius={tokens.radius.input} style={{ marginTop: 16 }} />
          <Skeleton width="90%" height={14} style={{ marginTop: 14 }} />
          <Skeleton width="65%" height={14} style={{ marginTop: 8 }} />
          <Skeleton width="40%" height={12} style={{ marginTop: 12 }} />
          <View style={[styles.rowBetween, { marginTop: 16 }]}>
            <Skeleton width={90} height={32} borderRadius={tokens.radius.button} />
            <Skeleton width={90} height={32} borderRadius={tokens.radius.button} />
            <Skeleton width={70} height={32} borderRadius={tokens.radius.button} />
          </View>
        </Card>
        {/* Media skeleton */}
        <Card style={styles.card}>
          <Skeleton width={110} height={16} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={200} borderRadius={tokens.radius.input} />
        </Card>
      </View>
    );
  }

  const isUrduLanguage =
    isRTL(content.language) || /[\u0600-\u06FF]/.test(content.text || '');
  const rtlStyle = isUrduLanguage ? getRTLTextStyle('Urdu') : getRTLTextStyle('English');

  const publishStatusVariant =
    content.publishStatus === 'Published'
      ? 'success'
      : content.publishStatus === 'PublishFailed'
      ? 'danger'
      : 'neutral';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={tokens.colors.primaryLight}
        />
      }
    >
      {/* Primary Details Card */}
      <Card style={styles.card}>
        {/* Header badges: publish status badge, language badge */}
        <View style={styles.rowBetween}>
          <Badge
            label={content.publishStatus || 'Unpublished'}
            variant={publishStatusVariant}
            size="md"
          />
          <Badge label={content.language} variant="primary" size="md" />
        </View>

        <Text style={styles.contentId}>ID: {content.id}</Text>

        {/* Text content (RTL-aware) */}
        <View style={styles.textBox}>
          <Text style={[styles.mainText, rtlStyle]}>"{content.text}"</Text>
        </View>

        {/* Caption */}
        {content.caption ? (
          <View style={styles.captionBox}>
            <Text style={styles.metaLabel}>Caption</Text>
            <Text style={styles.captionText}>{content.caption}</Text>
          </View>
        ) : null}

        {/* Hashtags */}
        {formattedHashtags && formattedHashtags.length > 0 && (
          <View style={styles.hashtagsBox}>
            <View style={styles.hashtagsHeader}>
              <Hash size={13} color={tokens.colors.primaryLight} />
              <Text style={styles.metaLabel}>Hashtags</Text>
            </View>
            <View style={styles.chipsContainer}>
              {formattedHashtags.map((tag, idx) => (
                <View key={`${tag}-${idx}`} style={styles.tagBadge}>
                  <Text style={styles.tagBadgeText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Metadata timestamps */}
        <View style={styles.metaRow}>
          <Clock size={12} color={tokens.colors.textSubtle} />
          <Text style={styles.metaTime}>
            Created {formatDateTime(content.createdAt)} ({formatRelativeTime(content.createdAt)})
          </Text>
        </View>

        {/* Actions: Duplicate, Regenerate, Delete */}
        <View style={styles.actionsRow}>
          <Button
            variant="secondary"
            size="sm"
            icon={Copy}
            onPress={() => {
              setTargetChannelId('');
              setIsDuplicateSheetOpen(true);
            }}
          >
            Duplicate
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onPress={() => {
              setTargetChannelId('');
              setIsRegenerateSheetOpen(true);
            }}
          >
            Regenerate
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

      {/* Media Section: image thumbnail, video link, handle mediaDeletedAt (show "Media Expired" fallback) */}
      {content.mediaDeletedAt ? (
        <Card style={styles.mediaExpiredCard}>
          <View style={styles.mediaExpiredHeader}>
            <AlertTriangle size={18} color={tokens.colors.destructiveLight} />
            <Text style={styles.mediaExpiredTitle}>Media Expired</Text>
          </View>
          <Text style={styles.mediaExpiredMessage}>
            Media assets associated with this content were permanently purged on{' '}
            {formatDateTime(content.mediaDeletedAt)} in accordance with retention policies.
          </Text>
        </Card>
      ) : content.imageUrl || content.videoUrl ? (
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Sparkles size={16} color={tokens.colors.primaryLight} />
            <Text style={styles.sectionTitle}>Visual Media</Text>
          </View>

          {/* Image Thumbnail Preview */}
          {content.imageUrl && (
            <View style={styles.mediaBox}>
              <Text style={styles.metaLabel}>Compiled Image Poster</Text>
              {imageError ? (
                <View style={styles.mediaUnavailable}>
                  <Text style={styles.mediaUnavailableText}>
                    Image preview unavailable
                  </Text>
                </View>
              ) : (
                <Image
                  source={{ uri: formatMediaUrl(content.imageUrl) }}
                  style={styles.imagePreview}
                  contentFit="cover"
                  onError={() => setImageError(true)}
                />
              )}
            </View>
          )}

          {/* Video Link */}
          {content.videoUrl && (
            <View style={styles.mediaBox}>
              <View style={styles.videoHeaderRow}>
                <Film size={14} color={tokens.colors.infoLight} />
                <Text style={styles.metaLabel}>Video Asset Link</Text>
              </View>
              <Pressable
                onPress={() => handleOpenVideoUrl(content.videoUrl)}
                style={styles.videoLinkContainer}
              >
                <Text style={styles.videoUrlText} numberOfLines={2}>
                  {content.videoUrl}
                </Text>
                <ExternalLink size={14} color={tokens.colors.primaryLight} />
              </Pressable>
            </View>
          )}
        </Card>
      ) : null}

      {/* Duplicate Channel Picker Sheet */}
      <Sheet
        visible={isDuplicateSheetOpen}
        onClose={() => setIsDuplicateSheetOpen(false)}
        title="Duplicate Content"
        subtitle="Select a destination channel to re-render this quote into a new pipeline job"
      >
        <View style={styles.sheetContent}>
          <Text style={styles.metaLabel}>Destination Channel *</Text>
          <View style={styles.chipsGrid}>
            {channels.map((ch) => {
              const isSelected = targetChannelId === ch.id;
              return (
                <Pressable
                  key={ch.id}
                  onPress={() => setTargetChannelId(ch.id)}
                  style={[
                    styles.optionChip,
                    isSelected && styles.optionChipSelected,
                  ]}
                >
                  <View style={styles.chipRow}>
                    {isSelected && (
                      <CheckCircle2 size={14} color={tokens.colors.text} style={{ marginRight: 4 }} />
                    )}
                    <Text
                      style={[
                        styles.optionChipText,
                        isSelected && styles.optionChipTextSelected,
                      ]}
                    >
                      {ch.name}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {channels.length === 0 && (
            <Text style={styles.emptyChannelsText}>
              No channels available. Create a channel first.
            </Text>
          )}

          <Button
            variant="primary"
            size="lg"
            disabled={!targetChannelId || duplicateMutation.isPending}
            isLoading={duplicateMutation.isPending}
            loadingText="Duplicating..."
            onPress={handleDuplicate}
            style={{ marginTop: tokens.spacing.xl }}
          >
            Duplicate to Channel
          </Button>
        </View>
      </Sheet>

      {/* Regenerate Channel Picker Sheet */}
      <Sheet
        visible={isRegenerateSheetOpen}
        onClose={() => setIsRegenerateSheetOpen(false)}
        title="Regenerate Content"
        subtitle="Re-run the generation pipeline with fresh prompts and rendering for this channel"
      >
        <View style={styles.sheetContent}>
          <Text style={styles.metaLabel}>Destination Channel *</Text>
          <View style={styles.chipsGrid}>
            {channels.map((ch) => {
              const isSelected = targetChannelId === ch.id;
              return (
                <Pressable
                  key={ch.id}
                  onPress={() => setTargetChannelId(ch.id)}
                  style={[
                    styles.optionChip,
                    isSelected && styles.optionChipSelected,
                  ]}
                >
                  <View style={styles.chipRow}>
                    {isSelected && (
                      <CheckCircle2 size={14} color={tokens.colors.text} style={{ marginRight: 4 }} />
                    )}
                    <Text
                      style={[
                        styles.optionChipText,
                        isSelected && styles.optionChipTextSelected,
                      ]}
                    >
                      {ch.name}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {channels.length === 0 && (
            <Text style={styles.emptyChannelsText}>
              No channels available. Create a channel first.
            </Text>
          )}

          <Button
            variant="primary"
            size="lg"
            disabled={!targetChannelId || regenerateMutation.isPending}
            isLoading={regenerateMutation.isPending}
            loadingText="Regenerating..."
            onPress={handleRegenerate}
            style={{ marginTop: tokens.spacing.xl }}
          >
            Regenerate for Channel
          </Button>
        </View>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={isDeleteDialogOpen}
        title="Delete Generated Content"
        message="Are you sure you want to delete this content item? This action is permanent and cannot be undone."
        confirmLabel="Delete"
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
    paddingBottom: tokens.spacing.xxxl,
  },
  centerContainer: {
    flex: 1,
    padding: tokens.spacing.xl,
    justifyContent: 'center',
    backgroundColor: tokens.colors.bgApp,
  },
  loadingContainer: {
    flex: 1,
    padding: tokens.spacing.base,
    gap: tokens.spacing.md,
    backgroundColor: tokens.colors.bgApp,
  },
  card: {
    padding: tokens.spacing.base,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contentId: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
    color: tokens.colors.textSubtle,
    marginTop: tokens.spacing.xs,
  },
  textBox: {
    backgroundColor: tokens.colors.surfaceRaised,
    padding: tokens.spacing.base,
    borderRadius: tokens.radius.input,
    marginTop: tokens.spacing.base,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  mainText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
    lineHeight: 24,
  },
  captionBox: {
    marginTop: tokens.spacing.md,
  },
  hashtagsBox: {
    marginTop: tokens.spacing.md,
  },
  hashtagsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.xs,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  tagBadge: {
    backgroundColor: tokens.colors.primaryBgSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.primaryBorderSubtle,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xxs,
    borderRadius: tokens.radius.pill,
  },
  tagBadgeText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.primaryLighter,
  },
  metaLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.textSubtle,
    textTransform: 'uppercase',
    marginBottom: tokens.spacing.xxs,
  },
  captionText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.textMuted,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.base,
  },
  metaTime: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.base,
    paddingTop: tokens.spacing.base,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.md,
  },
  sectionTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  mediaBox: {
    marginBottom: tokens.spacing.md,
  },
  imagePreview: {
    width: '100%',
    height: 220,
    borderRadius: tokens.radius.input,
    marginTop: tokens.spacing.xs,
  },
  mediaUnavailable: {
    height: 100,
    backgroundColor: tokens.colors.surfaceRaised,
    borderRadius: tokens.radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing.xs,
  },
  mediaUnavailableText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textSubtle,
  },
  videoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  videoLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceRaised,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.xs,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    marginTop: tokens.spacing.xs,
    gap: tokens.spacing.sm,
  },
  videoUrlText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    color: tokens.colors.infoLight,
    flex: 1,
  },
  mediaExpiredCard: {
    backgroundColor: tokens.colors.destructiveBgSubtle,
    borderColor: tokens.colors.destructiveBorderSubtle,
    padding: tokens.spacing.base,
  },
  mediaExpiredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  mediaExpiredTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.destructiveLight,
  },
  mediaExpiredMessage: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.destructiveText,
    lineHeight: 18,
  },
  sheetContent: {
    paddingBottom: tokens.spacing.xl,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionChip: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.input,
    backgroundColor: tokens.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  optionChipSelected: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primaryLight,
  },
  optionChipText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  optionChipTextSelected: {
    color: tokens.colors.text,
    fontWeight: '600',
  },
  emptyChannelsText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textSubtle,
    marginTop: tokens.spacing.sm,
  },
});
