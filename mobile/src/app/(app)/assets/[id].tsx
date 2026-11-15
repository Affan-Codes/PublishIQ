import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  FileText,
  Music,
  Image as ImageIcon,
  Type as FontIcon,
  Layers,
  Calendar,
  CheckCircle2,
  Clock,
  Code,
} from 'lucide-react-native';
import { useAssetDetailQuery } from '../../../hooks/queries/useAssetDetailQuery';
import { updateAsset, deleteAsset, UpdateAssetParams } from '../../../api/endpoints/assets';
import { useToast } from '../../../providers/ToastProvider';
import { tokens } from '../../../design/tokens';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Sheet } from '../../../components/ui/Sheet';
import { Field } from '../../../components/ui/Field';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ErrorState } from '../../../components/ui/ErrorState';
import { SkeletonRows } from '../../../components/ui/Skeleton';
import { getAssetStatus, getLicenseStatus } from '../../../lib/status';
import { formatDateTime, formatMediaUrl, formatDuration } from '../../../lib/format';
import { AssetStatus, LicenseStatus, AssetType } from '../../../types/domain';

export default function AssetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const {
    data: asset,
    isLoading,
    isError,
    error,
    refetch,
  } = useAssetDetailQuery(id || '');

  // Edit sheet state
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState<AssetStatus>('Active');
  const [editLicense, setEditLicense] = useState<LicenseStatus>('Unconfirmed');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');

  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (asset) {
      setEditName(asset.name);
      setEditStatus(asset.status);
      setEditLicense(asset.licenseStatus || 'Unconfirmed');
      const meta = asset.metadata as any;
      if (typeof meta?.startTime === 'number') {
        setEditStartTime(String(meta.startTime));
      }
      if (typeof meta?.endTime === 'number') {
        setEditEndTime(String(meta.endTime));
      }
    }
  }, [asset]);

  const updateMutation = useMutation({
    mutationFn: (params: UpdateAssetParams) => updateAsset(id || '', params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
      toast.success('Asset updated successfully');
      setIsEditSheetOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update asset');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAsset(id || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset deleted');
      setIsDeleteDialogOpen(false);
      router.back();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete asset');
    },
  });

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      toast.error('Asset name cannot be empty');
      return;
    }

    const params: UpdateAssetParams = {
      name: editName.trim(),
      status: editStatus,
      licenseStatus: editLicense,
    };

    if (asset?.type === 'Music') {
      const s = parseFloat(editStartTime);
      const e = parseFloat(editEndTime);
      if (!isNaN(s)) params.startTime = s;
      if (!isNaN(e)) params.endTime = e;
    }

    await updateMutation.mutateAsync(params);
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync();
  };

  const getAssetIcon = (type?: AssetType) => {
    switch (type) {
      case 'Music':
        return Music;
      case 'Font':
        return FontIcon;
      default:
        return ImageIcon;
    }
  };

  if (isError) {
    return (
      <View style={styles.centerContainer}>
        <ErrorState
          title="Failed to load asset details"
          message={(error as any)?.message}
          onRetry={refetch}
          onRefresh={refetch}
        />
      </View>
    );
  }

  const isImageGraphic =
    asset?.type === 'Background' ||
    asset?.type === 'Logo' ||
    asset?.type === 'Watermark' ||
    asset?.type === 'Icon';

  const fullMediaUrl = asset?.filePath ? formatMediaUrl(asset.filePath) : '';
  const IconComponent = getAssetIcon(asset?.type);
  const statusStyle = getAssetStatus(asset?.status);
  const licenseStyle = getLicenseStatus(asset?.licenseStatus);

  return (
    <View style={styles.container}>
      {/* Navigation Bar */}
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
          {asset?.name || 'Asset Details'}
        </Text>
      </View>

      {isLoading ? (
        <View style={{ padding: tokens.spacing.base }}>
          <SkeletonRows rows={4} />
        </View>
      ) : asset ? (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header Card */}
          <Card style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View style={styles.typeIconBox}>
                <IconComponent size={24} color={tokens.colors.primaryLight} />
              </View>

              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.assetName}>{asset.name}</Text>
                <Text style={styles.assetType}>{asset.type} Asset</Text>
              </View>

              <View style={styles.badgeColumn}>
                <Badge
                  label={statusStyle.label}
                  bg={statusStyle.bg}
                  border={statusStyle.border}
                  textColor={statusStyle.text}
                  size="sm"
                />
                <Badge
                  label={licenseStyle.label}
                  bg={licenseStyle.bg}
                  border={licenseStyle.border}
                  textColor={licenseStyle.text}
                  size="sm"
                />
              </View>
            </View>
          </Card>

          {/* Media Preview Section */}
          {isImageGraphic && fullMediaUrl ? (
            <Card style={styles.previewCard}>
              <Text style={styles.sectionHeading}>Image Preview</Text>
              <Image
                source={{ uri: fullMediaUrl }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </Card>
          ) : asset.type === 'Music' ? (
            <Card style={styles.audioPreviewCard}>
              <Music size={32} color={tokens.colors.primaryLight} />
              <Text style={styles.audioTitle}>Audio Track</Text>
              {typeof (asset.metadata as any)?.trimmedDuration === 'number' && (
                <Text style={styles.audioSubtitle}>
                  Trimmed Duration: {formatDuration((asset.metadata as any).trimmedDuration)}
                </Text>
              )}
            </Card>
          ) : null}

          {/* Details & File Path */}
          <Card style={styles.metaCard}>
            <Text style={styles.sectionHeading}>File & Storage</Text>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Storage Path</Text>
              <Text style={styles.monoValue} numberOfLines={2}>
                {asset.filePath}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.metaRow}>
              <View style={styles.iconLabel}>
                <Calendar size={14} color={tokens.colors.textSubtle} />
                <Text style={styles.metaLabel}>Uploaded At</Text>
              </View>
              <Text style={styles.metaValue}>{formatDateTime(asset.createdAt)}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.metaRow}>
              <View style={styles.iconLabel}>
                <Clock size={14} color={tokens.colors.textSubtle} />
                <Text style={styles.metaLabel}>Last Updated</Text>
              </View>
              <Text style={styles.metaValue}>{formatDateTime(asset.updatedAt)}</Text>
            </View>
          </Card>

          {/* Metadata Block */}
          {asset.metadata && Object.keys(asset.metadata).length > 0 && (
            <Card style={styles.metaCard}>
              <View style={styles.iconLabel}>
                <Code size={16} color={tokens.colors.primaryLighter} />
                <Text style={styles.sectionHeading}>Asset Metadata</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text style={styles.payloadMono}>
                  {JSON.stringify(asset.metadata, null, 2)}
                </Text>
              </ScrollView>
            </Card>
          )}

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <Button
              variant="secondary"
              size="md"
              icon={Edit2}
              onPress={() => setIsEditSheetOpen(true)}
            >
              Edit Asset Properties
            </Button>

            <Button
              variant="danger"
              size="md"
              icon={Trash2}
              onPress={() => setIsDeleteDialogOpen(true)}
            >
              Delete Asset
            </Button>
          </View>
        </ScrollView>
      ) : null}

      {/* Edit Sheet */}
      <Sheet
        visible={isEditSheetOpen}
        onClose={() => setIsEditSheetOpen(false)}
        title="Edit Asset"
        subtitle="Update asset metadata and licensing state"
      >
        <View style={styles.sheetForm}>
          <Field
            label="Asset Name"
            value={editName}
            onChangeText={setEditName}
            placeholder="e.g. Hero Background Image"
            required
          />

          <Text style={styles.sheetSectionLabel}>Status</Text>
          <View style={styles.chipsRow}>
            {(['Active', 'Disabled'] as AssetStatus[]).map((st) => (
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

          <Text style={[styles.sheetSectionLabel, { marginTop: tokens.spacing.md }]}>
            License Status
          </Text>
          <View style={styles.chipsRow}>
            {(['Confirmed', 'Unconfirmed'] as LicenseStatus[]).map((ls) => (
              <Pressable
                key={ls}
                onPress={() => setEditLicense(ls)}
                style={[
                  styles.optionChip,
                  editLicense === ls && styles.optionChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    editLicense === ls && styles.optionChipTextSelected,
                  ]}
                >
                  {ls}
                </Text>
              </Pressable>
            ))}
          </View>

          {asset?.type === 'Music' && (
            <View style={{ marginTop: tokens.spacing.md }}>
              <Field
                label="Start Time (seconds)"
                value={editStartTime}
                onChangeText={setEditStartTime}
                keyboardType="numeric"
                placeholder="0"
              />
              <Field
                label="End Time (seconds)"
                value={editEndTime}
                onChangeText={setEditEndTime}
                keyboardType="numeric"
                placeholder="60"
              />
            </View>
          )}

          <Button
            variant="primary"
            size="md"
            isLoading={updateMutation.isPending}
            loadingText="Saving..."
            onPress={handleSaveEdit}
            style={{ marginTop: tokens.spacing.lg }}
          >
            Save Changes
          </Button>
        </View>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={isDeleteDialogOpen}
        title="Delete Asset"
        message="Are you sure you want to permanently delete this asset from storage? Active templates and pipelines relying on it may fail."
        confirmLabel="Delete Asset"
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
    flex: 1,
  },
  content: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.md,
    paddingBottom: tokens.spacing.huge,
  },
  headerCard: {
    padding: tokens.spacing.base,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIconBox: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.input,
    backgroundColor: tokens.colors.primaryBgSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.primaryBorderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.md,
  },
  assetName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  assetType: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  badgeColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  previewCard: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.sm,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: tokens.radius.input,
    backgroundColor: tokens.colors.surfaceRaised,
  },
  audioPreviewCard: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
  },
  audioTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
    marginTop: tokens.spacing.xs,
  },
  audioSubtitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  sectionHeading: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.text,
    marginBottom: tokens.spacing.xs,
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
  iconLabel: {
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
  monoValue: {
    fontFamily: tokens.typography.mono.fontFamily,
    fontSize: 11,
    color: tokens.colors.primaryLighter,
    maxWidth: '60%',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: tokens.colors.border,
    marginVertical: tokens.spacing.sm,
  },
  payloadMono: {
    fontFamily: tokens.typography.mono.fontFamily,
    fontSize: 11,
    lineHeight: 16,
    color: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.surfaceRaised,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.input,
    marginTop: tokens.spacing.xs,
  },
  actionsContainer: {
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
  },
  sheetForm: {
    gap: tokens.spacing.xs,
    paddingBottom: tokens.spacing.xl,
  },
  sheetSectionLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
    marginBottom: 6,
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
