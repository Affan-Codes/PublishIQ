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
  Sliders,
  Plus,
  Play,
  Trash2,
  Settings2,
  AlertTriangle,
  CheckCircle2,
  Languages,
} from 'lucide-react-native';
import { useContentProfilesQuery } from '../../../hooks/queries/useContentProfilesQuery';
import { useContentProfileReadinessQuery } from '../../../hooks/queries/useContentProfileReadinessQuery';
import {
  useDryRunProfileMutation,
  useDeleteContentProfileMutation,
} from '../../../hooks/mutations/useContentProfileMutations';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Sheet } from '../../../components/ui/Sheet';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { tokens } from '../../../design/tokens';
import { getStatusBadge } from '../../../lib/status';
import { ContentProfile } from '../../../types/domain';

function ProfileReadinessIndicator({ profileId }: { profileId: string }) {
  const { data: readiness, isLoading } = useContentProfileReadinessQuery(profileId);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  if (isLoading || !readiness) {
    return (
      <View style={styles.readinessChecking}>
        <Text style={styles.readinessCheckingText}>Checking readiness...</Text>
      </View>
    );
  }

  if (readiness.ready) {
    return (
      <View style={styles.readyBadge}>
        <View style={styles.readyDot} />
        <Text style={styles.readyText}>Ready</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={styles.missingBadge}
        onPress={() => setIsSheetOpen(true)}
      >
        <View style={styles.missingDot} />
        <Text style={styles.missingText}>{readiness.missing.length} missing</Text>
      </TouchableOpacity>

      <Sheet
        visible={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title="Profile Readiness Checks"
        subtitle={`${readiness.missing.length} configuration items required`}
      >
        <View style={styles.readinessList}>
          {readiness.missing.map((item, idx) => (
            <View key={idx} style={styles.readinessItem}>
              <AlertTriangle size={14} color={tokens.colors.warningLight} />
              <Text style={styles.readinessItemText}>{item}</Text>
            </View>
          ))}
        </View>
      </Sheet>
    </>
  );
}

export default function ContentProfilesScreen() {
  const router = useRouter();
  const [deletingProfile, setDeletingProfile] = useState<ContentProfile | null>(null);
  const [actionProfileId, setActionProfileId] = useState<string | null>(null);

  const {
    data: profiles = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useContentProfilesQuery();

  const dryRunMutation = useDryRunProfileMutation();
  const deleteMutation = useDeleteContentProfileMutation();

  const handleDryRun = (id: string) => {
    setActionProfileId(id);
    dryRunMutation.mutate(id, {
      onSettled: () => setActionProfileId(null),
    });
  };

  const handleDelete = () => {
    if (!deletingProfile) return;
    deleteMutation.mutate(deletingProfile.id, {
      onSuccess: () => setDeletingProfile(null),
    });
  };

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <ErrorState
          title="Failed to load content profiles"
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
        data={profiles}
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
              <Text style={styles.headerTitle}>Content Profiles</Text>
              <Text style={styles.headerSubtitle}>
                {profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'} configured
              </Text>
            </View>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onPress={() => router.push('/content-profiles/new')}
            >
              Add Profile
            </Button>
          </View>
        }
        renderItem={({ item }) => {
          const statusBadge = getStatusBadge(item.status);
          const isActing = actionProfileId === item.id;

          return (
            <Card
              style={styles.profileCard}
              onPress={() => router.push(`/content-profiles/${item.id}`)}
            >
              {/* Header */}
              <View style={styles.rowBetween}>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{item.name}</Text>
                  <Text style={styles.profileType}>
                    Type: {item.contentType?.name || 'Standard'} • Tone: {item.tone}
                  </Text>
                </View>
                <View style={styles.badgeRow}>
                  <ProfileReadinessIndicator profileId={item.id} />
                  <Badge
                    label={statusBadge.label}
                    variant={statusBadge.variant}
                    size="sm"
                  />
                </View>
              </View>

              {/* Badges / Chips */}
              <View style={styles.chipsRow}>
                <View style={styles.metaChip}>
                  <Languages size={12} color={tokens.colors.primaryLight} />
                  <Text style={styles.metaChipText}>{item.language}</Text>
                </View>

                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>Style: {item.writingStyle}</Text>
                </View>

                {item.promptVersion && (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>
                      Prompt v{item.promptVersion.versionNumber}
                    </Text>
                  </View>
                )}

                {item.templateVersion && (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>
                      Template v{item.templateVersion.versionNumber}
                    </Text>
                  </View>
                )}
              </View>

              {/* Actions */}
              <View style={styles.actionsFooter}>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Play}
                  isLoading={dryRunMutation.isPending && isActing}
                  loadingText="Running..."
                  onPress={() => handleDryRun(item.id)}
                >
                  Dry Run
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  textStyle={{ color: tokens.colors.destructiveLight }}
                  onPress={() => setDeletingProfile(item)}
                >
                  Delete
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  icon={Settings2}
                  onPress={() => router.push(`/content-profiles/${item.id}`)}
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
              icon={Sliders}
              title="No content profiles"
              description="Create reusable profiles defining prompt version, template version, tone, branding rules, and validation."
              actionLabel="Add Content Profile"
              onAction={() => router.push('/content-profiles/new')}
            />
          )
        }
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        visible={!!deletingProfile}
        title="Delete Content Profile"
        message={`Are you sure you want to delete "${deletingProfile?.name}"? Linked channels may require re-assignment.`}
        confirmLabel="Delete Profile"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeletingProfile(null)}
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
  profileCard: {
    padding: tokens.spacing.base,
    gap: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  profileInfo: {
    flex: 1,
    paddingRight: 10,
  },
  profileName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  profileType: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.surfaceRaised,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.radius.xs,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  metaChipText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textMuted,
    fontWeight: '600',
  },
  actionsFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: 8,
  },
  readinessChecking: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  readinessCheckingText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 10,
    color: tokens.colors.textSubtle,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.successBgSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.successBorderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.radius.pill,
  },
  readyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.successLight,
  },
  readyText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.successLight,
  },
  missingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: tokens.colors.warningBgSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.warningBorderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.radius.pill,
  },
  missingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.warningLight,
  },
  missingText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.warningLight,
  },
  readinessList: {
    gap: 12,
    paddingVertical: 8,
    paddingBottom: 24,
  },
  readinessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: tokens.colors.surfaceRaised,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.input,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  readinessItemText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.text,
    flex: 1,
  },
});
