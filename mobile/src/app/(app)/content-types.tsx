import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native';
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  Calendar,
} from 'lucide-react-native';
import { useContentTypesQuery } from '../../hooks/queries/useContentTypesQuery';
import {
  useCreateContentTypeMutation,
  useUpdateContentTypeMutation,
  useDeleteContentTypeMutation,
} from '../../hooks/mutations/useContentTypeMutations';
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
import { formatDateTime } from '../../lib/format';
import { ContentType, ContentTypeStatus } from '../../types/domain';

export default function ContentTypesScreen() {
  const toast = useToast();
  const {
    data: contentTypes = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useContentTypesQuery();

  const createMutation = useCreateContentTypeMutation();
  const updateMutation = useUpdateContentTypeMutation();
  const deleteMutation = useDeleteContentTypeMutation();

  // Create sheet state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createStatus, setCreateStatus] = useState<ContentTypeStatus>('Active');

  // Edit sheet state
  const [editingType, setEditingType] = useState<ContentType | null>(null);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState<ContentTypeStatus>('Active');

  // Delete dialog state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setCreateName('');
    setCreateStatus('Active');
    setIsCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      toast.error('Content type name is required');
      return;
    }
    await createMutation.mutateAsync({
      name: createName.trim(),
      status: createStatus,
    });
    setIsCreateOpen(false);
  };

  const handleOpenEdit = (item: ContentType) => {
    setEditingType(item);
    setEditName(item.name);
    setEditStatus(item.status);
  };

  const handleUpdate = async () => {
    if (!editingType) return;
    if (!editName.trim()) {
      toast.error('Content type name is required');
      return;
    }
    await updateMutation.mutateAsync({
      id: editingType.id,
      params: {
        name: editName.trim(),
        status: editStatus,
      },
    });
    setEditingType(null);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await deleteMutation.mutateAsync(deletingId);
    setDeletingId(null);
    setEditingType(null);
  };

  return (
    <View style={styles.container}>
      {/* Header action bar */}
      <View style={styles.toolbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Content Types</Text>
          <Text style={styles.pageSubtitle}>
            Define taxonomy and formats for generated short-form content
          </Text>
        </View>
        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onPress={handleOpenCreate}
        >
          New Type
        </Button>
      </View>

      {isError ? (
        <View style={styles.centerContainer}>
          <ErrorState
            title="Failed to load content types"
            message={(error as any)?.message}
            onRetry={refetch}
            onRefresh={refetch}
          />
        </View>
      ) : isLoading ? (
        <View style={{ padding: tokens.spacing.base }}>
          <SkeletonList count={3} />
        </View>
      ) : contentTypes.length === 0 ? (
        <View style={styles.centerContainer}>
          <EmptyState
            icon={FileText}
            title="No Content Types"
            description="Create categories like ShortQuote, Analogy, or TerminalSnippet to classify generation."
            actionLabel="Create Content Type"
            onAction={handleOpenCreate}
          />
        </View>
      ) : (
        <FlatList
          data={contentTypes}
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
                  <FileText size={18} color={tokens.colors.primaryLight} />
                </View>

                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.typeName}>{item.name}</Text>
                  <Text style={styles.createdDate}>
                    Added {formatDateTime(item.createdAt)}
                  </Text>
                </View>

                <Badge
                  label={item.status}
                  variant={item.status === 'Active' ? 'success' : 'neutral'}
                  size="sm"
                />
              </View>
            </Card>
          )}
        />
      )}

      {/* CREATE SHEET */}
      <Sheet
        visible={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Content Type"
        subtitle="Define a new category for content profiles and prompts"
      >
        <View style={styles.sheetForm}>
          <Field
            label="Name"
            value={createName}
            onChangeText={setCreateName}
            placeholder="e.g. CodeAnalogy"
            required
          />

          <Text style={styles.sheetLabel}>Status</Text>
          <View style={styles.chipsRow}>
            {(['Active', 'Disabled'] as ContentTypeStatus[]).map((st) => (
              <Pressable
                key={st}
                onPress={() => setCreateStatus(st)}
                style={[
                  styles.optionChip,
                  createStatus === st && styles.optionChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    createStatus === st && styles.optionChipTextSelected,
                  ]}
                >
                  {st}
                </Text>
              </Pressable>
            ))}
          </View>

          <Button
            variant="primary"
            size="md"
            isLoading={createMutation.isPending}
            loadingText="Creating..."
            onPress={handleCreate}
            style={{ marginTop: tokens.spacing.lg }}
          >
            Create Content Type
          </Button>
        </View>
      </Sheet>

      {/* EDIT SHEET */}
      <Sheet
        visible={Boolean(editingType)}
        onClose={() => setEditingType(null)}
        title="Edit Content Type"
        subtitle="Update name or toggle availability"
      >
        <View style={styles.sheetForm}>
          <Field
            label="Name"
            value={editName}
            onChangeText={setEditName}
            placeholder="e.g. CodeAnalogy"
            required
          />

          <Text style={styles.sheetLabel}>Status</Text>
          <View style={styles.chipsRow}>
            {(['Active', 'Disabled'] as ContentTypeStatus[]).map((st) => (
              <Pressable
                key={st}
                onPress={() => setEditStatus(st)}
                style={[
                  styles.optionChip,
                  editStatus === st && styles.optionChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    editStatus === st && styles.optionChipTextSelected,
                  ]}
                >
                  {st}
                </Text>
              </Pressable>
            ))}
          </View>

          <Button
            variant="primary"
            size="md"
            isLoading={updateMutation.isPending}
            loadingText="Saving..."
            onPress={handleUpdate}
            style={{ marginTop: tokens.spacing.lg }}
          >
            Save Changes
          </Button>

          <Button
            variant="ghost"
            size="md"
            icon={Trash2}
            onPress={() => {
              if (editingType) setDeletingId(editingType.id);
            }}
            textStyle={{ color: tokens.colors.destructiveLight }}
            style={{ marginTop: tokens.spacing.sm }}
          >
            Delete Content Type
          </Button>
        </View>
      </Sheet>

      {/* DELETE CONFIRM DIALOG */}
      <ConfirmDialog
        visible={Boolean(deletingId)}
        title="Delete Content Type"
        message="Are you sure you want to delete this content type? Content profiles using this type may be affected."
        confirmLabel="Delete"
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
    alignItems: 'center',
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
  },
  typeName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  createdDate: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
    marginTop: 2,
  },
  sheetForm: {
    gap: tokens.spacing.xs,
    paddingBottom: tokens.spacing.xl,
  },
  sheetLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
    marginBottom: 6,
    marginTop: tokens.spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  optionChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
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
