import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  ListTodo,
  CheckCircle,
  XCircle,
  RotateCcw,
  Clock,
  Eye,
  Check,
  X,
  Activity,
  Filter,
} from 'lucide-react-native';
import { useQueueStatsQuery } from '../../hooks/queries/useQueueStatsQuery';
import { useUpcomingRunsQuery } from '../../hooks/queries/useUpcomingRunsQuery';
import { useJobsInfiniteQuery } from '../../hooks/queries/useJobsInfiniteQuery';
import {
  useCancelJobMutation,
  useRetryJobMutation,
  useApproveJobMutation,
  useRejectJobMutation,
} from '../../hooks/mutations/useJobMutations';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { Sheet } from '../../components/ui/Sheet';
import { tokens } from '../../design/tokens';
import { formatDateTime, formatMediaUrl } from '../../lib/format';
import { getPipelineStageStatus } from '../../lib/status';
import { getRTLTextStyle } from '../../lib/rtl';
import { Job, JobType, PipelineStage } from '../../types/domain';

export default function QueueScreen() {
  const [stageFilter, setStageFilter] = useState<PipelineStage | ''>('');
  const [typeFilter, setTypeFilter] = useState<JobType | ''>('');
  const [selectedJobForReview, setSelectedJobForReview] = useState<Job | null>(null);
  const [actionJobId, setActionJobId] = useState<string | null>(null);

  // Queries
  const {
    data: stats,
    isLoading: isStatsLoading,
    refetch: refetchStats,
    isRefetching: isStatsRefetching,
  } = useQueueStatsQuery();

  const {
    data: scheduledRuns = [],
    refetch: refetchScheduled,
    isRefetching: isScheduledRefetching,
  } = useUpcomingRunsQuery();

  const {
    data: jobsData,
    isLoading: isJobsLoading,
    isError,
    error,
    refetch: refetchJobs,
    isRefetching: isJobsRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useJobsInfiniteQuery({
    pipelineStage: stageFilter ? stageFilter : undefined,
    jobType: typeFilter ? typeFilter : undefined,
  });

  // Mutations
  const cancelMutation = useCancelJobMutation();
  const retryMutation = useRetryJobMutation();
  const approveMutation = useApproveJobMutation();
  const rejectMutation = useRejectJobMutation();

  const isRefreshing = isStatsRefetching || isScheduledRefetching || isJobsRefetching;

  const handleRefreshAll = () => {
    refetchStats();
    refetchScheduled();
    refetchJobs();
  };

  const allJobs: Job[] = jobsData?.pages.flatMap((page) => page.data) || [];

  const handleCancel = (id: string) => {
    setActionJobId(id);
    cancelMutation.mutate(id, {
      onSettled: () => setActionJobId(null),
    });
  };

  const handleRetry = (id: string) => {
    setActionJobId(id);
    retryMutation.mutate(id, {
      onSettled: () => setActionJobId(null),
    });
  };

  const handleApprove = (id: string) => {
    setActionJobId(id);
    approveMutation.mutate(id, {
      onSuccess: () => setSelectedJobForReview(null),
      onSettled: () => setActionJobId(null),
    });
  };

  const handleReject = (id: string) => {
    setActionJobId(id);
    rejectMutation.mutate(
      { jobId: id, reason: 'User rejected in Queue Review' },
      {
        onSuccess: () => setSelectedJobForReview(null),
        onSettled: () => setActionJobId(null),
      }
    );
  };

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <ErrorState
          title="Failed to load queue status"
          message={(error as any)?.message || 'An error occurred while communicating with BullMQ background services.'}
          onRetry={handleRefreshAll}
          onRefresh={handleRefreshAll}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={allJobs}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefreshAll}
            tintColor={tokens.colors.primaryLight}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerArea}>
            {/* Subtitle */}
            <View style={styles.subtitleRow}>
              <Activity size={18} color={tokens.colors.primaryLight} />
              <Text style={styles.subtitleText}>
                Inspect active BullMQ background workers and hybrid approval gates
              </Text>
            </View>

            {/* Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Total Items</Text>
                <Text style={styles.metricValue}>{stats?.total ?? 0}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Active</Text>
                <Text style={[styles.metricValue, { color: tokens.colors.primaryLight }]}>
                  {stats?.active ?? 0}
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Waiting</Text>
                <Text style={[styles.metricValue, { color: tokens.colors.warningLight }]}>
                  {stats?.waiting ?? 0}
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Delayed</Text>
                <Text style={[styles.metricValue, { color: tokens.colors.infoLight }]}>
                  {stats?.delayed ?? 0}
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Failed</Text>
                <Text style={[styles.metricValue, { color: tokens.colors.destructiveLight }]}>
                  {stats?.failed ?? 0}
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Archived</Text>
                <Text style={[styles.metricValue, { color: tokens.colors.textSubtle }]}>
                  {stats?.archived ?? 0}
                </Text>
              </View>
            </View>

            {/* Upcoming Automated Channel Schedules */}
            {scheduledRuns.length > 0 && (
              <Card style={styles.scheduledCard}>
                <View style={styles.scheduledHeader}>
                  <Clock size={14} color={tokens.colors.primaryLight} />
                  <Text style={styles.scheduledTitle}>Upcoming Automated Channel Schedules</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scheduledScroll}>
                  {scheduledRuns.map((run) => (
                    <View key={run.key} style={styles.runChip}>
                      <Text style={styles.runChannelName} numberOfLines={1}>
                        {run.channelName}
                      </Text>
                      <Text style={styles.runCron}>Cron: {run.cron}</Text>
                      <Text style={styles.runNext}>
                        Next: {run.next ? formatDateTime(run.next) : 'Pending'}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </Card>
            )}

            {/* Stage Filter Chips */}
            <View style={styles.filtersSection}>
              <Text style={styles.sectionHeader}>Pipeline Stage Filter</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {[
                  { label: 'All Stages', value: '' as const },
                  { label: 'Queued (Awaiting Review)', value: 'Queued' as const },
                  { label: 'Completed', value: 'Completed' as const },
                  { label: 'Failed', value: 'Failed' as const },
                  { label: 'Archived', value: 'Archived' as const },
                ].map((st) => {
                  const isSelected = stageFilter === st.value;
                  return (
                    <TouchableOpacity
                      key={st.value}
                      style={[styles.filterChip, isSelected && styles.filterChipActive]}
                      onPress={() => setStageFilter(st.value)}
                    >
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                        {st.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const stageStatus = getPipelineStageStatus(item.pipelineStage);
          const isActing = actionJobId === item.id;

          return (
            <Card style={styles.jobItemCard}>
              <View style={styles.jobHeaderRow}>
                <View style={styles.jobInfo}>
                  <Text style={styles.jobShortId}>ID: {item.id.slice(0, 8)}...</Text>
                  <Text style={styles.jobType}>{item.jobType}</Text>
                </View>
                <Badge
                  label={item.pipelineStage === 'Queued' ? 'Ready (Awaiting Review)' : stageStatus.label}
                  bg={stageStatus.bg}
                  border={stageStatus.border}
                  textColor={stageStatus.text}
                  size="sm"
                />
              </View>

              <View style={styles.jobMetaRow}>
                <Text style={styles.channelLabel}>
                  {item.channel?.name || 'Manual Generation'}
                </Text>
                <Text style={styles.metaSubtle}>
                  Mode: {(item.channel as any)?.automationMode || 'Manual'} • {formatDateTime(item.createdAt)}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.jobActionsRow}>
                {item.pipelineStage === 'Queued' && (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={Eye}
                    onPress={() => setSelectedJobForReview(item)}
                  >
                    Review Post
                  </Button>
                )}

                {item.pipelineStage === 'Failed' && (
                  <Button
                    size="sm"
                    variant="danger"
                    icon={RotateCcw}
                    isLoading={retryMutation.isPending && isActing}
                    loadingText="Retrying..."
                    onPress={() => handleRetry(item.id)}
                  >
                    Retry
                  </Button>
                )}

                {item.pipelineStage !== 'Completed' &&
                  item.pipelineStage !== 'Failed' &&
                  item.pipelineStage !== 'Archived' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={XCircle}
                      isLoading={cancelMutation.isPending && isActing}
                      loadingText="Cancelling..."
                      textStyle={{ color: tokens.colors.destructiveLight }}
                      onPress={() => handleCancel(item.id)}
                    >
                      Cancel
                    </Button>
                  )}
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          isJobsLoading ? (
            <View style={styles.loadingArea}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <EmptyState
              icon={ListTodo}
              title="Queue is clean"
              description="Zero pending queue tasks. Trigger manual generations or wait for automated cron schedules."
            />
          )
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
      />

      {/* Review Modal */}
      {selectedJobForReview && (
        <ReviewJobSheet
          job={selectedJobForReview}
          isOpen={!!selectedJobForReview}
          onClose={() => setSelectedJobForReview(null)}
          onApprove={() => handleApprove(selectedJobForReview.id)}
          onReject={() => handleReject(selectedJobForReview.id)}
          isApproving={approveMutation.isPending && actionJobId === selectedJobForReview.id}
          isRejecting={rejectMutation.isPending && actionJobId === selectedJobForReview.id}
        />
      )}
    </View>
  );
}

// Subcomponent for Hybrid Approval Review
interface ReviewJobSheetProps {
  job: Job;
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}

function ReviewJobSheet({
  job,
  isOpen,
  onClose,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: ReviewJobSheetProps) {
  const formattedVideoUrl = job.videoUrl ? formatMediaUrl(job.videoUrl) : null;
  const player = useVideoPlayer(formattedVideoUrl || '', (p) => {
    p.loop = false;
  });

  const rtlStyle = getRTLTextStyle((job.contentProfile as any)?.language);

  return (
    <Sheet
      visible={isOpen}
      onClose={onClose}
      title="Hybrid Approval Gate"
      subtitle={`Channel: ${job.channel?.name || 'Manual Run'}`}
    >
      <ScrollView style={styles.reviewContent} showsVerticalScrollIndicator={false}>
        {/* Quote text */}
        {job.generatedText ? (
          <View style={styles.artifactBox}>
            <Text style={styles.artifactLabel}>Quote Text</Text>
            <Text style={[styles.artifactText, rtlStyle]}>"{job.generatedText}"</Text>
          </View>
        ) : null}

        {/* Media Preview (PNG / Video) */}
        {job.imageUrl && (
          <View style={styles.artifactBox}>
            <Text style={styles.artifactLabel}>Compiled Poster</Text>
            <Image
              source={{ uri: formatMediaUrl(job.imageUrl) }}
              style={styles.reviewImage}
              contentFit="cover"
            />
          </View>
        )}

        {job.videoUrl && (
          <View style={styles.artifactBox}>
            <Text style={styles.artifactLabel}>Rendered MP4 Short</Text>
            <View style={styles.videoWrapper}>
              <VideoView
                player={player}
                style={styles.videoPlayer}
                nativeControls
                allowsPictureInPicture
              />
            </View>
          </View>
        )}

        {/* Caption */}
        {job.caption && (
          <View style={styles.artifactBox}>
            <Text style={styles.artifactLabel}>Social Caption & Tags</Text>
            <Text style={styles.captionText}>{job.caption}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.reviewActions}>
          <Button
            variant="danger"
            size="md"
            icon={X}
            isLoading={isRejecting}
            loadingText="Rejecting..."
            onPress={onReject}
            style={{ flex: 1 }}
          >
            Reject Post
          </Button>

          <Button
            variant="primary"
            size="md"
            icon={Check}
            isLoading={isApproving}
            loadingText="Approving..."
            onPress={onApprove}
            style={{ flex: 1 }}
          >
            Approve & Publish
          </Button>
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bgApp,
  },
  listContent: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.md,
    paddingBottom: 40,
  },
  errorContainer: {
    flex: 1,
    padding: tokens.spacing.xl,
    justifyContent: 'center',
  },
  headerArea: {
    gap: tokens.spacing.base,
    marginBottom: tokens.spacing.sm,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  subtitleText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCard: {
    width: '31%',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.card,
    padding: tokens.spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  metricLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 9,
    fontWeight: '700',
    color: tokens.colors.textSubtle,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 18,
    fontWeight: '800',
    color: tokens.colors.text,
    marginTop: 2,
  },
  scheduledCard: {
    padding: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
  },
  scheduledHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  scheduledTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.textSubtle,
    textTransform: 'uppercase',
  },
  scheduledScroll: {
    gap: 10,
  },
  runChip: {
    backgroundColor: tokens.colors.surfaceRaised,
    borderRadius: tokens.radius.input,
    padding: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    minWidth: 180,
  },
  runChannelName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  runCron: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: tokens.colors.textSubtle,
    marginTop: 2,
  },
  runNext: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.primaryLight,
    marginTop: 4,
  },
  filtersSection: {
    gap: 8,
  },
  sectionHeader: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.textSubtle,
    textTransform: 'uppercase',
  },
  filterRow: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  filterChipActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primaryLight,
  },
  filterChipText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: tokens.colors.text,
    fontWeight: '700',
  },
  jobItemCard: {
    padding: tokens.spacing.base,
    gap: 10,
  },
  jobHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  jobShortId: {
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.primaryLight,
  },
  jobType: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
  },
  jobMetaRow: {
    gap: 2,
  },
  channelLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  metaSubtle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
  },
  jobActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  loadingArea: {
    gap: 12,
  },
  // Review sheet styles
  reviewContent: {
    maxHeight: 500,
  },
  artifactBox: {
    backgroundColor: tokens.colors.surfaceRaised,
    borderRadius: tokens.radius.input,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginBottom: tokens.spacing.md,
  },
  artifactLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.textSubtle,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  artifactText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.text,
    lineHeight: 20,
  },
  reviewImage: {
    width: '100%',
    height: 180,
    borderRadius: tokens.radius.input,
  },
  videoWrapper: {
    width: '100%',
    height: 200,
    borderRadius: tokens.radius.input,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  captionText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    lineHeight: 18,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingBottom: 20,
  },
});
