import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Plus,
  RotateCcw,
  Sparkles,
  Calendar,
  Clock,
  Code2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { usePromptDetailQuery } from '../../../hooks/queries/usePromptDetailQuery';
import { usePromptVersionsQuery } from '../../../hooks/queries/usePromptVersionsQuery';
import { usePromptOutputContractQuery } from '../../../hooks/queries/usePromptOutputContractQuery';
import { useRollbackPromptMutation } from '../../../hooks/mutations/usePromptMutations';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Sheet } from '../../../components/ui/Sheet';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { SkeletonCard, SkeletonRows } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { tokens } from '../../../design/tokens';
import { formatDateTime } from '../../../lib/format';
import { PromptStatus, PromptVersion } from '../../../types/domain';

function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || [];
  const variables = matches.map((m) => m.replace(/[\{\}]/g, '').trim());
  return Array.from(new Set(variables));
}

function getPromptStatusBadge(status?: PromptStatus | string | null): {
  label: string;
  variant: 'success' | 'warning' | 'neutral';
} {
  switch (status) {
    case 'Active':
      return { label: 'Active', variant: 'success' };
    case 'Draft':
      return { label: 'Draft', variant: 'warning' };
    case 'Deprecated':
      return { label: 'Deprecated', variant: 'neutral' };
    default:
      return { label: status || 'Unknown', variant: 'neutral' };
  }
}

export default function PromptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [rollbackTarget, setRollbackTarget] = useState<PromptVersion | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({});
  const [isContractOpen, setIsContractOpen] = useState(false);

  const {
    data: prompt,
    isLoading: isPromptLoading,
    isError: isPromptError,
    error: promptError,
    refetch: refetchPrompt,
    isRefetching: isPromptRefetching,
  } = usePromptDetailQuery(id);

  const {
    data: versions = [],
    isLoading: isVersionsLoading,
    refetch: refetchVersions,
    isRefetching: isVersionsRefetching,
  } = usePromptVersionsQuery(id);

  const {
    data: outputContract,
    isLoading: isContractLoading,
  } = usePromptOutputContractQuery({ enabled: isContractOpen });

  const rollbackMutation = useRollbackPromptMutation();

  const isRefreshing = isPromptRefetching || isVersionsRefetching;

  const handleRefresh = () => {
    refetchPrompt();
    refetchVersions();
  };

  const toggleExpand = (versionId: string) => {
    setExpandedVersions((prev) => ({
      ...prev,
      [versionId]: !prev[versionId],
    }));
  };

  const handleRollback = () => {
    if (!rollbackTarget || !id) return;
    rollbackMutation.mutate(
      { id, versionNumber: rollbackTarget.versionNumber },
      {
        onSuccess: () => setRollbackTarget(null),
      }
    );
  };

  if (isPromptError) {
    return (
      <View style={styles.errorContainer}>
        <ErrorState
          title="Failed to load prompt details"
          message={(promptError as any)?.message || 'An error occurred while fetching prompt information.'}
          onRetry={handleRefresh}
          onRefresh={handleRefresh}
        />
      </View>
    );
  }

  if (isPromptLoading || !prompt) {
    return (
      <View style={styles.loadingContainer}>
        <SkeletonCard />
        <SkeletonRows rows={5} />
      </View>
    );
  }

  const promptStatus = getPromptStatusBadge(prompt.status);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={tokens.colors.primaryLight}
        />
      }
    >
      {/* Overview Card */}
      <Card style={styles.overviewCard}>
        <View style={styles.headerRow}>
          <Text style={styles.promptName}>{prompt.name}</Text>
          <Badge
            label={promptStatus.label}
            variant={promptStatus.variant}
            size="md"
          />
        </View>

        {prompt.notes ? (
          <Text style={styles.promptNotes}>{prompt.notes}</Text>
        ) : null}

        {/* Timestamps */}
        <View style={styles.metadataContainer}>
          <View style={styles.metaItem}>
            <Calendar size={13} color={tokens.colors.textSubtle} />
            <Text style={styles.metaLabel}>Created:</Text>
            <Text style={styles.metaValue}>{formatDateTime(prompt.createdAt)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Clock size={13} color={tokens.colors.textSubtle} />
            <Text style={styles.metaLabel}>Updated:</Text>
            <Text style={styles.metaValue}>{formatDateTime(prompt.updatedAt)}</Text>
          </View>
        </View>

        {/* Actions Toolbar */}
        <View style={styles.actionsRow}>
          <Button
            variant="outline"
            size="sm"
            icon={Code2}
            onPress={() => setIsContractOpen(true)}
          >
            Output Contract
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onPress={() => router.push(`/prompts/${id}/new-version` as any)}
          >
            New Version
          </Button>
        </View>
      </Card>

      {/* Version History Header */}
      <View style={styles.historyHeader}>
        <Text style={styles.sectionTitle}>Version History</Text>
        <Text style={styles.sectionSubtitle}>
          {versions.length} {versions.length === 1 ? 'version' : 'versions'} available
        </Text>
      </View>

      {/* Version History List */}
      {isVersionsLoading ? (
        <View style={styles.loadingArea}>
          <SkeletonRows rows={4} />
        </View>
      ) : versions.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No prompt versions recorded.</Text>
        </Card>
      ) : (
        versions.map((ver) => {
          const isExpanded = Boolean(expandedVersions[ver.id]);
          const versionStatus = getPromptStatusBadge(ver.status);
          const isActive = ver.status === 'Active';
          const variables = extractVariables(ver.body);

          return (
            <Card
              key={ver.id}
              style={[styles.versionCard, isActive && styles.activeVersionCard]}
            >
              {/* Card Header */}
              <View style={styles.versionHeader}>
                <View style={styles.versionTitleGroup}>
                  <Text style={styles.versionNumber}>v{ver.versionNumber}</Text>
                  <Badge
                    label={versionStatus.label}
                    variant={versionStatus.variant}
                    size="sm"
                  />
                </View>
                <Text style={styles.versionDate}>
                  {formatDateTime(ver.createdAt)}
                </Text>
              </View>

              {/* Version Notes */}
              {ver.notes ? (
                <Text style={styles.versionNotesText}>{ver.notes}</Text>
              ) : null}

              {/* Monospace Body Preview (Pressable to expand/collapse) */}
              <Pressable
                onPress={() => toggleExpand(ver.id)}
                style={({ pressed }) => [
                  styles.bodyContainer,
                  pressed && styles.bodyContainerPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Version ${ver.versionNumber} body preview. Tap to toggle full text.`}
              >
                <Text
                  style={styles.monospaceBody}
                  numberOfLines={isExpanded ? undefined : 3}
                >
                  {ver.body}
                </Text>
                <View style={styles.expandToggleRow}>
                  <Text style={styles.expandToggleText}>
                    {isExpanded ? 'Collapse full body' : 'Tap to expand full body'}
                  </Text>
                  {isExpanded ? (
                    <ChevronUp size={14} color={tokens.colors.primaryLight} />
                  ) : (
                    <ChevronDown size={14} color={tokens.colors.primaryLight} />
                  )}
                </View>
              </Pressable>

              {/* Detected Interpolation Variables */}
              {variables.length > 0 && (
                <View style={styles.variablesSection}>
                  <Sparkles size={12} color={tokens.colors.primaryLight} />
                  <Text style={styles.variableLabel}>Variables:</Text>
                  <View style={styles.variablesList}>
                    {variables.map((v) => (
                      <View key={v} style={styles.varChip}>
                        <Text style={styles.varChipText}>{'{{' + v + '}}'}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Rollback / Activation Action */}
              {!isActive && (
                <View style={styles.versionFooter}>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={RotateCcw}
                    isLoading={rollbackMutation.isPending && rollbackTarget?.id === ver.id}
                    loadingText="Activating..."
                    onPress={() => setRollbackTarget(ver)}
                  >
                    Activate v{ver.versionNumber}
                  </Button>
                </View>
              )}
            </Card>
          );
        })
      )}

      {/* Rollback Confirmation Modal */}
      <ConfirmDialog
        visible={!!rollbackTarget}
        title="Rollback Prompt Version"
        message={`Are you sure you want to rollback to Version ${rollbackTarget?.versionNumber}? Content profiles using this prompt will use this version for subsequent generations.`}
        confirmLabel="Confirm Rollback"
        cancelLabel="Cancel"
        variant="primary"
        isLoading={rollbackMutation.isPending}
        onConfirm={handleRollback}
        onCancel={() => setRollbackTarget(null)}
      />

      {/* Output Contract Sheet */}
      <Sheet
        visible={isContractOpen}
        onClose={() => setIsContractOpen(false)}
        title="Prompt Output Contract"
        subtitle="Expected JSON schema and completion structure"
      >
        <View style={styles.sheetContent}>
          {isContractLoading ? (
            <SkeletonRows rows={4} />
          ) : outputContract ? (
            <View style={styles.codeBlock}>
              <Text style={styles.codeBlockText}>
                {JSON.stringify(outputContract, null, 2)}
              </Text>
            </View>
          ) : (
            <Text style={styles.contractFallbackText}>
              No output contract definition available.
            </Text>
          )}
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
  errorContainer: {
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
  loadingArea: {
    gap: tokens.spacing.md,
  },
  overviewCard: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  promptName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.text,
    flex: 1,
  },
  promptNotes: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.textMuted,
    lineHeight: 19,
  },
  metadataContainer: {
    backgroundColor: tokens.colors.surfaceRaised,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.input,
    gap: tokens.spacing.xs,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  metaLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.textSubtle,
  },
  metaValue: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textPrimary,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: tokens.spacing.sm,
  },
  historyHeader: {
    marginTop: tokens.spacing.xs,
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
    marginTop: 2,
  },
  emptyCard: {
    padding: tokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.textMuted,
  },
  versionCard: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.sm,
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
  versionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
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
  versionNotesText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    fontStyle: 'italic',
  },
  bodyContainer: {
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.input,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  bodyContainerPressed: {
    opacity: 0.85,
  },
  monospaceBody: {
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
    fontSize: 12,
    color: tokens.colors.textPrimary,
    lineHeight: 18,
  },
  expandToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: tokens.spacing.xs,
    paddingTop: tokens.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.border,
  },
  expandToggleText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.primaryLight,
    fontWeight: '600',
  },
  variablesSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  variableLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.textSubtle,
  },
  variablesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  varChip: {
    backgroundColor: tokens.colors.primaryBgSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.primaryBorderSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tokens.radius.xs,
  },
  varChipText: {
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
    fontSize: 11,
    color: tokens.colors.primaryLight,
    fontWeight: '700',
  },
  versionFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: tokens.spacing.xs,
    marginTop: tokens.spacing.xxs,
  },
  sheetContent: {
    paddingVertical: tokens.spacing.sm,
  },
  codeBlock: {
    backgroundColor: tokens.colors.surfaceRaised,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.input,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  codeBlockText: {
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
    fontSize: 12,
    color: tokens.colors.textPrimary,
    lineHeight: 18,
  },
  contractFallbackText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.textMuted,
    textAlign: 'center',
    paddingVertical: tokens.spacing.md,
  },
});
