import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Linking,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  RotateCcw,
  Repeat,
  ExternalLink,
  AlertTriangle,
  Globe,
  Radio,
  Clock,
  Layers,
  FileText,
  Info,
} from 'lucide-react-native';
import { usePublishingDetailQuery } from '../../../hooks/queries/usePublishingDetailQuery';
import { useChannelsQuery } from '../../../hooks/queries/useChannelsQuery';
import {
  useRetryPublishMutation,
  useRepublishMutation,
} from '../../../hooks/mutations/usePublishingMutations';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Sheet } from '../../../components/ui/Sheet';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { getPublishRecordStatus } from '../../../lib/status';
import { formatDateTime, formatDuration, formatMediaUrl } from '../../../lib/format';
import { tokens } from '../../../design/tokens';

export default function PublishingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [isRepublishSheetOpen, setIsRepublishSheetOpen] = useState(false);
  const [targetChannelId, setTargetChannelId] = useState<string>('');
  const [imageError, setImageError] = useState(false);

  const { data: channels = [] } = useChannelsQuery();
  const {
    data: record,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = usePublishingDetailQuery(id);

  const retryMutation = useRetryPublishMutation();
  const republishMutation = useRepublishMutation();

  const handleOpenPublishedUrl = async (url: string | null) => {
    if (!url) return;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch {
      // Ignore open error
    }
  };

  const handleRepublish = async () => {
    if (!record?.generatedContentId || !targetChannelId) return;
    try {
      await republishMutation.mutateAsync({
        generatedContentId: record.generatedContentId,
        channelId: targetChannelId,
      });
      setIsRepublishSheetOpen(false);
      setTargetChannelId('');
      router.push('/(app)/(tabs)/publishing');
    } catch {}
  };

  if (isError) {
    return (
      <View style={styles.centerContainer}>
        <ErrorState
          title="Failed to load publishing record"
          message={(error as any)?.message}
          onRetry={refetch}
          onRefresh={refetch}
        />
      </View>
    );
  }

  if (isLoading || !record) {
    return (
      <View style={styles.loadingContainer}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  const statusConfig = getPublishRecordStatus(record.status);
  const platformResponseData = record.platformResponse || record.providerMetadata;

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
      {/* Overview Card */}
      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.channelName}>{record.channel?.name || 'Unknown Channel'}</Text>
          <View style={styles.badgeGroup}>
            <Badge label={record.platform} variant="info" size="md" />
            <Badge
              label={statusConfig.label}
              bg={statusConfig.bg}
              border={statusConfig.border}
              textColor={statusConfig.text}
              size="md"
            />
          </View>
        </View>

        <View style={styles.subHeaderRow}>
          <Text style={styles.recordId}>ID: {record.id}</Text>
          <Text style={styles.dateText}>{formatDateTime(record.publishedAt)}</Text>
        </View>

        {record.contentTypeSnapshot && (
          <View style={styles.contentTypeBadge}>
            <Layers size={13} color={tokens.colors.textMuted} />
            <Text style={styles.contentTypeText}>Content Type: {record.contentTypeSnapshot}</Text>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          {record.publishedUrl && (
            <Button
              variant="primary"
              size="sm"
              icon={ExternalLink}
              onPress={() => handleOpenPublishedUrl(record.publishedUrl)}
            >
              Open Post
            </Button>
          )}

          {record.status === 'Failure' && (
            <Button
              variant="danger"
              size="sm"
              icon={RotateCcw}
              isLoading={retryMutation.isPending}
              loadingText="Retrying..."
              onPress={() => retryMutation.mutate(record.id)}
            >
              Retry
            </Button>
          )}

          {record.generatedContentId && (
            <Button
              variant="secondary"
              size="sm"
              icon={Repeat}
              onPress={() => {
                setTargetChannelId(record.channelId || '');
                setIsRepublishSheetOpen(true);
              }}
            >
              Republish
            </Button>
          )}
        </View>
      </Card>

      {/* Error Details Section (if failed) */}
      {(record.status === 'Failure' || record.errorDetails) && (
        <Card style={styles.failureCard}>
          <View style={styles.failureHeader}>
            <AlertTriangle size={18} color={tokens.colors.destructiveLight} />
            <Text style={styles.failureTitle}>Distribution Error</Text>
          </View>
          <Text style={styles.failureText}>
            {record.errorDetails || 'Publishing attempt failed. Please check platform connection and credentials.'}
          </Text>
        </Card>
      )}

      {/* Section 1: Publishing Info */}
      <Card style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Info size={16} color={tokens.colors.textMuted} />
          <Text style={styles.sectionTitle}>Publishing Information</Text>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Platform</Text>
            <Text style={styles.metaValue}>{record.platform}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={[styles.metaValue, { color: statusConfig.text }]}>{record.status}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Published At</Text>
            <Text style={styles.metaValue}>{formatDateTime(record.publishedAt)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Duration</Text>
            <Text style={styles.metaValue}>
              {record.duration !== null && record.duration !== undefined
                ? formatDuration(record.duration)
                : '—'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Retries</Text>
            <Text style={styles.metaValue}>{record.retries ?? 0}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Post ID</Text>
            <Text style={styles.metaValue}>{record.platformPostId || '—'}</Text>
          </View>
          <View style={styles.metaItemFull}>
            <Text style={styles.metaLabel}>Platform Connection ID</Text>
            <Text style={styles.monospaceValue}>{record.platformConnectionId || '—'}</Text>
          </View>
        </View>
      </Card>

      {/* Section 2: Content Preview (text/image) */}
      <Card style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <FileText size={16} color={tokens.colors.textMuted} />
          <Text style={styles.sectionTitle}>Content Preview</Text>
        </View>

        {record.generatedContent ? (
          <View style={styles.contentPreviewArea}>
            {record.generatedContent.text ? (
              <View style={styles.textBox}>
                <Text style={styles.contentText}>"{record.generatedContent.text}"</Text>
              </View>
            ) : null}

            {record.generatedContent.caption ? (
              <View style={styles.captionBox}>
                <Text style={styles.captionLabel}>Caption</Text>
                <Text style={styles.captionText}>{record.generatedContent.caption}</Text>
              </View>
            ) : null}

            {record.generatedContent.imageUrl && (
              <View style={styles.imageBox}>
                <Text style={styles.captionLabel}>Rendered Visual</Text>
                {imageError ? (
                  <View style={styles.imageFallback}>
                    <AlertTriangle size={18} color={tokens.colors.textSubtle} />
                    <Text style={styles.imageFallbackText}>Unable to load image preview</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: formatMediaUrl(record.generatedContent.imageUrl) }}
                    style={styles.imagePreview}
                    contentFit="cover"
                    onError={() => setImageError(true)}
                  />
                )}
              </View>
            )}

            {!record.generatedContent.text && !record.generatedContent.imageUrl && (
              <Text style={styles.emptyContentText}>No text or visual payload found in content record.</Text>
            )}
          </View>
        ) : (
          <Text style={styles.emptyContentText}>No generated content payload linked to this record.</Text>
        )}
      </Card>

      {/* Section 3: Published URL */}
      {record.publishedUrl && (
        <Card style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Globe size={16} color={tokens.colors.textMuted} />
            <Text style={styles.sectionTitle}>Published URL</Text>
          </View>
          <Pressable
            onPress={() => handleOpenPublishedUrl(record.publishedUrl)}
            style={styles.urlPressable}
          >
            <Text style={styles.urlText} numberOfLines={2}>
              {record.publishedUrl}
            </Text>
            <ExternalLink size={16} color={tokens.colors.primaryLight} />
          </Pressable>
        </Card>
      )}

      {/* Section 4: Platform Response */}
      <Card style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Radio size={16} color={tokens.colors.textMuted} />
          <Text style={styles.sectionTitle}>Platform Response</Text>
        </View>
        {platformResponseData && Object.keys(platformResponseData).length > 0 ? (
          <ScrollView horizontal style={styles.codeScroll}>
            <Text style={styles.metadataText}>
              {JSON.stringify(platformResponseData, null, 2)}
            </Text>
          </ScrollView>
        ) : (
          <Text style={styles.emptyContentText}>No platform response payload recorded.</Text>
        )}
      </Card>

      {/* Republish Target Channel Sheet */}
      <Sheet
        visible={isRepublishSheetOpen}
        onClose={() => setIsRepublishSheetOpen(false)}
        title="Republish Content"
        subtitle="Select the destination channel to republish this post"
      >
        <View style={styles.sheetForm}>
          <Text style={styles.sheetLabel}>Destination Channel *</Text>
          <View style={styles.chipsRow}>
            {channels.map((ch) => (
              <Pressable
                key={ch.id}
                onPress={() => setTargetChannelId(ch.id)}
                style={[
                  styles.optionChip,
                  targetChannelId === ch.id && styles.optionChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    targetChannelId === ch.id && styles.optionChipTextSelected,
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
            style={styles.republishSubmitButton}
          >
            Trigger Republish
          </Button>
        </View>
      </Sheet>
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
    paddingBottom: 40,
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
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  channelName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text,
    flex: 1,
    marginRight: tokens.spacing.sm,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: tokens.spacing.xs,
  },
  recordId: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: tokens.colors.textSubtle,
  },
  dateText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  contentTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: tokens.spacing.sm,
    backgroundColor: tokens.colors.surfaceRaised,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: tokens.radius.sm,
    alignSelf: 'flex-start',
  },
  contentTypeText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.base,
    paddingTop: tokens.spacing.base,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.sm,
  },
  sectionTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  failureCard: {
    backgroundColor: tokens.colors.destructiveBgSubtle,
    borderColor: tokens.colors.destructiveBorderSubtle,
    padding: tokens.spacing.base,
  },
  failureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  failureTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.destructiveLight,
  },
  failureText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.destructiveText,
    lineHeight: 18,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
  },
  metaItem: {
    width: '45%',
  },
  metaItemFull: {
    width: '100%',
    marginTop: tokens.spacing.xs,
  },
  metaLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.text,
    marginTop: 2,
  },
  monospaceValue: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  contentPreviewArea: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  textBox: {
    backgroundColor: tokens.colors.surfaceRaised,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.input,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  contentText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '500',
    color: tokens.colors.text,
    lineHeight: 20,
  },
  captionBox: {
    backgroundColor: tokens.colors.surfaceRaised,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.input,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  captionLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
    textTransform: 'uppercase',
    marginBottom: 4,
    fontWeight: '600',
  },
  captionText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    lineHeight: 16,
  },
  imageBox: {
    marginTop: tokens.spacing.xs,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: tokens.radius.input,
    backgroundColor: tokens.colors.surfaceRaised,
  },
  imageFallback: {
    height: 120,
    backgroundColor: tokens.colors.surfaceRaised,
    borderRadius: tokens.radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imageFallbackText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textSubtle,
  },
  emptyContentText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.textSubtle,
    fontStyle: 'italic',
    paddingVertical: tokens.spacing.xs,
  },
  urlPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceRaised,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.input,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: tokens.spacing.sm,
  },
  urlText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.primaryLight,
    flex: 1,
    textDecorationLine: 'underline',
  },
  codeScroll: {
    maxHeight: 220,
    backgroundColor: tokens.colors.surfaceRaised,
    borderRadius: tokens.radius.input,
  },
  metadataText: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: tokens.colors.textSubtle,
    padding: tokens.spacing.md,
  },
  sheetForm: {
    paddingBottom: 24,
  },
  sheetLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
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
  republishSubmitButton: {
    marginTop: 24,
  },
});
