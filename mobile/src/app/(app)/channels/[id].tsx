import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Save,
  Copy,
  Trash2,
  Share2,
  Clock,
  Sparkles,
  Layers,
  Activity,
  Sliders,
} from 'lucide-react-native';
import { useChannelDetailQuery } from '../../../hooks/queries/useChannelDetailQuery';
import { useContentProfilesQuery } from '../../../hooks/queries/useContentProfilesQuery';
import { useConnectionsQuery } from '../../../hooks/queries/useConnectionsQuery';
import {
  updateChannel,
  deleteChannel,
  duplicateChannel,
  UpdateChannelParams,
} from '../../../api/endpoints/channels';
import { useToast } from '../../../providers/ToastProvider';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { tokens } from '../../../design/tokens';
import { getConnectionHealthStatus, getConnectionStatus } from '../../../lib/status';
import { AutomationMode, ChannelStatus } from '../../../types/domain';

const cronRegex = /^((?:\*|[0-5]?\d)(?:-[0-5]?\d)?(?:\/[0-5]?\d)?(?:,(?:\*|[0-5]?\d)(?:-[0-5]?\d)?(?:\/[0-5]?\d)?)*)\s+((?:\*|(?:[0-9]|1\d|2[0-3]))(?:-(?:[0-9]|1\d|2[0-3]))?(?:\/(?:[0-9]|1\d|2[0-3]))?(?:,(?:\*|(?:[0-9]|1\d|2[0-3]))(?:-(?:[0-9]|1\d|2[0-3]))?(?:\/(?:[0-9]|1\d|2[0-3]))?)*)\s+((?:\*|(?:[1-9]|[12]\d|3[01]))(?:-(?:[1-9]|[12]\d|3[01]))?(?:\/(?:[1-9]|[12]\d|3[01]))?(?:,(?:\*|(?:[1-9]|[12]\d|3[01]))(?:-(?:[1-9]|[12]\d|3[01]))?(?:\/(?:[1-9]|[12]\d|3[01]))?)*)\s+((?:\*|(?:[1-9]|1[02]))(?:-(?:[1-9]|1[02]))?(?:\/(?:[1-9]|1[02]))?(?:,(?:\*|(?:[1-9]|1[02]))(?:-(?:[1-9]|1[02]))?(?:\/(?:[1-9]|1[02]))?)*)\s+((?:\*|[0-7])(?:-[0-7])?(?:\/[0-7])?(?:,(?:\*|[0-7])(?:-[0-7])?(?:\/[0-7])?)*)$/;

export default function ChannelEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Form field state
  const [name, setName] = useState('');
  const [contentProfileId, setContentProfileId] = useState('');
  const [automationMode, setAutomationMode] = useState<AutomationMode>('Hybrid');
  const [status, setStatus] = useState<ChannelStatus>('Active');
  const [scheduleCron, setScheduleCron] = useState('0 9 * * *');
  const [platformConnectionIds, setPlatformConnectionIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Queries
  const {
    data: channel,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useChannelDetailQuery(id);
  const { data: profiles = [] } = useContentProfilesQuery();
  const { data: connections = [] } = useConnectionsQuery();

  // Load initial values from query data with useEffect
  useEffect(() => {
    if (channel) {
      setName(channel.name || '');
      setContentProfileId(channel.contentProfileId || '');
      setAutomationMode((channel.automationMode as AutomationMode) || 'Hybrid');
      setStatus((channel.status as ChannelStatus) || 'Active');
      setScheduleCron(channel.scheduleCron || '0 9 * * *');
      const connIds = channel.platformConnections?.map((c) => c.platformConnectionId) || [];
      setPlatformConnectionIds(connIds);
    }
  }, [channel]);

  // Mutations via useMutation directly from @tanstack/react-query
  const updateMutation = useMutation({
    mutationFn: (params: UpdateChannelParams) => updateChannel(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['channel', id] });
      toast.success('Channel updated successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update channel');
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: () => duplicateChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Channel duplicated successfully');
      router.replace('/(app)/channels');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to duplicate channel');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Channel deleted');
      setIsDeleteDialogOpen(false);
      router.replace('/(app)/channels');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete channel');
    },
  });

  const toggleConnection = (connId: string) => {
    setPlatformConnectionIds((prev) => {
      const next = prev.includes(connId)
        ? prev.filter((item) => item !== connId)
        : [...prev, connId];
      if (errors.platformConnectionIds && next.length > 0) {
        setErrors((e) => {
          const copy = { ...e };
          delete copy.platformConnectionIds;
          return copy;
        });
      }
      return next;
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Channel name is required';
    } else if (name.trim().length > 100) {
      newErrors.name = 'Channel name cannot exceed 100 characters';
    }

    if (!contentProfileId) {
      newErrors.contentProfileId = 'Please select a Content Profile';
    }

    if (!scheduleCron.trim()) {
      newErrors.scheduleCron = 'Schedule cron is required';
    } else if (!cronRegex.test(scheduleCron.trim())) {
      newErrors.scheduleCron =
        'Must be a valid 5-field cron expression (e.g. "0 9 * * *" or "*/30 * * * *")';
    }

    if (platformConnectionIds.length === 0) {
      newErrors.platformConnectionIds = 'Select at least one platform connection';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    updateMutation.mutate({
      name: name.trim(),
      contentProfileId,
      automationMode,
      status,
      scheduleCron: scheduleCron.trim(),
      platformConnectionIds,
    });
  };

  if (isError) {
    return (
      <View style={styles.centerContainer}>
        <ErrorState
          title="Failed to load channel details"
          message={(error as any)?.message}
          onRetry={refetch}
          onRefresh={refetch}
        />
      </View>
    );
  }

  if (isLoading || !channel) {
    return (
      <View style={styles.loadingContainer}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={tokens.colors.primaryLight}
        />
      }
    >
      <Card style={styles.formCard}>
        {/* Top Action Bar */}
        <View style={styles.actionBar}>
          <View style={styles.titleArea}>
            <Text style={styles.channelHeaderTitle} numberOfLines={1}>
              {channel.name}
            </Text>
            <Text style={styles.channelSubtitle}>Channel Settings & Pipeline Routing</Text>
          </View>
          <View style={styles.headerButtons}>
            <Button
              size="sm"
              variant="ghost"
              icon={Copy}
              isLoading={duplicateMutation.isPending}
              loadingText="Copying..."
              onPress={() => duplicateMutation.mutate()}
            >
              Duplicate
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={Trash2}
              textStyle={{ color: tokens.colors.destructiveLight }}
              onPress={() => setIsDeleteDialogOpen(true)}
            >
              Delete
            </Button>
          </View>
        </View>

        {/* Channel Name Field */}
        <Field
          label="Channel Name"
          value={name}
          onChangeText={(val) => {
            setName(val);
            if (errors.name) {
              setErrors((e) => {
                const copy = { ...e };
                delete copy.name;
                return copy;
              });
            }
          }}
          placeholder="e.g. Daily Tech Highlights"
          error={errors.name}
          required
        />

        {/* Content Profile Picker */}
        <View style={styles.sectionArea}>
          <View style={styles.sectionTitleRow}>
            <Sliders size={15} color={tokens.colors.textMuted} />
            <Text style={styles.sectionLabel}>
              Content Profile <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
          </View>
          {errors.contentProfileId && (
            <Text style={styles.fieldError}>{errors.contentProfileId}</Text>
          )}
          <View style={styles.optionsGrid}>
            {profiles.map((p) => {
              const isSelected = contentProfileId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.pickerChip, isSelected && styles.pickerChipSelected]}
                  onPress={() => {
                    setContentProfileId(p.id);
                    if (errors.contentProfileId) {
                      setErrors((e) => {
                        const copy = { ...e };
                        delete copy.contentProfileId;
                        return copy;
                      });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.pickerChipContent}>
                    <Text
                      style={[
                        styles.pickerChipText,
                        isSelected && styles.pickerChipTextSelected,
                      ]}
                    >
                      {p.name}
                    </Text>
                    {p.language && (
                      <Text
                        style={[
                          styles.pickerChipSub,
                          isSelected && styles.pickerChipSubSelected,
                        ]}
                      >
                        {p.language}
                      </Text>
                    )}
                  </View>
                  {isSelected && <Check size={14} color="#ffffff" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Automation Mode Picker */}
        <View style={styles.sectionArea}>
          <View style={styles.sectionTitleRow}>
            <Activity size={15} color={tokens.colors.textMuted} />
            <Text style={styles.sectionLabel}>Automation Mode</Text>
          </View>
          <SegmentedControl<AutomationMode>
            options={[
              { id: 'Manual', label: 'Manual' },
              { id: 'Hybrid', label: 'Hybrid' },
              { id: 'Automatic', label: 'Automatic' },
            ]}
            selectedId={automationMode}
            onChange={(mode) => setAutomationMode(mode)}
          />
          <Text style={styles.sectionHelper}>
            {automationMode === 'Manual' && 'Manual: Jobs generate quotes but require explicit operator trigger.'}
            {automationMode === 'Hybrid' && 'Hybrid: Quotes generate automatically but require approval before publish.'}
            {automationMode === 'Automatic' && 'Automatic: End-to-end execution without operator intervention.'}
          </Text>
        </View>

        {/* Channel Status Toggle */}
        <View style={styles.sectionArea}>
          <View style={styles.sectionTitleRow}>
            <Layers size={15} color={tokens.colors.textMuted} />
            <Text style={styles.sectionLabel}>Channel Status</Text>
          </View>
          <SegmentedControl<ChannelStatus>
            options={[
              { id: 'Active', label: 'Active' },
              { id: 'Disabled', label: 'Disabled' },
            ]}
            selectedId={status}
            onChange={(st) => setStatus(st)}
          />
        </View>

        {/* Schedule Cron Field */}
        <Field
          label="Schedule Cron Expression"
          monospace
          value={scheduleCron}
          onChangeText={(val) => {
            setScheduleCron(val);
            if (errors.scheduleCron) {
              setErrors((e) => {
                const copy = { ...e };
                delete copy.scheduleCron;
                return copy;
              });
            }
          }}
          placeholder="0 9 * * *"
          helperText='Standard 5-field syntax (e.g. "0 9 * * *" = Daily 9AM UTC, "*/30 * * * *" = Every 30 mins)'
          error={errors.scheduleCron}
          required
        />

        {/* Platform Connections Multi-Select */}
        <View style={styles.sectionArea}>
          <View style={styles.sectionTitleRow}>
            <Share2 size={15} color={tokens.colors.textMuted} />
            <Text style={styles.sectionLabel}>
              Platform Connections <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
          </View>
          {errors.platformConnectionIds && (
            <Text style={styles.fieldError}>{errors.platformConnectionIds}</Text>
          )}
          <View style={styles.connectionsList}>
            {connections.map((c) => {
              const isChecked = platformConnectionIds.includes(c.id);
              const health = getConnectionHealthStatus(c.healthStatus);
              const connStatus = getConnectionStatus(c.status);

              return (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.connectionItem,
                    isChecked && styles.connectionItemSelected,
                  ]}
                  onPress={() => toggleConnection(c.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.connectionInfo}>
                    <Text style={styles.connectionPlatform}>{c.platform}</Text>
                    <View style={styles.connectionBadgeRow}>
                      <Badge
                        label={health.label}
                        bg={health.bg}
                        border={health.border}
                        textColor={health.text}
                        size="sm"
                      />
                      <Badge
                        label={connStatus.label}
                        bg={connStatus.bg}
                        border={connStatus.border}
                        textColor={connStatus.text}
                        size="sm"
                      />
                    </View>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      isChecked && styles.checkboxChecked,
                    ]}
                  >
                    {isChecked && <Check size={14} color="#ffffff" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Save Button */}
        <Button
          variant="primary"
          size="lg"
          icon={Save}
          isLoading={updateMutation.isPending}
          loadingText="Saving Changes..."
          onPress={handleSave}
          style={styles.saveButton}
        >
          Save Configuration
        </Button>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={isDeleteDialogOpen}
        title="Delete Channel"
        message={`Are you sure you want to delete "${channel.name}"? This action cannot be undone and will remove all scheduled publishing configurations.`}
        confirmLabel="Delete Channel"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setIsDeleteDialogOpen(false)}
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
    paddingBottom: 40,
  },
  centerContainer: {
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
  formCard: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.base,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    paddingBottom: tokens.spacing.md,
  },
  titleArea: {
    flex: 1,
    marginRight: tokens.spacing.sm,
  },
  channelHeaderTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  channelSubtitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textSubtle,
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionArea: {
    gap: 8,
    marginBottom: tokens.spacing.xs,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
  },
  sectionHelper: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textSubtle,
    marginTop: 4,
    lineHeight: 16,
  },
  requiredAsterisk: {
    color: tokens.colors.destructiveLight,
  },
  fieldError: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.destructiveLight,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.radius.input,
    backgroundColor: tokens.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  pickerChipSelected: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primaryLight,
  },
  pickerChipContent: {
    flexDirection: 'column',
  },
  pickerChipText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.textMuted,
  },
  pickerChipTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  pickerChipSub: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 10,
    color: tokens.colors.textSubtle,
  },
  pickerChipSubSelected: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  connectionsList: {
    gap: 8,
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceRaised,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.input,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  connectionItemSelected: {
    borderColor: tokens.colors.primaryLight,
    backgroundColor: tokens.colors.primaryBgSubtle,
  },
  connectionInfo: {
    gap: 6,
    flex: 1,
  },
  connectionPlatform: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  connectionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: tokens.spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primaryLight,
  },
  saveButton: {
    marginTop: tokens.spacing.sm,
  },
});
