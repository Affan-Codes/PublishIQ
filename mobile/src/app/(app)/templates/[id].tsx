import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import {
  Layout,
  RotateCcw,
  Calendar,
  Clock,
  FileCode,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
} from 'lucide-react-native';
import { useTemplateDetailQuery } from '../../../hooks/queries/useTemplateDetailQuery';
import { useTemplatePreviewQuery } from '../../../hooks/queries/useTemplatePreviewQuery';
import { useRollbackTemplateMutation } from '../../../hooks/mutations/useTemplateMutations';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { tokens } from '../../../design/tokens';
import { formatDateTime, formatMediaUrl } from '../../../lib/format';
import { getStatusBadge } from '../../../lib/status';
import { TemplateVersion } from '../../../types/domain';

interface TemplateVersionCardProps {
  templateId: string;
  version: TemplateVersion;
  isRollingBack: boolean;
  onRollback: (version: TemplateVersion) => void;
}

function TemplateVersionCard({
  templateId,
  version,
  isRollingBack,
  onRollback,
}: TemplateVersionCardProps) {
  const [isDefinitionOpen, setIsDefinitionOpen] = useState(false);

  // Version preview query hook
  const { data: previewData, isLoading: isPreviewLoading } = useTemplatePreviewQuery(
    templateId,
    version.versionNumber
  );

  const isActive = version.status === 'Active';
  const previewUrl = previewData?.previewImageUrl || version.previewImageUrl;

  const versionStatusVariant =
    version.status === 'Active'
      ? 'success'
      : version.status === 'Deprecated'
      ? 'warning'
      : 'neutral';

  return (
    <Card style={[styles.versionCard, isActive && styles.activeVersionCard]}>
      {/* Version Header */}
      <View style={styles.versionHeader}>
        <View style={styles.versionHeaderLeft}>
          <Text style={styles.versionNumber}>Version {version.versionNumber}</Text>
          <Badge
            label={version.status}
            variant={versionStatusVariant}
            size="sm"
          />
          {version.category ? (
            <Badge
              label={version.category}
              variant="neutral"
              size="sm"
            />
          ) : null}
        </View>
        <Text style={styles.versionDate}>{formatDateTime(version.createdAt)}</Text>
      </View>

      {/* Version Notes */}
      {version.notes ? (
        <Text style={styles.versionNotes}>{version.notes}</Text>
      ) : null}

      {/* Version Preview Section */}
      <View style={styles.previewSection}>
        <View style={styles.previewHeaderRow}>
          <ImageIcon size={14} color={tokens.colors.primaryLight} />
          <Text style={styles.previewSectionTitle}>Version Preview Render</Text>
        </View>

        {isPreviewLoading ? (
          <View style={styles.previewSkeleton}>
            <Skeleton width="100%" height={220} borderRadius={tokens.radius.input} />
          </View>
        ) : previewUrl ? (
          <View style={styles.previewImageContainer}>
            <Image
              source={{ uri: formatMediaUrl(previewUrl) }}
              style={styles.previewImage}
              contentFit="cover"
              transition={200}
              accessibilityLabel={`Preview poster for Template Version ${version.versionNumber}`}
            />
          </View>
        ) : (
          <View style={styles.noPreviewContainer}>
            <Layout size={24} color={tokens.colors.textSubtle} />
            <Text style={styles.noPreviewText}>No preview render available</Text>
          </View>
        )}
      </View>

      {/* Read-only Collapsible Monospace Definition View */}
      <View style={styles.definitionContainer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Toggle JSON definition for version ${version.versionNumber}`}
          onPress={() => setIsDefinitionOpen(!isDefinitionOpen)}
          style={styles.definitionHeader}
        >
          <View style={styles.definitionHeaderLeft}>
            <FileCode size={15} color={tokens.colors.primaryLight} />
            <Text style={styles.definitionHeaderTitle}>Layout Definition (JSON)</Text>
          </View>
          {isDefinitionOpen ? (
            <ChevronUp size={16} color={tokens.colors.textSubtle} />
          ) : (
            <ChevronDown size={16} color={tokens.colors.textSubtle} />
          )}
        </Pressable>

        {isDefinitionOpen ? (
          <View style={styles.definitionBody}>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator
              contentContainerStyle={styles.definitionScrollContent}
            >
              <Text selectable style={styles.monospaceCode}>
                {JSON.stringify(version.definition || {}, null, 2)}
              </Text>
            </ScrollView>
          </View>
        ) : null}
      </View>

      {/* Rollback / Activation Action */}
      {!isActive ? (
        <View style={styles.versionFooter}>
          <Button
            size="sm"
            variant="secondary"
            icon={RotateCcw}
            isLoading={isRollingBack}
            loadingText="Activating..."
            onPress={() => onRollback(version)}
          >
            Rollback to Version {version.versionNumber}
          </Button>
        </View>
      ) : null}
    </Card>
  );
}

export default function TemplateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [rollbackTarget, setRollbackTarget] = useState<TemplateVersion | null>(null);

  const {
    data: template,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useTemplateDetailQuery(id);

  const rollbackMutation = useRollbackTemplateMutation();

  const handleConfirmRollback = () => {
    if (!rollbackTarget) return;
    rollbackMutation.mutate(
      { id, versionNumber: rollbackTarget.versionNumber },
      {
        onSuccess: () => {
          setRollbackTarget(null);
        },
      }
    );
  };

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <ErrorState
          title="Failed to load template"
          message={(error as any)?.message}
          onRetry={refetch}
          onRefresh={refetch}
        />
      </View>
    );
  }

  if (isLoading || !template) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Detail + version preview skeleton */}
        <Card style={styles.skeletonOverviewCard}>
          <View style={styles.rowBetween}>
            <Skeleton width={180} height={22} />
            <Skeleton width={70} height={22} borderRadius={tokens.radius.pill} />
          </View>
          <Skeleton width="85%" height={14} style={{ marginTop: 12 }} />
          <View style={[styles.rowBetween, { marginTop: 16 }]}>
            <Skeleton width={130} height={12} />
            <Skeleton width={130} height={12} />
          </View>
        </Card>

        <Card style={styles.skeletonVersionCard}>
          <View style={styles.rowBetween}>
            <Skeleton width={120} height={16} />
            <Skeleton width={90} height={12} />
          </View>
          <Skeleton
            width="100%"
            height={200}
            borderRadius={tokens.radius.input}
            style={{ marginTop: 14 }}
          />
          <Skeleton
            width="100%"
            height={44}
            borderRadius={tokens.radius.input}
            style={{ marginTop: 12 }}
          />
        </Card>
      </ScrollView>
    );
  }

  const statusBadge = getStatusBadge(template.status);
  const versions = template.versions || [];

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
      {/* Template Overview Card */}
      <Card style={styles.overviewCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.templateTitle}>{template.name}</Text>
          <Badge
            label={statusBadge.label}
            variant={statusBadge.variant}
            size="md"
          />
        </View>

        {template.notes ? (
          <Text style={styles.templateNotes}>{template.notes}</Text>
        ) : null}

        {/* Created / Updated Timestamps */}
        <View style={styles.timestampRow}>
          <View style={styles.timestampItem}>
            <Calendar size={13} color={tokens.colors.textSubtle} />
            <Text style={styles.timestampText}>
              Created: {formatDateTime(template.createdAt)}
            </Text>
          </View>
          <View style={styles.timestampItem}>
            <Clock size={13} color={tokens.colors.textSubtle} />
            <Text style={styles.timestampText}>
              Updated: {formatDateTime(template.updatedAt)}
            </Text>
          </View>
        </View>
      </Card>

      {/* Versions List Section Header */}
      <View style={styles.sectionHeaderArea}>
        <Text style={styles.sectionTitle}>Template Versions & Revisions</Text>
        <Text style={styles.sectionSubtitle}>
          {versions.length} {versions.length === 1 ? 'version' : 'versions'} deployed
        </Text>
      </View>

      {/* Versions List */}
      {versions.map((ver) => (
        <TemplateVersionCard
          key={ver.id}
          templateId={id}
          version={ver}
          isRollingBack={rollbackMutation.isPending && rollbackTarget?.id === ver.id}
          onRollback={setRollbackTarget}
        />
      ))}

      {/* Rollback Confirmation Dialog */}
      <ConfirmDialog
        visible={Boolean(rollbackTarget)}
        title={`Rollback to Version ${rollbackTarget?.versionNumber}`}
        message={`Are you sure you want to activate Template Version ${rollbackTarget?.versionNumber}? Content profiles referencing this template will render video outputs with this layout definition.`}
        confirmLabel={`Activate Version ${rollbackTarget?.versionNumber}`}
        cancelLabel="Cancel"
        variant="primary"
        isLoading={rollbackMutation.isPending}
        onConfirm={handleConfirmRollback}
        onCancel={() => setRollbackTarget(null)}
      />
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
    paddingBottom: 48,
  },
  errorContainer: {
    flex: 1,
    padding: tokens.spacing.xl,
    justifyContent: 'center',
    backgroundColor: tokens.colors.bgApp,
  },
  skeletonOverviewCard: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.xs,
  },
  skeletonVersionCard: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.xs,
  },
  overviewCard: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  templateTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.text,
    flex: 1,
    paddingRight: 10,
  },
  templateNotes: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.textMuted,
    lineHeight: 18,
  },
  timestampRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: tokens.spacing.sm,
  },
  timestampItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timestampText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
  },
  sectionHeaderArea: {
    marginTop: 4,
    gap: 2,
  },
  sectionTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  sectionSubtitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textSubtle,
  },
  versionCard: {
    padding: tokens.spacing.base,
    gap: 14,
  },
  activeVersionCard: {
    borderColor: tokens.colors.primaryBorderSubtle,
    backgroundColor: tokens.colors.surfaceRaised,
  },
  versionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  versionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  versionNumber: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  versionDate: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
  },
  versionNotes: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    lineHeight: 16,
  },
  previewSection: {
    gap: 8,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewSectionTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.textMuted,
  },
  previewSkeleton: {
    width: '100%',
    height: 220,
  },
  previewImageContainer: {
    width: '100%',
    height: 220,
    borderRadius: tokens.radius.input,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  noPreviewContainer: {
    height: 120,
    borderRadius: tokens.radius.input,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  noPreviewText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textSubtle,
  },
  definitionContainer: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.input,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
  },
  definitionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
  },
  definitionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  definitionHeaderTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  definitionBody: {
    padding: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.bgApp,
  },
  definitionScrollContent: {
    paddingRight: tokens.spacing.md,
  },
  monospaceCode: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: tokens.colors.textPrimary,
    lineHeight: 16,
  },
  versionFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: 10,
  },
});
