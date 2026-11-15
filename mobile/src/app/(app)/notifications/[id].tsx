import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  CheckCircle,
  Trash2,
  Calendar,
  Layers,
  Code,
} from 'lucide-react-native';
import { useNotificationDetailQuery } from '../../../hooks/queries/useNotificationDetailQuery';
import {
  useMarkNotificationReadMutation,
  useDeleteNotificationMutation,
} from '../../../hooks/mutations/useNotificationMutations';
import { tokens } from '../../../design/tokens';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ErrorState } from '../../../components/ui/ErrorState';
import { SkeletonRows } from '../../../components/ui/Skeleton';
import {
  getNotificationSeverity,
  getNotificationSeverityStyle,
} from '../../../lib/status';
import { formatDateTime } from '../../../lib/format';

export default function NotificationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    data: notification,
    isLoading,
    isError,
    error,
    refetch,
  } = useNotificationDetailQuery(id || '');

  const markReadMutation = useMarkNotificationReadMutation();
  const deleteMutation = useDeleteNotificationMutation();

  const isUnread = !notification?.readAt;
  const eventType = notification?.domainEvent?.type || 'System Event';
  const severity = getNotificationSeverity(eventType);
  const severityStyle = getNotificationSeverityStyle(severity);

  const handleMarkRead = async () => {
    if (!id || !isUnread) return;
    await markReadMutation.mutateAsync(id);
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteMutation.mutateAsync(id);
    setIsDeleteDialogOpen(false);
    router.back();
  };

  if (isError) {
    return (
      <View style={styles.centerContainer}>
        <ErrorState
          title="Failed to load alert details"
          message={(error as any)?.message}
          onRetry={refetch}
          onRefresh={refetch}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          hitSlop={tokens.hitSlop}
          style={styles.backButton}
        >
          <ArrowLeft size={20} color={tokens.colors.text} />
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>
          Alert Details
        </Text>
      </View>

      {isLoading ? (
        <View style={{ padding: tokens.spacing.base }}>
          <SkeletonRows rows={4} />
        </View>
      ) : notification ? (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Status and Severity Badges */}
          <View style={styles.badgeRow}>
            <Badge
              label={severityStyle.label}
              bg={severityStyle.bg}
              border={severityStyle.border}
              textColor={severityStyle.text}
              size="sm"
            />
            <Badge
              label={eventType}
              variant="neutral"
              size="sm"
            />
            <Badge
              label={isUnread ? 'Unread' : 'Read'}
              variant={isUnread ? 'warning' : 'success'}
              size="sm"
            />
          </View>

          {/* Primary Message Card */}
          <Card style={styles.messageCard}>
            <View style={styles.iconTitleRow}>
              <Bell size={20} color={tokens.colors.primaryLight} />
              <Text style={styles.messageTitle}>Message</Text>
            </View>
            <Text style={styles.messageBody}>{notification.message}</Text>
          </Card>

          {/* Event & Pipeline Metadata */}
          <Card style={styles.metaCard}>
            <View style={styles.metaRow}>
              <View style={styles.metaLabelGroup}>
                <Calendar size={14} color={tokens.colors.textSubtle} />
                <Text style={styles.metaLabel}>Occurred At</Text>
              </View>
              <Text style={styles.metaValue}>
                {formatDateTime(notification.createdAt)}
              </Text>
            </View>

            {notification.readAt && (
              <>
                <View style={styles.divider} />
                <View style={styles.metaRow}>
                  <View style={styles.metaLabelGroup}>
                    <CheckCircle size={14} color={tokens.colors.successLight} />
                    <Text style={styles.metaLabel}>Read At</Text>
                  </View>
                  <Text style={styles.metaValue}>
                    {formatDateTime(notification.readAt)}
                  </Text>
                </View>
              </>
            )}

            {notification.domainEvent?.jobId && (
              <>
                <View style={styles.divider} />
                <View style={styles.metaRow}>
                  <View style={styles.metaLabelGroup}>
                    <Layers size={14} color={tokens.colors.textSubtle} />
                    <Text style={styles.metaLabel}>Associated Job</Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      router.push(`/(app)/jobs/${notification.domainEvent!.jobId}` as any)
                    }
                  >
                    <Text style={styles.linkText} numberOfLines={1}>
                      {notification.domainEvent.jobId}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </Card>

          {/* Domain Event Payload (if available) */}
          {notification.domainEvent?.payload &&
            Object.keys(notification.domainEvent.payload).length > 0 && (
              <Card style={styles.payloadCard}>
                <View style={styles.iconTitleRow}>
                  <Code size={18} color={tokens.colors.primaryLighter} />
                  <Text style={styles.payloadTitle}>Event Payload</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Text style={styles.payloadMono}>
                    {JSON.stringify(notification.domainEvent.payload, null, 2)}
                  </Text>
                </ScrollView>
              </Card>
            )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {isUnread && (
              <Button
                variant="secondary"
                size="md"
                icon={CheckCircle}
                isLoading={markReadMutation.isPending}
                loadingText="Marking Read..."
                onPress={handleMarkRead}
              >
                Mark as Read
              </Button>
            )}

            <Button
              variant="danger"
              size="md"
              icon={Trash2}
              onPress={() => setIsDeleteDialogOpen(true)}
            >
              Delete Alert
            </Button>
          </View>
        </ScrollView>
      ) : null}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={isDeleteDialogOpen}
        title="Delete Alert"
        message="Are you sure you want to delete this alert? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bgApp,
  },
  centerContainer: {
    flex: 1,
    padding: tokens.spacing.xl,
    justifyContent: 'center',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.base,
    paddingVertical: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    gap: tokens.spacing.md,
  },
  backButton: {
    padding: tokens.spacing.xs,
  },
  navTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  content: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.md,
    paddingBottom: tokens.spacing.huge,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  messageCard: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.sm,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  messageTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  messageBody: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    color: tokens.colors.textPrimary,
  },
  metaCard: {
    padding: tokens.spacing.base,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  metaLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.textSubtle,
  },
  metaValue: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.textMuted,
  },
  linkText: {
    fontFamily: tokens.typography.mono.fontFamily,
    fontSize: 12,
    color: tokens.colors.primaryLight,
    textDecorationLine: 'underline',
  },
  divider: {
    height: 1,
    backgroundColor: tokens.colors.border,
    marginVertical: tokens.spacing.sm,
  },
  payloadCard: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.sm,
  },
  payloadTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  payloadMono: {
    fontFamily: tokens.typography.mono.fontFamily,
    fontSize: 11,
    lineHeight: 16,
    color: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.surfaceRaised,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.input,
  },
  actionsContainer: {
    marginTop: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
});
