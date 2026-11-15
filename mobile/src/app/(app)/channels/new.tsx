import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Plus, Radio, ArrowLeft } from 'lucide-react-native';
import { useContentProfilesQuery } from '../../../hooks/queries/useContentProfilesQuery';
import { useConnectionsQuery } from '../../../hooks/queries/useConnectionsQuery';
import { useCreateChannelMutation } from '../../../hooks/mutations/useChannelMutations';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { tokens } from '../../../design/tokens';
import { AutomationMode, ChannelStatus } from '../../../types/domain';

const cronRegex = /^((?:\*|[0-5]?\d)(?:-[0-5]?\d)?(?:\/[0-5]?\d)?(?:,(?:\*|[0-5]?\d)(?:-[0-5]?\d)?(?:\/[0-5]?\d)?)*)\s+((?:\*|(?:[0-9]|1\d|2[0-3]))(?:-(?:[0-9]|1\d|2[0-3]))?(?:\/(?:[0-9]|1\d|2[0-3]))?(?:,(?:\*|(?:[0-9]|1\d|2[0-3]))(?:-(?:[0-9]|1\d|2[0-3]))?(?:\/(?:[0-9]|1\d|2[0-3]))?)*)\s+((?:\*|(?:[1-9]|[12]\d|3[01]))(?:-(?:[1-9]|[12]\d|3[01]))?(?:\/(?:[1-9]|[12]\d|3[01]))?(?:,(?:\*|(?:[1-9]|[12]\d|3[01]))(?:-(?:[1-9]|[12]\d|3[01]))?(?:\/(?:[1-9]|[12]\d|3[01]))?)*)\s+((?:\*|(?:[1-9]|1[02]))(?:-(?:[1-9]|1[02]))?(?:\/(?:[1-9]|1[02]))?(?:,(?:\*|(?:[1-9]|1[02]))(?:-(?:[1-9]|1[02]))?(?:\/(?:[1-9]|1[02]))?)*)\s+((?:\*|[0-7])(?:-[0-7])?(?:\/[0-7])?(?:,(?:\*|[0-7])(?:-[0-7])?(?:\/[0-7])?)*)$/;

const channelFormSchema = z.object({
  name: z.string().min(1, 'Channel name is required').max(100),
  contentProfileId: z.string().uuid('Please select a Content Profile'),
  automationMode: z.enum(['Manual', 'Automatic', 'Hybrid']),
  status: z.enum(['Active', 'Disabled']),
  scheduleCron: z
    .string()
    .regex(cronRegex, 'Must be a valid 5-field cron expression (e.g. "0 9 * * *" or "*/30 * * * *")'),
  maxDurationSeconds: z.coerce
    .number()
    .min(5, 'Duration must be at least 5 seconds')
    .max(3600, 'Duration cannot exceed 1 hour'),
  autoTagEnabled: z.boolean(),
  platformConnectionIds: z
    .array(z.string().uuid())
    .min(1, 'Select at least one platform connection'),
});

type ChannelFormValues = z.infer<typeof channelFormSchema>;

export default function CreateChannelScreen() {
  const router = useRouter();
  const createMutation = useCreateChannelMutation();

  const { data: profiles = [] } = useContentProfilesQuery();
  const { data: connections = [] } = useConnectionsQuery();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ChannelFormValues>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      name: '',
      contentProfileId: '',
      automationMode: 'Hybrid',
      status: 'Active',
      scheduleCron: '0 9 * * *',
      maxDurationSeconds: 60,
      autoTagEnabled: true,
      platformConnectionIds: [],
    },
  });

  const selectedProfileId = watch('contentProfileId');
  const selectedConnections = watch('platformConnectionIds');
  const autoTagEnabled = watch('autoTagEnabled');

  const toggleConnection = (id: string) => {
    if (selectedConnections.includes(id)) {
      setValue(
        'platformConnectionIds',
        selectedConnections.filter((item) => item !== id)
      );
    } else {
      setValue('platformConnectionIds', [...selectedConnections, id]);
    }
  };

  const onSubmit = (values: ChannelFormValues) => {
    createMutation.mutate(
      {
        name: values.name,
        contentProfileId: values.contentProfileId,
        automationMode: values.automationMode,
        status: values.status,
        scheduleCron: values.scheduleCron,
        publishingConfiguration: {
          maxDurationSeconds: values.maxDurationSeconds,
          autoTagEnabled: values.autoTagEnabled,
        },
        platformConnectionIds: values.platformConnectionIds,
      },
      {
        onSuccess: () => {
          router.replace('/channels');
        },
      }
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={styles.formCard}>
        {/* Channel Name */}
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field
              label="Channel Name"
              placeholder="e.g. Daily Tech Insights"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.name?.message}
              required
            />
          )}
        />

        {/* Content Profile Picker */}
        <View style={styles.sectionArea}>
          <Text style={styles.sectionLabel}>
            Content Profile <Text style={styles.requiredAsterisk}>*</Text>
          </Text>
          {errors.contentProfileId && (
            <Text style={styles.fieldError}>{errors.contentProfileId.message}</Text>
          )}
          <View style={styles.optionsGrid}>
            {profiles.map((p) => {
              const isSelected = selectedProfileId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.pickerChip, isSelected && styles.pickerChipSelected]}
                  onPress={() => setValue('contentProfileId', p.id)}
                >
                  <Text
                    style={[
                      styles.pickerChipText,
                      isSelected && styles.pickerChipTextSelected,
                    ]}
                  >
                    {p.name}
                  </Text>
                  {isSelected && <Check size={14} color="#fff" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Automation Mode */}
        <View style={styles.sectionArea}>
          <Text style={styles.sectionLabel}>Automation Mode</Text>
          <Controller
            control={control}
            name="automationMode"
            render={({ field: { onChange, value } }) => (
              <SegmentedControl<AutomationMode>
                options={[
                  { id: 'Manual', label: 'Manual' },
                  { id: 'Hybrid', label: 'Hybrid' },
                  { id: 'Automatic', label: 'Automatic' },
                ]}
                selectedId={value}
                onChange={onChange}
              />
            )}
          />
          <Text style={styles.helperText}>
            Hybrid requires manual approval in Queue before publishing. Automatic publishes directly.
          </Text>
        </View>

        {/* Status */}
        <View style={styles.sectionArea}>
          <Text style={styles.sectionLabel}>Status</Text>
          <Controller
            control={control}
            name="status"
            render={({ field: { onChange, value } }) => (
              <SegmentedControl<ChannelStatus>
                options={[
                  { id: 'Active', label: 'Active' },
                  { id: 'Disabled', label: 'Disabled' },
                ]}
                selectedId={value}
                onChange={onChange}
              />
            )}
          />
        </View>

        {/* Schedule Cron */}
        <Controller
          control={control}
          name="scheduleCron"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field
              label="Schedule Cron Expression (5 fields)"
              placeholder="0 9 * * *"
              monospace
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              helperText='Standard 5-field syntax (e.g. "0 9 * * *" = Daily 9AM UTC)'
              error={errors.scheduleCron?.message}
              required
            />
          )}
        />

        {/* Max Duration Seconds */}
        <Controller
          control={control}
          name="maxDurationSeconds"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field
              label="Max Duration (seconds)"
              placeholder="60"
              keyboardType="numeric"
              value={value ? String(value) : ''}
              onChangeText={onChange}
              onBlur={onBlur}
              helperText="Target duration for rendered MP4 short (5-3600s)"
              error={errors.maxDurationSeconds?.message}
            />
          )}
        />

        {/* Auto Tag Enabled */}
        <View style={styles.switchRow}>
          <View style={styles.switchLabelArea}>
            <Text style={styles.switchTitle}>Auto-Tag Generated Content</Text>
            <Text style={styles.switchSubtitle}>
              Automatically extract and append hashtags from content profile
            </Text>
          </View>
          <Switch
            value={autoTagEnabled}
            onValueChange={(val) => setValue('autoTagEnabled', val)}
            trackColor={{
              false: tokens.colors.surfaceRaised,
              true: tokens.colors.primary,
            }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Platform Connections Multi-Select */}
        <View style={styles.sectionArea}>
          <Text style={styles.sectionLabel}>
            Platform Connections <Text style={styles.requiredAsterisk}>*</Text>
          </Text>
          {errors.platformConnectionIds && (
            <Text style={styles.fieldError}>
              {errors.platformConnectionIds.message}
            </Text>
          )}
          <View style={styles.connectionsList}>
            {connections.length === 0 ? (
              <Text style={styles.noConnectionsText}>
                No platform connections active. Connect YouTube in Platform Connections first.
              </Text>
            ) : (
              connections.map((c) => {
                const isChecked = selectedConnections.includes(c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.connectionItem,
                      isChecked && styles.connectionItemSelected,
                    ]}
                    onPress={() => toggleConnection(c.id)}
                  >
                    <View style={styles.connectionInfo}>
                      <Text style={styles.connectionPlatform}>{c.platform}</Text>
                      <Text style={styles.connectionStatus}>
                        {c.healthStatus} • {c.status}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        isChecked && styles.checkboxChecked,
                      ]}
                    >
                      {isChecked && <Check size={14} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>

        {/* Submit Button */}
        <Button
          variant="primary"
          size="lg"
          icon={Plus}
          isLoading={createMutation.isPending}
          loadingText="Creating Channel..."
          onPress={handleSubmit(onSubmit)}
          style={styles.submitButton}
        >
          Create Channel
        </Button>
      </Card>
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
  formCard: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.base,
  },
  sectionArea: {
    gap: 8,
    marginBottom: tokens.spacing.xs,
  },
  sectionLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
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
    gap: 6,
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
  pickerChipText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.textMuted,
  },
  pickerChipTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  helperText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textSubtle,
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceRaised,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.input,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginVertical: 4,
  },
  switchLabelArea: {
    flex: 1,
    paddingRight: 12,
  },
  switchTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  switchSubtitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
    marginTop: 2,
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
    gap: 2,
  },
  connectionPlatform: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  connectionStatus: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primaryLight,
  },
  noConnectionsText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textSubtle,
    fontStyle: 'italic',
  },
  submitButton: {
    marginTop: tokens.spacing.md,
  },
});
