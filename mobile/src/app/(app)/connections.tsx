import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Share2,
  Video,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Power,
} from 'lucide-react-native';
import { useConnectionsQuery } from '../../hooks/queries/useConnectionsQuery';
import { updateConnection, deleteConnection } from '../../api/endpoints/connections';
import { connectYouTube } from '../../lib/oauth';
import { useAuth } from '../../providers/AuthProvider';
import { useToast } from '../../providers/ToastProvider';
import { tokens } from '../../design/tokens';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import { Field } from '../../components/ui/Field';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { getConnectionHealthStatus, getConnectionStatus } from '../../lib/status';
import { formatDateTime } from '../../lib/format';
import { PlatformConnection, ConnectionStatus } from '../../types/domain';

export default function ConnectionsScreen() {
  const queryClient = useQueryClient();
  const { operator, hasRole } = useAuth();
  const toast = useToast();

  const isOperatorPrivileged = hasRole(['Owner', 'Administrator']);

  const {
    data: connections = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useConnectionsQuery();

  // Rename modal state
  const [editingConnection, setEditingConnection] = useState<PlatformConnection | null>(null);
  const [renameText, setRenameText] = useState('');

  // Delete dialog state
  const [deletingConnectionId, setDeletingConnectionId] = useState<string | null>(null);

  // Help info sheet
  const [helpMessage, setHelpMessage] = useState<string | null>(null);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      params,
    }: {
      id: string;
      params: { displayName?: string; status?: ConnectionStatus };
    }) => updateConnection(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-connections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Connection updated successfully');
      setEditingConnection(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update connection');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-connections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Platform connection removed');
      setDeletingConnectionId(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete connection');
    },
  });

  const handleConnectYouTube = async () => {
    if (!isOperatorPrivileged) {
      toast.error('Only Workspace Owners and Administrators can connect platforms');
      return;
    }

    await connectYouTube({
      queryClient,
      userRole: operator?.role,
      onToast: (type, msg) => {
        if (type === 'success') toast.success(msg);
        else if (type === 'error') toast.error(msg);
        else toast.info(msg);
      },
      onHelp: (msg) => setHelpMessage(msg),
    });
  };

  const handleOpenRename = (item: PlatformConnection) => {
    setEditingConnection(item);
    setRenameText(item.displayName || '');
  };

  const handleSaveRename = async () => {
    if (!editingConnection) return;
    await updateMutation.mutateAsync({
      id: editingConnection.id,
      params: { displayName: renameText.trim() || undefined },
    });
  };

  const handleToggleStatus = async (item: PlatformConnection) => {
    const nextStatus: ConnectionStatus = item.status === 'Active' ? 'Disabled' : 'Active';
    await updateMutation.mutateAsync({
      id: item.id,
      params: { status: nextStatus },
    });
  };

  const handleDelete = async () => {
    if (!deletingConnectionId) return;
    await deleteMutation.mutateAsync(deletingConnectionId);
  };

  return (
    <View style={styles.container}>
      {/* Header action bar */}
      <View style={styles.toolbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Platform Connections</Text>
          <Text style={styles.pageSubtitle}>
            Publishing integrations authorized via OAuth 2.0
          </Text>
        </View>

        {isOperatorPrivileged && (
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onPress={handleConnectYouTube}
          >
            Connect YouTube
          </Button>
        )}
      </View>

      {isError ? (
        <View style={styles.centerContainer}>
          <ErrorState
            title="Failed to load connections"
            message={(error as any)?.message}
            onRetry={refetch}
            onRefresh={refetch}
          />
        </View>
      ) : isLoading ? (
        <View style={{ padding: tokens.spacing.base }}>
          <SkeletonList count={3} />
        </View>
      ) : connections.length === 0 ? (
        <View style={styles.centerContainer}>
          <EmptyState
            icon={Share2}
            title="No Platform Connections"
            description="Authorize YouTube to enable automated video and short-form publishing."
            actionLabel={isOperatorPrivileged ? 'Connect YouTube Channel' : undefined}
            onAction={isOperatorPrivileged ? handleConnectYouTube : undefined}
          />
        </View>
      ) : (
        <FlatList
          data={connections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => {
            const health = getConnectionHealthStatus(item.healthStatus);
            const status = getConnectionStatus(item.status);

            return (
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.platformIconBox}>
                    <Video size={20} color={tokens.colors.primaryLight} />
                  </View>

                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.displayName}>
                      {item.displayName || item.platform}
                    </Text>
                    <Text style={styles.platformName}>
                      {item.platform} {item.externalAccountId ? `• ${item.externalAccountId}` : ''}
                    </Text>
                  </View>

                  <View style={styles.badgeColumn}>
                    <Badge
                      label={health.label}
                      bg={health.bg}
                      border={health.border}
                      textColor={health.text}
                      size="sm"
                    />
                    <Badge
                      label={status.label}
                      bg={status.bg}
                      border={status.border}
                      textColor={status.text}
                      size="sm"
                    />
                  </View>
                </View>

                {/* Details row */}
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Token Expiry:</Text>
                  <Text style={styles.metaValue}>{formatDateTime(item.expiresAt)}</Text>
                </View>

                {item.lastValidatedAt && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Last Validated:</Text>
                    <Text style={styles.metaValue}>{formatDateTime(item.lastValidatedAt)}</Text>
                  </View>
                )}

                {/* Privileged action buttons */}
                {isOperatorPrivileged && (
                  <View style={styles.actionsRow}>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Edit2}
                      onPress={() => handleOpenRename(item)}
                    >
                      Rename
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      icon={Power}
                      isLoading={updateMutation.isPending}
                      onPress={() => handleToggleStatus(item)}
                    >
                      {item.status === 'Active' ? 'Disable' : 'Enable'}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onPress={() => setDeletingConnectionId(item.id)}
                      textStyle={{ color: tokens.colors.destructiveLight }}
                    >
                      Disconnect
                    </Button>
                  </View>
                )}
              </Card>
            );
          }}
        />
      )}

      {/* RENAME SHEET */}
      <Sheet
        visible={Boolean(editingConnection)}
        onClose={() => setEditingConnection(null)}
        title="Rename Connection"
        subtitle="Give this connection a recognisable alias in PublishIQ"
      >
        <View style={styles.sheetForm}>
          <Field
            label="Display Name"
            value={renameText}
            onChangeText={setRenameText}
            placeholder="e.g. Main YouTube Channel"
          />

          <Button
            variant="primary"
            size="md"
            isLoading={updateMutation.isPending}
            loadingText="Saving..."
            onPress={handleSaveRename}
            style={{ marginTop: tokens.spacing.md }}
          >
            Save Display Name
          </Button>
        </View>
      </Sheet>

      {/* HELP SHEET */}
      <Sheet
        visible={Boolean(helpMessage)}
        onClose={() => setHelpMessage(null)}
        title="Connection Guidance"
      >
        <View style={styles.sheetForm}>
          <View style={styles.helpBox}>
            <HelpCircle size={22} color={tokens.colors.warningLight} />
            <Text style={styles.helpText}>{helpMessage}</Text>
          </View>
          <Button
            variant="secondary"
            size="sm"
            onPress={() => setHelpMessage(null)}
            style={{ marginTop: tokens.spacing.base }}
          >
            Dismiss
          </Button>
        </View>
      </Sheet>

      {/* DELETE CONFIRM DIALOG */}
      <ConfirmDialog
        visible={Boolean(deletingConnectionId)}
        title="Disconnect Platform"
        message="Are you sure you want to remove this connection? Channels tied to this connection will fail to publish."
        confirmLabel="Disconnect"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeletingConnectionId(null)}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  pageTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  pageSubtitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    padding: tokens.spacing.xl,
    justifyContent: 'center',
  },
  listContent: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.md,
  },
  card: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  platformIconBox: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.input,
    backgroundColor: tokens.colors.primaryBgSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.primaryBorderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.md,
  },
  displayName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  platformName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  badgeColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  metaLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textSubtle,
  },
  metaValue: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  sheetForm: {
    gap: tokens.spacing.sm,
    paddingBottom: tokens.spacing.lg,
  },
  helpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    backgroundColor: tokens.colors.warningBgSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.warningBorderSubtle,
    borderRadius: tokens.radius.input,
    padding: tokens.spacing.base,
  },
  helpText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
});
