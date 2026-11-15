import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Layers,
  Plus,
  Copy,
  Trash2,
  Settings2,
  Clock,
  Radio,
  Share2,
} from 'lucide-react-native';
import { useChannelsQuery } from '../../../hooks/queries/useChannelsQuery';
import {
  useDuplicateChannelMutation,
  useDeleteChannelMutation,
} from '../../../hooks/mutations/useChannelMutations';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { tokens } from '../../../design/tokens';
import { getAutomationModeStatus, getStatusBadge } from '../../../lib/status';
import { Channel } from '../../../types/domain';

export default function ChannelsListScreen() {
  const router = useRouter();
  const [deletingChannel, setDeletingChannel] = useState<Channel | null>(null);
  const [actionChannelId, setActionChannelId] = useState<string | null>(null);

  const { data: channels = [], isLoading, isError, error, refetch, isRefetching } = useChannelsQuery();
  const duplicateMutation = useDuplicateChannelMutation();
  const deleteMutation = useDeleteChannelMutation();

  const handleDuplicate = (id: string) => {
    setActionChannelId(id);
    duplicateMutation.mutate(id, {
      onSettled: () => setActionChannelId(null),
    });
  };

  const handleDelete = () => {
    if (!deletingChannel) return;
    deleteMutation.mutate(deletingChannel.id, {
      onSuccess: () => setDeletingChannel(null),
    });
  };

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <ErrorState
          title="Failed to load channels"
          message={(error as any)?.message}
          onRetry={refetch}
          onRefresh={refetch}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={channels}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={tokens.colors.primaryLight}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Publishing Channels</Text>
              <Text style={styles.headerSubtitle}>
                {channels.length} {channels.length === 1 ? 'channel' : 'channels'} configured
              </Text>
            </View>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onPress={() => router.push('/channels/new')}
            >
              Add Channel
            </Button>
          </View>
        }
        renderItem={({ item }) => {
          const autoStatus = getAutomationModeStatus(item.automationMode);
          const statusBadge = getStatusBadge(item.status);
          const isActing = actionChannelId === item.id;

          return (
            <Card
              style={styles.channelCard}
              onPress={() => router.push(`/channels/${item.id}`)}
            >
              {/* Card Header */}
              <View style={styles.rowBetween}>
                <View style={styles.channelInfo}>
                  <Text style={styles.channelName}>{item.name}</Text>
                  <Text style={styles.profileName}>
                    Profile: {item.contentProfile?.name || 'Default Profile'}
                  </Text>
                </View>
                <View style={styles.badgeRow}>
                  <Badge
                    label={autoStatus.label}
                    bg={autoStatus.bg}
                    border={autoStatus.border}
                    textColor={autoStatus.text}
                    size="sm"
                  />
                  <Badge
                    label={statusBadge.label}
                    variant={statusBadge.variant}
                    size="sm"
                  />
                </View>
              </View>

              {/* Details Meta */}
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Clock size={12} color={tokens.colors.textSubtle} />
                  <Text style={styles.metaText}>
                    Cron: {item.scheduleCron || 'Manual only'}
                  </Text>
                </View>

                {item.platformConnections && item.platformConnections.length > 0 && (
                  <View style={styles.metaItem}>
                    <Share2 size={12} color={tokens.colors.textSubtle} />
                    <Text style={styles.metaText}>
                      {item.platformConnections
                        .map((c) => c.platformConnection?.platform || 'Platform')
                        .join(', ')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Actions Footer */}
              <View style={styles.actionsFooter}>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Copy}
                  isLoading={duplicateMutation.isPending && isActing}
                  loadingText="Copying..."
                  onPress={() => handleDuplicate(item.id)}
                >
                  Duplicate
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  textStyle={{ color: tokens.colors.destructiveLight }}
                  onPress={() => setDeletingChannel(item)}
                >
                  Delete
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  icon={Settings2}
                  onPress={() => router.push(`/channels/${item.id}`)}
                >
                  Configure
                </Button>
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <SkeletonList count={3} />
          ) : (
            <EmptyState
              icon={Radio}
              title="No channels configured"
              description="Create automated or manual channels to publish generated content to social platforms."
              actionLabel="Create Channel"
              onAction={() => router.push('/channels/new')}
            />
          )
        }
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={!!deletingChannel}
        title="Delete Channel"
        message={`Are you sure you want to delete "${deletingChannel?.name}"? Future automated runs will be unscheduled.`}
        confirmLabel="Delete Channel"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeletingChannel(null)}
      />
    </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
  },
  headerTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  headerSubtitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  channelCard: {
    padding: tokens.spacing.base,
    gap: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  channelInfo: {
    flex: 1,
    paddingRight: 10,
  },
  channelName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  profileName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    backgroundColor: tokens.colors.surfaceRaised,
    padding: 8,
    borderRadius: tokens.radius.input,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textMuted,
  },
  actionsFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: 8,
  },
});
