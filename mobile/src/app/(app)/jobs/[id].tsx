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
  RotateCcw,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  Layers,
  CheckCircle,
  Film,
  ExternalLink,
  Sliders,
  Calendar,
  Info,
  Hash,
  Share2,
} from 'lucide-react-native';
import { useJobDetailQuery } from '../../../hooks/queries/useJobDetailQuery';
import {
  useRetryJobMutation,
  useCancelJobMutation,
} from '../../../hooks/mutations/useJobMutations';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { SkeletonCard, SkeletonRows, Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { getPipelineStageStatus } from '../../../lib/status';
import { formatDateTime, formatRelativeTime, formatMediaUrl } from '../../../lib/format';
import { isRTL, getRTLTextStyle } from '../../../lib/rtl';
import { tokens } from '../../../design/tokens';

const ORDERED_STAGES = [
  'Draft',
  'GeneratingContent',
  'Validating',
  'ResolvingBackground',
  'RenderingImage',
  'AttachingMusic',
  'RenderingVideo',
  'GeneratingCaption',
  'GeneratingHashtags',
  'Queued',
  'Publishing',
  'Completed',
];

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isRetryDialogOpen, setIsRetryDialogOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const {
    data: job,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useJobDetailQuery(id || '');

  const retryMutation = useRetryJobMutation();
  const cancelMutation = useCancelJobMutation();

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

  const handleRetryConfirm = async () => {
    if (!job) return;
    try {
      await retryMutation.mutateAsync(job.id);
      setIsRetryDialogOpen(false);
    } catch {}
  };

  const handleCancelConfirm = async () => {
    if (!job) return;
    try {
      await cancelMutation.mutateAsync(job.id);
      setIsCancelDialogOpen(false);
    } catch {}
  };

  const formattedHashtags = useMemo(() => {
    if (!job?.hashtags) return null;
    if (Array.isArray(job.hashtags)) {
      return job.hashtags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
    }
    if (typeof job.hashtags === 'object') {
      return Object.values(job.hashtags).map((val) => String(val));
    }
    return [String(job.hashtags)];
  }, [job?.hashtags]);

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <ErrorState
          title="Failed to load job details"
          message={(error as any)?.message || 'Unable to retrieve job information.'}
          onRetry={refetch}
          onRefresh={refetch}
        />
      </View>
    );
  }

  if (isLoading || !job) {
    return (
      <View style={styles.loadingContainer}>
        <Card style={styles.skeletonOverview}>
          <View style={styles.rowBetween}>
            <Skeleton width={140} height={20} />
            <Skeleton width={90} height={22} borderRadius={tokens.radius.pill} />
          </View>
          <Skeleton width={180} height={14} style={{ marginTop: 8 }} />
          <View style={[styles.badgesRow, { marginTop: 12 }]}>
            <Skeleton width={80} height={20} borderRadius={tokens.radius.pill} />
            <Skeleton width={70} height={20} borderRadius={tokens.radius.pill} />
          </View>
        </Card>
        <SkeletonRows rows={4} />
        <SkeletonCard />
      </View>
    );
  }

  const stageStatus = getPipelineStageStatus(job.pipelineStage);
  const isUrduLanguage =
    isRTL((job.contentProfile as any)?.language) ||
    /[\u0600-\u06FF]/.test(job.generatedText || '');
  const rtlStyle = isUrduLanguage ? getRTLTextStyle('Urdu') : getRTLTextStyle('English');
  const currentStageIdx = ORDERED_STAGES.indexOf(job.pipelineStage || 'Draft');

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
      {/* Overview Card: channel name, job ID (monospace), pipeline stage badge, job type badge, dry-run badge */}
      <Card style={styles.overviewCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.channelName}>{job.channel?.name || 'Manual Run'}</Text>
          <Badge
            label={stageStatus.label}
            bg={stageStatus.bg}
            border={stageStatus.border}
            textColor={stageStatus.text}
            size="md"
          />
        </View>

        <Text style={styles.jobId}>ID: {job.id}</Text>

        <View style={styles.badgesRow}>
          <Badge label={job.jobType} variant="neutral" size="sm" />
          <Badge
            label={job.isDryRun ? 'Dry Run' : 'Production'}
            variant={job.isDryRun ? 'warning' : 'primary'}
            size="sm"
          />
        </View>

        {/* Actions: Retry button (only if Failed), Cancel button (only if not terminal) */}
        {(stageStatus.isFailed || !stageStatus.isTerminal) && (
          <View style={styles.actionButtonsRow}>
            {stageStatus.isFailed && (
              <Button
                variant="danger"
                size="sm"
                icon={RotateCcw}
                isLoading={retryMutation.isPending}
                loadingText="Retrying..."
                onPress={() => setIsRetryDialogOpen(true)}
              >
                Retry Job
              </Button>
            )}

            {!stageStatus.isTerminal && (
              <Button
                variant="ghost"
                size="sm"
                icon={XCircle}
                isLoading={cancelMutation.isPending}
                loadingText="Cancelling..."
                onPress={() => setIsCancelDialogOpen(true)}
                textStyle={{ color: tokens.colors.destructiveLight }}
              >
                Cancel Job
              </Button>
            )}
          </View>
        )}
      </Card>

      {/* Section 1: Pipeline Progress (stage + status) */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Layers size={16} color={tokens.colors.primaryLight} />
          <Text style={styles.sectionTitle}>Pipeline Progress</Text>
        </View>

        <View style={styles.progressSummary}>
          <Text style={styles.progressSummaryLabel}>Current Stage:</Text>
          <Text style={styles.progressSummaryValue}>
            {job.pipelineStage || 'Draft'}
          </Text>
          <Text style={styles.progressStatusText}>
            ({stageStatus.isRunning ? 'In Progress' : stageStatus.isFailed ? 'Halted on Failure' : stageStatus.isTerminal ? 'Completed' : 'Pending'})
          </Text>
        </View>

        <View style={styles.timelineList}>
          {ORDERED_STAGES.map((st, idx) => {
            const isCompleted = idx < currentStageIdx || (idx === currentStageIdx && stageStatus.isTerminal && !stageStatus.isFailed);
            const isCurrent = idx === currentStageIdx && !isCompleted;
            const isPending = idx > currentStageIdx;

            return (
              <View key={st} style={styles.timelineItem}>
                <View style={styles.timelineIndicator}>
                  {isCompleted ? (
                    <View style={styles.completedDot}>
                      <CheckCircle size={14} color={tokens.colors.successLight} />
                    </View>
                  ) : isCurrent ? (
                    <View
                      style={[
                        styles.currentDot,
                        stageStatus.isFailed && styles.failedDot,
                      ]}
                    />
                  ) : (
                    <View style={styles.pendingDot} />
                  )}
                  {idx < ORDERED_STAGES.length - 1 && <View style={styles.timelineLine} />}
                </View>

                <View style={styles.timelineTextContainer}>
                  <Text
                    style={[
                      styles.stageName,
                      isCurrent && (stageStatus.isFailed ? styles.stageNameFailed : styles.stageNameCurrent),
                      isCompleted && styles.stageNameCompleted,
                      isPending && styles.stageNamePending,
                    ]}
                  >
                    {st}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Section 2: Configuration (channel, profile, type) */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Sliders size={16} color={tokens.colors.primaryLight} />
          <Text style={styles.sectionTitle}>Configuration</Text>
        </View>

        <View style={styles.gridTwoColumns}>
          <View style={styles.gridItem}>
            <Text style={styles.metaLabel}>Channel</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {job.channel?.name || 'Manual Run'}
            </Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.metaLabel}>Content Profile</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {job.contentProfile?.name || job.contentProfileId || 'Default'}
            </Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.metaLabel}>Job Type</Text>
            <Text style={styles.metaValue}>{job.jobType}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.metaLabel}>Execution Mode</Text>
            <Text style={styles.metaValue}>
              {job.isDryRun ? 'Dry Run' : 'Production'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Section 3: Generated Output (text with RTL, image URL, video URL, caption, hashtags) */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Sparkles size={16} color={tokens.colors.primaryLight} />
          <Text style={styles.sectionTitle}>Generated Output</Text>
        </View>

        {job.generatedText || job.imageUrl || job.videoUrl || job.caption || (formattedHashtags && formattedHashtags.length > 0) ? (
          <View style={styles.artifactsContainer}>
            {/* Generated text with RTL */}
            {job.generatedText && (
              <View style={styles.artifactBox}>
                <Text style={styles.artifactLabel}>Generated Text</Text>
                <Text style={[styles.artifactText, rtlStyle]}>
                  "{job.generatedText}"
                </Text>
              </View>
            )}

            {/* Image Preview */}
            {job.imageUrl && (
              <View style={styles.artifactBox}>
                <Text style={styles.artifactLabel}>Compiled Image Poster</Text>
                {imageError ? (
                  <View style={styles.mediaUnavailable}>
                    <Text style={styles.mediaUnavailableText}>
                      Image preview unavailable
                    </Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: formatMediaUrl(job.imageUrl) }}
                    style={styles.mediaImage}
                    contentFit="cover"
                    onError={() => setImageError(true)}
                  />
                )}
              </View>
            )}

            {/* Video URL as info text */}
            {job.videoUrl && (
              <View style={styles.artifactBox}>
                <View style={styles.videoHeaderRow}>
                  <Film size={14} color={tokens.colors.infoLight} />
                  <Text style={styles.artifactLabel}>Video Asset URL</Text>
                </View>
                <Pressable
                  onPress={() => handleOpenVideoUrl(job.videoUrl)}
                  style={styles.urlPressableBox}
                >
                  <Text style={styles.urlMonospaceText} numberOfLines={2}>
                    {job.videoUrl}
                  </Text>
                  <ExternalLink size={14} color={tokens.colors.primaryLight} />
                </Pressable>
              </View>
            )}

            {/* Caption */}
            {job.caption && (
              <View style={styles.artifactBox}>
                <Text style={styles.artifactLabel}>Social Caption</Text>
                <Text style={styles.captionText}>{job.caption}</Text>
              </View>
            )}

            {/* Hashtags */}
            {formattedHashtags && formattedHashtags.length > 0 && (
              <View style={styles.artifactBox}>
                <View style={styles.videoHeaderRow}>
                  <Hash size={14} color={tokens.colors.primaryLight} />
                  <Text style={styles.artifactLabel}>Hashtags</Text>
                </View>
                <View style={styles.tagsContainer}>
                  {formattedHashtags.map((tag, i) => (
                    <View key={`${tag}-${i}`} style={styles.tagChip}>
                      <Text style={styles.tagChipText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyArtifactsBox}>
            <Info size={16} color={tokens.colors.textSubtle} />
            <Text style={styles.emptyArtifactsText}>
              Artifacts will appear as the pipeline executes generation stages.
            </Text>
          </View>
        )}
      </Card>

      {/* Section 4: Failure Info (stage, reason, retryCount) */}
      {(job.failureReason || job.failureStage || stageStatus.isFailed) && (
        <Card style={styles.failureCard}>
          <View style={styles.failureHeader}>
            <AlertTriangle size={18} color={tokens.colors.destructiveLight} />
            <Text style={styles.failureTitle}>
              Failure at {job.failureStage || 'Execution Stage'}
            </Text>
          </View>
          <Text style={styles.failureReason}>
            {job.failureReason || 'An unknown error occurred during pipeline execution.'}
          </Text>

          <View style={styles.failureMetaRow}>
            <View style={styles.failureMetaItem}>
              <Text style={styles.metaLabel}>Retry Count</Text>
              <Text style={styles.failureMetaValue}>{job.retryCount}</Text>
            </View>
            {job.failedAt && (
              <View style={styles.failureMetaItem}>
                <Text style={styles.metaLabel}>Failed At</Text>
                <Text style={styles.failureMetaValue}>{formatDateTime(job.failedAt)}</Text>
              </View>
            )}
          </View>
        </Card>
      )}

      {/* Section 5: Timestamps (created, updated, failed) */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Calendar size={16} color={tokens.colors.primaryLight} />
          <Text style={styles.sectionTitle}>Timestamps</Text>
        </View>

        <View style={styles.timestampsList}>
          <View style={styles.timestampRow}>
            <Text style={styles.timestampLabel}>Created:</Text>
            <Text style={styles.timestampValue}>
              {formatDateTime(job.createdAt)} ({formatRelativeTime(job.createdAt)})
            </Text>
          </View>
          <View style={styles.timestampRow}>
            <Text style={styles.timestampLabel}>Last Updated:</Text>
            <Text style={styles.timestampValue}>
              {formatDateTime(job.updatedAt)} ({formatRelativeTime(job.updatedAt)})
            </Text>
          </View>
          <View style={styles.timestampRow}>
            <Text style={styles.timestampLabel}>Failed At:</Text>
            <Text style={styles.timestampValue}>
              {job.failedAt ? formatDateTime(job.failedAt) : 'None'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Retry Confirmation Dialog */}
      <ConfirmDialog
        visible={isRetryDialogOpen}
        title="Retry Pipeline Job"
        message="Are you sure you want to retry this failed job? It will re-enter the processing queue."
        confirmLabel="Retry Job"
        variant="primary"
        isLoading={retryMutation.isPending}
        onConfirm={handleRetryConfirm}
        onCancel={() => setIsRetryDialogOpen(false)}
      />

      {/* Cancellation Confirmation Dialog */}
      <ConfirmDialog
        visible={isCancelDialogOpen}
        title="Cancel Pipeline Job"
        message="Are you sure you want to cancel this in-progress pipeline job? Ongoing worker tasks will be halted."
        confirmLabel="Cancel Job"
        variant="danger"
        isLoading={cancelMutation.isPending}
        onConfirm={handleCancelConfirm}
        onCancel={() => setIsCancelDialogOpen(false)}
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
  errorContainer: {
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
  skeletonOverview: {
    padding: tokens.spacing.base,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overviewCard: {
    padding: tokens.spacing.base,
  },
  channelName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text,
    flex: 1,
    marginRight: tokens.spacing.sm,
  },
  jobId: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
    color: tokens.colors.textSubtle,
    marginTop: tokens.spacing.xs,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.base,
    paddingTop: tokens.spacing.base,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  sectionCard: {
    padding: tokens.spacing.base,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  sectionTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  progressSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.base,
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  progressSummaryLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textSubtle,
  },
  progressSummaryValue: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.primaryLight,
  },
  progressStatusText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  timelineList: {
    paddingLeft: tokens.spacing.xs,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 34,
  },
  timelineIndicator: {
    width: 20,
    alignItems: 'center',
  },
  completedDot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: tokens.colors.primaryLight,
  },
  failedDot: {
    backgroundColor: tokens.colors.destructiveLight,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.colors.borderStrong,
    marginTop: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: tokens.colors.border,
    marginVertical: 4,
  },
  timelineTextContainer: {
    flex: 1,
    paddingLeft: tokens.spacing.md,
    justifyContent: 'flex-start',
  },
  stageName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
  },
  stageNameCompleted: {
    color: tokens.colors.successLight,
    fontWeight: '600',
  },
  stageNameCurrent: {
    color: tokens.colors.text,
    fontWeight: '700',
  },
  stageNameFailed: {
    color: tokens.colors.destructiveLight,
    fontWeight: '700',
  },
  stageNamePending: {
    color: tokens.colors.textSubtle,
  },
  gridTwoColumns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.md,
  },
  gridItem: {
    width: '46%',
  },
  metaLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  metaValue: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.text,
    marginTop: tokens.spacing.xxs,
  },
  artifactsContainer: {
    gap: tokens.spacing.md,
  },
  artifactBox: {
    backgroundColor: tokens.colors.surfaceRaised,
    borderRadius: tokens.radius.input,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  artifactLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: tokens.colors.textSubtle,
    marginBottom: tokens.spacing.xs,
  },
  artifactText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.text,
    lineHeight: 22,
  },
  mediaImage: {
    width: '100%',
    height: 220,
    borderRadius: tokens.radius.input,
    marginTop: tokens.spacing.xs,
  },
  videoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  urlPressableBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.xs,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    marginTop: tokens.spacing.xs,
    gap: tokens.spacing.sm,
  },
  urlMonospaceText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    color: tokens.colors.infoLight,
    flex: 1,
  },
  mediaUnavailable: {
    height: 100,
    backgroundColor: tokens.colors.surface,
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
  captionText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.textMuted,
    lineHeight: 18,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.xs,
  },
  tagChip: {
    backgroundColor: tokens.colors.primaryBgSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.primaryBorderSubtle,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xxs,
    borderRadius: tokens.radius.pill,
  },
  tagChipText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.primaryLighter,
  },
  emptyArtifactsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    backgroundColor: tokens.colors.surfaceRaised,
    borderRadius: tokens.radius.input,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  emptyArtifactsText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textSubtle,
    flex: 1,
  },
  failureCard: {
    backgroundColor: tokens.colors.destructiveBgSubtle,
    borderColor: tokens.colors.destructiveBorderSubtle,
    padding: tokens.spacing.base,
  },
  failureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  failureTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.destructiveLight,
  },
  failureReason: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.destructiveText,
    lineHeight: 18,
  },
  failureMetaRow: {
    flexDirection: 'row',
    gap: tokens.spacing.lg,
    marginTop: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.destructiveBorderSubtle,
  },
  failureMetaItem: {
    flexDirection: 'column',
  },
  failureMetaValue: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
    marginTop: tokens.spacing.xxs,
  },
  timestampsList: {
    gap: tokens.spacing.sm,
  },
  timestampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestampLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textSubtle,
  },
  timestampValue: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    fontWeight: '500',
  },
});
