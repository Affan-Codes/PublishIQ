import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Bell,
  CheckCheck,
  Filter,
  CheckCircle,
  AlertTriangle,
  Info,
  Trash2,
} from 'lucide-react-native';
import { useNotificationsInfiniteQuery } from '../../../hooks/queries/useNotificationsInfiniteQuery';
import {
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
} from '../../../hooks/mutations/useNotificationMutations';
import { useNotifications } from '../../../providers/NotificationProvider';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Sheet } from '../../../components/ui/Sheet';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { Banner } from '../../../components/ui/Banner';
import {
  getNotificationSeverity,
  getNotificationSeverityStyle,
} from '../../../lib/status';
import { formatRelativeTime } from '../../../lib/format';
import { Notification } from '../../../types/domain';
import { tokens } from '../../../design/tokens';

export default function AlertsScreen() {
  const router = useRouter();
  const { bannerMessage, unreadCount } = useNotifications();

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

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
  } = useNotificationsInfiniteQuery({
    status: statusFilter,
  });

  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();
  const deleteMutation = useDeleteNotificationMutation();

  const handleOpenDetail = (notif: Notification) => {
    if (!notif.readAt) {
      markReadMutation.mutate(notif.id);
    }
    router.push(`/notifications/${notif.id}` as any);
  };

  const allNotifications: Notification[] = data?.pages.flatMap((p) => p.data) || [];

  return (
    <View style={styles.container}>
      {/* Top Banner if live updates paused */}
      {bannerMessage && (
        <Banner variant="warning" message={bannerMessage} style={{ margin: tokens.spacing.base, marginBottom: 0 }} />
      )}

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>
            Alerts & Notifications {unreadCount > 0 ? `(${unreadCount} unread)` : ''}
          </Text>
          <Text style={styles.summarySub}>
            Real-time pipeline dispatches and background worker health
          </Text>
        </View>

        <View style={styles.actionsRow}>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              icon={CheckCheck}
              isLoading={markAllReadMutation.isPending}
              loadingText="Marking..."
              onPress={() => markAllReadMutation.mutate()}
            >
              Mark All Read
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            icon={Filter}
            onPress={() => setIsFilterSheetOpen(true)}
          >
            Filter
          </Button>
        </View>
      </View>

      {/* Notifications List */}
      {isError ? (
        <View style={styles.centerContainer}>
          <ErrorState
            title="Failed to load notifications"
            message={(error as any)?.message}
            onRetry={refetch}
            onRefresh={refetch}
          />
        </View>
      ) : isLoading ? (
        <View style={{ padding: tokens.spacing.base }}>
          <SkeletonList count={4} />
        </View>
      ) : allNotifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <EmptyState
            icon={Bell}
            title="No alerts right now"
            description="You're all caught up! New content pipeline and publication events will appear here."
          />
        </View>
      ) : (
        <FlatList
          data={allNotifications}
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
            const eventType = item.domainEvent?.type;
            const severity = getNotificationSeverity(eventType);
            const severityStyle = getNotificationSeverityStyle(severity);
            const isUnread = !item.readAt;

            return (
              <Card
                onPress={() => handleOpenDetail(item)}
                style={[
                  styles.notificationCard,
                  isUnread && styles.unreadNotificationCard,
                ]}
              >
                <View style={styles.rowBetween}>
                  <Badge
                    label={severityStyle.label}
                    bg={severityStyle.bg}
                    border={severityStyle.border}
                    textColor={severityStyle.text}
                    size="sm"
                  />
                  <Text style={styles.metaTime}>{formatRelativeTime(item.createdAt)}</Text>
                </View>

                <Text style={[styles.messageText, isUnread && styles.unreadMessageText]}>
                  {item.message}
                </Text>

                {eventType && (
                  <Text style={styles.eventTypeText}>Event: {eventType}</Text>
                )}

                <View style={[styles.rowBetween, { marginTop: 10 }]}>
                  {isUnread ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={CheckCircle}
                      onPress={() => markReadMutation.mutate(item.id)}
                    >
                      Mark as Read
                    </Button>
                  ) : (
                    <Text style={styles.readBadgeText}>Read</Text>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    textStyle={{ color: tokens.colors.destructiveLight }}
                    onPress={() => deleteMutation.mutate(item.id)}
                  >
                    Delete
                  </Button>
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* FILTER SHEET */}
      <Sheet
        visible={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title="Filter Alerts"
      >
        <View style={styles.sheetForm}>
          <Text style={styles.sheetLabel}>Status</Text>
          <View style={styles.chipRow}>
            {[
              { id: 'all', label: 'All Alerts' },
              { id: 'unread', label: 'Unread Only' },
              { id: 'read', label: 'Read Only' },
            ].map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setStatusFilter(s.id as any)}
                style={[
                  styles.filterChip,
                  statusFilter === s.id && styles.filterChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    statusFilter === s.id && styles.filterChipTextSelected,
                  ]}
                >
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Button
            variant="primary"
            size="md"
            onPress={() => setIsFilterSheetOpen(false)}
            style={{ marginTop: 24 }}
          >
            Apply Filter
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
    padding: tokens.spacing.base,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    gap: tokens.spacing.sm,
  },
  summaryBox: {},
  summaryTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  summarySub: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
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
  notificationCard: {
    padding: tokens.spacing.base,
  },
  unreadNotificationCard: {
    borderColor: tokens.colors.primaryBorderSubtle,
    backgroundColor: 'rgba(22, 22, 32, 0.9)',
  },
  messageText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    color: tokens.colors.textPrimary,
    lineHeight: 20,
    marginTop: 8,
  },
  unreadMessageText: {
    color: tokens.colors.text,
    fontWeight: '600',
  },
  eventTypeText: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: tokens.colors.textSubtle,
    marginTop: 4,
  },
  metaTime: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
  },
  readBadgeText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
  },

  // Sheet
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
