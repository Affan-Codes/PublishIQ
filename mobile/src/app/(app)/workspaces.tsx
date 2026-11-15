import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
} from 'react-native';
import {
  Building,
  Plus,
  Trash2,
  Calendar,
} from 'lucide-react-native';
import { useWorkspacesQuery } from '../../hooks/queries/useWorkspacesQuery';
import {
  useCreateWorkspaceMutation,
  useUpdateWorkspaceMutation,
  useDeleteWorkspaceMutation,
} from '../../hooks/mutations/useWorkspaceMutations';
import { useToast } from '../../providers/ToastProvider';
import { tokens } from '../../design/tokens';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import { Field } from '../../components/ui/Field';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { formatDateTime } from '../../lib/format';
import { Workspace } from '../../types/domain';

export default function WorkspacesScreen() {
  const toast = useToast();
  const {
    data: workspaces = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useWorkspacesQuery();

  const createMutation = useCreateWorkspaceMutation();
  const updateMutation = useUpdateWorkspaceMutation();
  const deleteMutation = useDeleteWorkspaceMutation();

  // Create sheet state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');

  // Edit sheet state
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [editName, setEditName] = useState('');

  // Delete dialog state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setCreateName('');
    setIsCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      toast.error('Workspace name is required');
      return;
    }
    await createMutation.mutateAsync({
      name: createName.trim(),
    });
    setIsCreateOpen(false);
  };

  const handleOpenEdit = (item: Workspace) => {
    setEditingWorkspace(item);
    setEditName(item.name);
  };

  const handleUpdate = async () => {
    if (!editingWorkspace) return;
    if (!editName.trim()) {
      toast.error('Workspace name is required');
      return;
    }
    await updateMutation.mutateAsync({
      id: editingWorkspace.id,
      params: {
        name: editName.trim(),
      },
    });
    setEditingWorkspace(null);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await deleteMutation.mutateAsync(deletingId);
    setDeletingId(null);
    setEditingWorkspace(null);
  };

  return (
    <View style={styles.container}>
      {/* Header action bar */}
      <View style={styles.toolbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Workspaces</Text>
          <Text style={styles.pageSubtitle}>
            Manage organizational tenancy and resource isolation
          </Text>
        </View>
        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onPress={handleOpenCreate}
        >
          New Workspace
        </Button>
      </View>

      {isError ? (
        <View style={styles.centerContainer}>
          <ErrorState
            title="Failed to load workspaces"
            message={(error as any)?.message}
            onRetry={refetch}
            onRefresh={refetch}
          />
        </View>
      ) : isLoading ? (
        <View style={{ padding: tokens.spacing.base }}>
          <SkeletonList count={3} />
        </View>
      ) : workspaces.length === 0 ? (
        <View style={styles.centerContainer}>
          <EmptyState
            icon={Building}
            title="No Workspaces"
            description="Create an isolated workspace environment for channels, templates, and assets."
            actionLabel="Create Workspace"
            onAction={handleOpenCreate}
          />
        </View>
      ) : (
        <FlatList
          data={workspaces}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <Card
              style={styles.card}
              onPress={() => handleOpenEdit(item)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.iconBox}>
                  <Building size={18} color={tokens.colors.primaryLight} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.workspaceName}>{item.name}</Text>
                  <Text style={styles.workspaceId}>ID: {item.id}</Text>
                  <View style={styles.dateRow}>
                    <Calendar size={12} color={tokens.colors.textSubtle} />
                    <Text style={styles.dateText}>
                      Created {formatDateTime(item.createdAt)}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      {/* CREATE SHEET */}
      <Sheet
        visible={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Workspace"
        subtitle="Establish an isolated publishing boundary"
      >
        <View style={styles.sheetForm}>
          <Field
            label="Workspace Name"
            value={createName}
            onChangeText={setCreateName}
            placeholder="e.g. Production Operations"
            required
          />

          <Button
            variant="primary"
            size="md"
            isLoading={createMutation.isPending}
            loadingText="Creating..."
            onPress={handleCreate}
            style={{ marginTop: tokens.spacing.md }}
          >
            Create Workspace
          </Button>
        </View>
      </Sheet>

      {/* EDIT SHEET */}
      <Sheet
        visible={Boolean(editingWorkspace)}
        onClose={() => setEditingWorkspace(null)}
        title="Edit Workspace"
        subtitle="Update workspace identifier name"
      >
        <View style={styles.sheetForm}>
          <Field
            label="Workspace Name"
            value={editName}
            onChangeText={setEditName}
            placeholder="e.g. Production Operations"
            required
          />

          <Button
            variant="primary"
            size="md"
            isLoading={updateMutation.isPending}
            loadingText="Saving..."
            onPress={handleUpdate}
            style={{ marginTop: tokens.spacing.md }}
          >
            Save Changes
          </Button>

          <Button
            variant="ghost"
            size="md"
            icon={Trash2}
            onPress={() => {
              if (editingWorkspace) setDeletingId(editingWorkspace.id);
            }}
            textStyle={{ color: tokens.colors.destructiveLight }}
            style={{ marginTop: tokens.spacing.sm }}
          >
            Delete Workspace
          </Button>
        </View>
      </Sheet>

      {/* DELETE CONFIRM DIALOG */}
      <ConfirmDialog
        visible={Boolean(deletingId)}
        title="Delete Workspace"
        message="Are you sure you want to delete this workspace? All channels, profiles, and media records within it will be permanently lost."
        confirmLabel="Delete Workspace"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
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
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.input,
    backgroundColor: tokens.colors.primaryBgSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.primaryBorderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.md,
    marginTop: 2,
  },
  workspaceName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  workspaceId: {
    fontFamily: tokens.typography.mono.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
    marginTop: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  dateText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textMuted,
  },
  sheetForm: {
    gap: tokens.spacing.xs,
    paddingBottom: tokens.spacing.xl,
  },
});
