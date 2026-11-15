import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  History,
  Filter,
  RotateCcw,
  ExternalLink,
  Share2,
  AlertTriangle,
  Repeat,
} from 'lucide-react-native';
import { usePublishingHistoryInfiniteQuery } from '../../../hooks/queries/usePublishingHistoryInfiniteQuery';
import { useChannelsQuery } from '../../../hooks/queries/useChannelsQuery';
import {
  useRetryPublishMutation,
  useRepublishMutation,
} from '../../../hooks/mutations/usePublishingMutations';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Sheet } from '../../../components/ui/Sheet';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { getPublishRecordStatus } from '../../../lib/status';
import { formatDateTime } from '../../../lib/format';
import { Platform, PublishRecordStatus, PublishingRecord } from '../../../types/domain';
import { tokens } from '../../../design/tokens';

export default function PublishingScreen() {
  const router = useRouter();

  // Filters
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<PublishRecordStatus | undefined>(undefined);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Republish Target Channel selection
  const [republishRecord, setRepublishRecord] = useState<PublishingRecord | null>(null);
  const [targetChannelId, setTargetChannelId] = useState<string>('');

  const { data: channels = [] } = useChannelsQuery();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePublishingHistoryInfiniteQuery({
    platform: selectedPlatform,
    status: selectedStatus,
  });

  const retryMutation = useRetryPublishMutation();
  const republishMutation = useRepublishMutation();

  const handleOpenPublishedUrl = async (url: string | null) => {
    if (!url) return;
    if (url.startsWith('https://')) {
      await Linking.openURL(url);
    }
  };

  const handleRepublish = async () => {
    if (!republishRecord?.generatedContentId || !targetChannelId) return;
    try {
      await republishMutation.mutateAsync({
        generatedContentId: republishRecord.generatedContentId,
        channelId: targetChannelId,
      });
      setRepublishRecord(null);
      setTargetChannelId('');
    } catch {
      // Handled in mutation toast
    }
  };

  const allRecords: PublishingRecord[] = data?.pages.flatMap((p) => p.data) || [];

  return (
    <View style={styles.container}>
      {/* Top Filter Bar */}
      <View style={styles.toolbar}>
        <View style={styles.filterSummary}>
          <Text style={styles.summaryCount}>
            {allRecords.length} {allRecords.length === 1 ? 'Record' : 'Records'}
          </Text>
          {(selectedPlatform || selectedStatus) && (
            <Text style={styles.activeFilters}>
              (Filtered: {[selectedPlatform, selectedStatus].filter(Boolean).join(', ')})
            </Text>
          )}
        </View>

        <Button
          variant="secondary"
          size="sm"
          icon={Filter}
          onPress={() => setIsFilterSheetOpen(true)}
        >
          Filters
        </Button>
      </View>

      {/* Main List */}
      {isError ? (
        <View style={styles.centerContainer}>
          <ErrorState
            title="Failed to load publishing history"
            message={(error as any)?.message}
            onRetry={refetch}
            onRefresh={refetch}
          />
        </View>
      ) : isLoading ? (
        <View style={{ padding: tokens.spacing.base }}>
          <SkeletonList count={4} />
        </View>
      ) : allRecords.length === 0 ? (
        <View style={styles.centerContainer}>
          <EmptyState
            icon={History}
            title="No publishing records found"
            description="Audit records will appear once posts are distributed across connected platforms."
          />
        </View>
      ) : (
        <FlatList
          data={allRecords}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={refetch}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator
                size="small"
                color={tokens.colors.primaryLight}
                style={{ marginVertical: 16 }}
              />
            ) : null
          }
          renderItem={({ item }) => {
            const statusConfig = getPublishRecordStatus(item.status);
            return (
              <Card
                onPress={() => router.push(`/(app)/publishing/${item.id}`)}
                style={styles.card}
              >
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.channelTitle}>
                      {item.channel?.name || 'Unknown Channel'}
                    </Text>
                    <Text style={styles.subText}>
                      {item.platform} {item.platformPostId ? `• ID: ${item.platformPostId}` : ''}
                    </Text>
                  </View>
                  <Badge
                    label={statusConfig.label}
                    bg={statusConfig.bg}
                    border={statusConfig.border}
                    textColor={statusConfig.text}
                    size="sm"
                  />
                </View>

                {item.contentTypeSnapshot && (
                  <View style={styles.snapshotBadge}>
                    <Text style={styles.snapshotText}>{item.contentTypeSnapshot}</Text>
                  </View>
                )}

                {item.errorDetails && (
                  <View style={styles.errorBox}>
                    <AlertTriangle size={12} color={tokens.colors.destructiveLight} />
                    <Text style={styles.errorText} numberOfLines={2}>
                      {item.errorDetails}
                    </Text>
                  </View>
                )}

                <View style={[styles.rowBetween, { marginTop: 12 }]}>
                  <Text style={styles.metaTime}>{formatDateTime(item.publishedAt)}</Text>

                  <View style={styles.cardActions}>
                    {item.publishedUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={ExternalLink}
                        onPress={() => handleOpenPublishedUrl(item.publishedUrl)}
                      >
                        View
                      </Button>
                    )}

                    {item.status === 'Failure' && (
                      <Button
                        variant="danger"
                        size="sm"
                        icon={RotateCcw}
                        isLoading={retryMutation.isPending}
                        loadingText="Retrying..."
                        onPress={() => retryMutation.mutate(item.id)}
                      >
                        Retry
                      </Button>
                    )}

                    {item.generatedContentId && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Repeat}
                        onPress={() => {
                          setRepublishRecord(item);
                          setTargetChannelId(item.channelId || '');
                        }}
                      >
                        Republish
                      </Button>
                    )}
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* FILTER BOTTOM SHEET */}
      <Sheet
        visible={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title="Filter Publishing Records"
      >
        <View style={styles.sheetForm}>
          <Text style={styles.sheetLabel}>Platform</Text>
          <View style={styles.chipRow}>
            {['YouTube', 'Instagram', 'Facebook'].map((p) => (
              <Pressable
                key={p}
                onPress={() =>
                  setSelectedPlatform(selectedPlatform === p ? undefined : (p as any))
                }
                style={[
                  styles.filterChip,
                  selectedPlatform === p && styles.filterChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedPlatform === p && styles.filterChipTextSelected,
                  ]}
                >
                  {p}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sheetLabel, { marginTop: 16 }]}>Publish Status</Text>
          <View style={styles.chipRow}>
            {['Success', 'Failure'].map((s) => (
              <Pressable
                key={s}
                onPress={() =>
                  setSelectedStatus(selectedStatus === s ? undefined : (s as any))
                }
                style={[
                  styles.filterChip,
                  selectedStatus === s && styles.filterChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedStatus === s && styles.filterChipTextSelected,
                  ]}
                >
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.rowBetween, { marginTop: 24 }]}>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => {
                setSelectedPlatform(undefined);
                setSelectedStatus(undefined);
                setIsFilterSheetOpen(false);
              }}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              onPress={() => setIsFilterSheetOpen(false)}
            >
              Apply
            </Button>
          </View>
        </View>
      </Sheet>

      {/* REPUBLISH CHANNEL PICKER SHEET */}
      <Sheet
        visible={Boolean(republishRecord)}
        onClose={() => {
          setRepublishRecord(null);
          setTargetChannelId('');
        }}
        title="Republish Content"
        subtitle="Select the destination channel to re-trigger social publishing"
      >
        <View style={styles.sheetForm}>
          <Text style={styles.sheetLabel}>Destination Channel *</Text>
          <View style={styles.chipRow}>
            {channels.map((ch) => (
              <Pressable
                key={ch.id}
                onPress={() => setTargetChannelId(ch.id)}
                style={[
                  styles.filterChip,
                  targetChannelId === ch.id && styles.filterChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    targetChannelId === ch.id && styles.filterChipTextSelected,
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
            disabled={!targetChannelId}
            isLoading={republishMutation.isPending}
            loadingText="Republishing..."
            onPress={handleRepublish}
            style={{ marginTop: 24 }}
          >
            Trigger Republish
          </Button>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bgApp,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.base,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  filterSummary: {
    flex: 1,
  },
  summaryCount: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  activeFilters: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.primaryLighter,
    marginTop: 2,
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
  card: {
    padding: tokens.spacing.base,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  channelTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  subText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  snapshotBadge: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.surfaceRaised,
    borderRadius: tokens.radius.xs,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
  },
  snapshotText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
  },
  errorBox: {
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
  errorText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.destructiveText,
    flex: 1,
  },
  metaTime: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },

  // Sheet forms
  sheetForm: {
    paddingBottom: 24,
  },
  sheetLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: tokens.radius.input,
    backgroundColor: tokens.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  filterChipSelected: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primaryLight,
  },
  filterChipText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  filterChipTextSelected: {
    color: tokens.colors.text,
    fontWeight: '600',
  },
});
