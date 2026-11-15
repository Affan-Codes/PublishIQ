import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Plus,
  Filter,
  Sparkles,
  Layers,
  Copy,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Image as ImageIcon,
} from 'lucide-react-native';
import { useJobsInfiniteQuery } from '../../../hooks/queries/useJobsInfiniteQuery';
import { useGeneratedContentsInfiniteQuery } from '../../../hooks/queries/useGeneratedContentsInfiniteQuery';
import { useChannelsQuery } from '../../../hooks/queries/useChannelsQuery';
import { useContentProfilesQuery } from '../../../hooks/queries/useContentProfilesQuery';
import { useCreateJobMutation } from '../../../hooks/mutations/useJobMutations';
import {
  useDuplicateContentMutation,
  useRegenerateContentMutation,
  useDeleteContentMutation,
} from '../../../hooks/mutations/useContentMutations';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Sheet } from '../../../components/ui/Sheet';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { SkeletonList, SkeletonContentCard } from '../../../components/ui/Skeleton';
import { getPipelineStageStatus } from '../../../lib/status';
import { formatDateTime, formatRelativeTime } from '../../../lib/format';
import { getRTLTextStyle } from '../../../lib/rtl';
import { Job, GeneratedContent, PipelineStage, JobType } from '../../../types/domain';
import { tokens } from '../../../design/tokens';

export default function JobsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'jobs' | 'content'>('jobs');

  // Filter sheet state
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<PipelineStage | undefined>(undefined);
  const [selectedChannelId, setSelectedChannelId] = useState<string | undefined>(undefined);
  const [selectedJobType, setSelectedJobType] = useState<JobType | undefined>(undefined);

  // Create Job sheet state
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [createChannelId, setCreateChannelId] = useState<string>('');
  const [createProfileId, setCreateProfileId] = useState<string>('');
  const [isDryRun, setIsDryRun] = useState(false);

  // Content actions state
  const [duplicateContentId, setDuplicateContentId] = useState<string | null>(null);
  const [regenerateContentId, setRegenerateContentId] = useState<string | null>(null);
  const [deletingContentId, setDeletingContentId] = useState<string | null>(null);
  const [actionChannelId, setActionChannelId] = useState<string>('');

  // Queries
  const { data: channels = [] } = useChannelsQuery();
  const { data: contentProfiles = [] } = useContentProfilesQuery();

  const {
    data: jobsData,
    isLoading: isJobsLoading,
    isError: isJobsError,
    error: jobsError,
    refetch: refetchJobs,
    isRefetching: isJobsRefetching,
    fetchNextPage: fetchNextJobs,
    hasNextPage: hasNextJobs,
    isFetchingNextPage: isFetchingNextJobs,
  } = useJobsInfiniteQuery(
    {
      pipelineStage: selectedStage,
      channelId: selectedChannelId,
      jobType: selectedJobType,
    },
    {
      // 10s conditional polling while any job is non-terminal (§9.8)
      refetchInterval: (query: any) => {
        const pages = query?.state?.data?.pages || [];
        const hasRunningJob = pages.some((page: any) =>
          page.data?.some((job: any) => {
            const status = getPipelineStageStatus(job.pipelineStage);
            return !status.isTerminal;
          })
        );
        return hasRunningJob ? 10_000 : false;
      },
    }
  );

  const {
    data: contentData,
    isLoading: isContentLoading,
    isError: isContentError,
    error: contentError,
    refetch: refetchContent,
    isRefetching: isContentRefetching,
    fetchNextPage: fetchNextContent,
    hasNextPage: hasNextContent,
    isFetchingNextPage: isFetchingNextContent,
  } = useGeneratedContentsInfiniteQuery();

  // Mutations
  const createJobMutation = useCreateJobMutation();
  const duplicateMutation = useDuplicateContentMutation();
  const regenerateMutation = useRegenerateContentMutation();
  const deleteMutation = useDeleteContentMutation();

  const handleCreateJob = async () => {
    if (!createChannelId && !createProfileId) return;
    try {
      await createJobMutation.mutateAsync({
        channelId: createChannelId || undefined,
        contentProfileId: createProfileId || undefined,
        dryRun: isDryRun,
      });
      setIsCreateSheetOpen(false);
      setCreateChannelId('');
      setCreateProfileId('');
      setIsDryRun(false);
    } catch {
      // Handled in mutation hook toast
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateContentId || !actionChannelId) return;
    try {
      await duplicateMutation.mutateAsync({
        id: duplicateContentId,
        channelId: actionChannelId,
      });
      setDuplicateContentId(null);
      setActionChannelId('');
      setActiveTab('jobs');
    } catch {
      // Handled in mutation toast
    }
  };

  const handleRegenerate = async () => {
    if (!regenerateContentId || !actionChannelId) return;
    try {
      await regenerateMutation.mutateAsync({
        id: regenerateContentId,
        channelId: actionChannelId,
      });
      setRegenerateContentId(null);
      setActionChannelId('');
      setActiveTab('jobs');
    } catch {
      // Handled in mutation toast
    }
  };

  const handleDeleteContent = async () => {
    if (!deletingContentId) return;
    try {
      await deleteMutation.mutateAsync(deletingContentId);
      setDeletingContentId(null);
    } catch {
      // Handled in mutation toast
    }
  };

  const allJobs: Job[] = jobsData?.pages.flatMap((p) => p.data) || [];
  const allContents: GeneratedContent[] = contentData?.pages.flatMap((p) => p.data) || [];

  return (
    <View style={styles.container}>
      {/* Top Segment Control & Controls */}
      <View style={styles.toolbar}>
        <SegmentedControl
          options={[
            { id: 'jobs', label: 'Job Executions', count: allJobs.length },
            { id: 'content', label: 'Generated Gallery', count: allContents.length },
          ]}
          selectedId={activeTab}
          onChange={(id) => setActiveTab(id as 'jobs' | 'content')}
          style={{ flex: 1 }}
        />

        <View style={styles.actionsRow}>
          {activeTab === 'jobs' && (
            <Button
              variant="secondary"
              size="sm"
              icon={Filter}
              onPress={() => setIsFilterSheetOpen(true)}
            >
              Filter
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onPress={() => setIsCreateSheetOpen(true)}
          >
            Create Job
          </Button>
        </View>
      </View>

      {/* JOBS TAB CONTENT */}
      {activeTab === 'jobs' && (
        <View style={{ flex: 1 }}>
          {isJobsError ? (
            <View style={styles.centerContainer}>
              <ErrorState
                title="Failed to load job executions"
                message={(jobsError as any)?.message}
                onRetry={refetchJobs}
                onRefresh={refetchJobs}
              />
            </View>
          ) : isJobsLoading ? (
            <View style={{ padding: tokens.spacing.base }}>
              <SkeletonList count={4} />
            </View>
          ) : allJobs.length === 0 ? (
            <View style={styles.centerContainer}>
              <EmptyState
                icon={Layers}
                title="No job executions found"
                description="Trigger content generation manually or connect automated channels to begin rendering."
                actionLabel="Create First Job"
                onAction={() => setIsCreateSheetOpen(true)}
              />
            </View>
          ) : (
            <FlatList
              data={allJobs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshing={isJobsRefetching}
              onRefresh={refetchJobs}
              onEndReached={() => {
                if (hasNextJobs && !isFetchingNextJobs) fetchNextJobs();
              }}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                isFetchingNextJobs ? (
                  <ActivityIndicator
                    size="small"
                    color={tokens.colors.primaryLight}
                    style={{ marginVertical: 16 }}
                  />
                ) : null
              }
              renderItem={({ item }) => {
                const stageStatus = getPipelineStageStatus(item.pipelineStage);
                return (
                  <Card
                    onPress={() => router.push(`/(app)/jobs/${item.id}`)}
                    style={styles.jobCard}
                  >
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.jobChannelTitle}>
                          {item.channel?.name || 'Manual Generation'}
                        </Text>
                        <Text style={styles.jobIdSubtitle}>ID: {item.id}</Text>
                      </View>
                      <Badge
                        label={stageStatus.label}
                        bg={stageStatus.bg}
                        border={stageStatus.border}
                        textColor={stageStatus.text}
                        size="sm"
                      />
                    </View>

                    <View style={styles.chipsRow}>
                      <Badge label={item.jobType} variant="neutral" size="sm" />
                      {item.isDryRun && (
                        <Badge label="Dry Run" variant="warning" size="sm" />
                      )}
                    </View>

                    {item.failureReason ? (
                      <View style={styles.failureBox}>
                        <AlertTriangle size={12} color={tokens.colors.destructiveLight} />
                        <Text style={styles.failureText} numberOfLines={2}>
                          {item.failureReason}
                        </Text>
                      </View>
                    ) : null}

                    <View style={[styles.rowBetween, { marginTop: 12 }]}>
                      <Text style={styles.metaTime}>
                        {formatDateTime(item.createdAt)}
                      </Text>
                      <Text style={styles.metaSub}>
                        Attempt {item.retryCount + 1}
                      </Text>
                    </View>
                  </Card>
                );
              }}
            />
          )}
        </View>
      )}

      {/* GENERATED CONTENT TAB CONTENT */}
      {activeTab === 'content' && (
        <View style={{ flex: 1 }}>
          {isContentError ? (
            <View style={styles.centerContainer}>
              <ErrorState
                title="Failed to load generated content gallery"
                message={(contentError as any)?.message}
                onRetry={refetchContent}
                onRefresh={refetchContent}
              />
            </View>
          ) : isContentLoading ? (
            <View style={{ padding: tokens.spacing.base }}>
              <SkeletonContentCard />
              <View style={{ height: 12 }} />
              <SkeletonContentCard />
            </View>
          ) : allContents.length === 0 ? (
            <View style={styles.centerContainer}>
              <EmptyState
                icon={Sparkles}
                title="No generated content"
                description="Rendered short-form quotes, images, and videos will appear in this gallery."
              />
            </View>
          ) : (
            <FlatList
              data={allContents}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshing={isContentRefetching}
              onRefresh={refetchContent}
              onEndReached={() => {
                if (hasNextContent && !isFetchingNextContent) fetchNextContent();
              }}
              onEndReachedThreshold={0.5}
              renderItem={({ item }) => {
                const rtlStyle = getRTLTextStyle(item.language);
                return (
                  <Card
                    onPress={() => router.push(`/(app)/generated/${item.id}`)}
                    style={styles.contentCard}
                  >
                    <View style={styles.rowBetween}>
                      <Badge
                        label={item.publishStatus || 'Unpublished'}
                        variant={item.publishStatus === 'Published' ? 'success' : 'neutral'}
                        size="sm"
                      />
                      <Badge label={item.language} variant="primary" size="sm" />
                    </View>

                    <Text style={[styles.contentText, rtlStyle]} numberOfLines={3}>
                      "{item.text}"
                    </Text>

                    {item.caption ? (
                      <Text style={styles.contentCaption} numberOfLines={2}>
                        {item.caption}
                      </Text>
                    ) : null}

                    {/* Quick action buttons */}
                    <View style={styles.cardActionsRow}>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Copy}
                        onPress={() => setDuplicateContentId(item.id)}
                      >
                        Duplicate
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={RefreshCw}
                        onPress={() => setRegenerateContentId(item.id)}
                      >
                        Regenerate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onPress={() => setDeletingContentId(item.id)}
                        textStyle={{ color: tokens.colors.destructiveLight }}
                      >
                        Delete
                      </Button>
                    </View>
                  </Card>
                );
              }}
            />
          )}
        </View>
      )}

      {/* CREATE JOB SHEET */}
      <Sheet
        visible={isCreateSheetOpen}
        onClose={() => setIsCreateSheetOpen(false)}
        title="Trigger Content Generation"
        subtitle="Execute rendering pipeline against an active channel or content profile"
      >
        <View style={styles.sheetForm}>
          <Text style={styles.sheetLabel}>Select Channel</Text>
          <View style={styles.pickerContainer}>
            {channels.map((ch) => (
              <Pressable
                key={ch.id}
                onPress={() => {
                  setCreateChannelId(ch.id);
                  setCreateProfileId('');
                }}
                style={[
                  styles.optionChip,
                  createChannelId === ch.id && styles.optionChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    createChannelId === ch.id && styles.optionChipTextSelected,
                  ]}
                >
                  {ch.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sheetLabel, { marginTop: 16 }]}>Or Select Content Profile</Text>
          <View style={styles.pickerContainer}>
            {contentProfiles.map((cp) => (
              <Pressable
                key={cp.id}
                onPress={() => {
                  setCreateProfileId(cp.id);
                  setCreateChannelId('');
                }}
                style={[
                  styles.optionChip,
                  createProfileId === cp.id && styles.optionChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    createProfileId === cp.id && styles.optionChipTextSelected,
                  ]}
                >
                  {cp.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.rowBetween, { marginTop: 24, paddingVertical: 12 }]}>
            <View>
              <Text style={styles.sheetLabel}>Dry-Run Mode</Text>
              <Text style={styles.sheetHint}>Generate content without auto-publishing</Text>
            </View>
            <Switch
              value={isDryRun}
              onValueChange={setIsDryRun}
              trackColor={{ false: tokens.colors.border, true: tokens.colors.primary }}
            />
          </View>

          <Button
            variant="primary"
            size="lg"
            isLoading={createJobMutation.isPending}
            loadingText="Triggering Pipeline..."
            disabled={!createChannelId && !createProfileId}
            onPress={handleCreateJob}
            style={{ marginTop: 24 }}
          >
            Start Content Pipeline
          </Button>
        </View>
      </Sheet>

      {/* TARGET CHANNEL SELECTION SHEET (DUPLICATE / REGENERATE) */}
      <Sheet
        visible={Boolean(duplicateContentId || regenerateContentId)}
        onClose={() => {
          setDuplicateContentId(null);
          setRegenerateContentId(null);
          setActionChannelId('');
        }}
        title={duplicateContentId ? 'Duplicate Content Post' : 'Regenerate Content Post'}
        subtitle="Select the target channel for this new rendering pipeline"
      >
        <View style={styles.sheetForm}>
          <Text style={styles.sheetLabel}>Choose Destination Channel *</Text>
          <View style={styles.pickerContainer}>
            {channels.map((ch) => (
              <Pressable
                key={ch.id}
                onPress={() => setActionChannelId(ch.id)}
                style={[
                  styles.optionChip,
                  actionChannelId === ch.id && styles.optionChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    actionChannelId === ch.id && styles.optionChipTextSelected,
                  ]}
                >
                  {ch.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Button
            variant="primary"
            size="lg"
            disabled={!actionChannelId}
            isLoading={duplicateMutation.isPending || regenerateMutation.isPending}
            loadingText="Processing..."
            onPress={duplicateContentId ? handleDuplicate : handleRegenerate}
            style={{ marginTop: 24 }}
          >
            {duplicateContentId ? 'Duplicate to Channel' : 'Regenerate for Channel'}
          </Button>
        </View>
      </Sheet>

      {/* FILTER BOTTOM SHEET */}
      <Sheet
        visible={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title="Filter Job Executions"
      >
        <View style={styles.sheetForm}>
          <Text style={styles.sheetLabel}>Pipeline Stage</Text>
          <View style={styles.pickerContainer}>
            {['Draft', 'Running', 'Queued', 'Completed', 'Failed', 'Archived'].map((stage) => (
              <Pressable
                key={stage}
                onPress={() =>
                  setSelectedStage(selectedStage === stage ? undefined : (stage as any))
                }
                style={[
                  styles.optionChip,
                  selectedStage === stage && styles.optionChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    selectedStage === stage && styles.optionChipTextSelected,
                  ]}
                >
                  {stage}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.rowBetween, { marginTop: 24 }]}>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => {
                setSelectedStage(undefined);
                setSelectedChannelId(undefined);
                setSelectedJobType(undefined);
                setIsFilterSheetOpen(false);
              }}
            >
              Reset Filters
            </Button>
            <Button
              variant="primary"
              size="sm"
              onPress={() => setIsFilterSheetOpen(false)}
            >
              Apply Filters
            </Button>
          </View>
        </View>
      </Sheet>

      {/* DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        visible={Boolean(deletingContentId)}
        title="Delete Generated Content"
        message="Are you sure you want to permanently delete this generated content record? This action cannot be undone."
        confirmLabel="Delete Record"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteContent}
        onCancel={() => setDeletingContentId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bgApp,
  },
  toolbar: {
    padding: tokens.spacing.base,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    gap: tokens.spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.spacing.sm,
  },
  listContent: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.md,
  },
  centerContainer: {
    flex: 1,
    padding: tokens.spacing.xl,
    justifyContent: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jobCard: {
    padding: tokens.spacing.base,
  },
  jobChannelTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  jobIdText: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: tokens.colors.textSubtle,
    marginTop: 2,
  },
  jobIdSubtitle: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: tokens.colors.textSubtle,
    marginTop: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  failureBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.destructiveBgSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.destructiveBorderSubtle,
    borderRadius: tokens.radius.xs,
    padding: 8,
    marginTop: 8,
  },
  failureText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.destructiveText,
    flex: 1,
  },
  metaTime: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textMuted,
  },
  metaSub: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
  },

  // Content card
  contentCard: {
    padding: tokens.spacing.base,
    gap: 8,
  },
  contentText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.text,
    lineHeight: 20,
    marginTop: 4,
  },
  contentCaption: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    backgroundColor: tokens.colors.surfaceRaised,
    padding: 8,
    borderRadius: tokens.radius.input,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },

  // Sheet forms
  sheetForm: {
    gap: 8,
    paddingBottom: 24,
  },
  sheetLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
  },
  sheetHint: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  optionChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
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
});
