import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Plus,
  Sparkles,
  Info,
  Check,
} from 'lucide-react-native';
import { usePromptDetailQuery } from '../../../../hooks/queries/usePromptDetailQuery';
import { useCreatePromptVersionMutation } from '../../../../hooks/mutations/usePromptMutations';
import { useToast } from '../../../../providers/ToastProvider';
import { Card } from '../../../../components/ui/Card';
import { Field } from '../../../../components/ui/Field';
import { Button } from '../../../../components/ui/Button';
import { tokens } from '../../../../design/tokens';
import { PromptStatus } from '../../../../types/domain';

const STATUS_OPTIONS: { id: PromptStatus; label: string; description: string }[] = [
  { id: 'Active', label: 'Active', description: 'Available for immediate generation' },
  { id: 'Draft', label: 'Draft', description: 'Work in progress' },
  { id: 'Deprecated', label: 'Deprecated', description: 'Phased out version' },
];

function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || [];
  const variables = matches.map((m) => m.replace(/[\{\}]/g, '').trim());
  return Array.from(new Set(variables));
}

export default function NewPromptVersionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const { data: prompt } = usePromptDetailQuery(id);
  const createVersionMutation = useCreatePromptVersionMutation();

  // Find latest version to determine next version number
  const latestVersion = prompt?.versions && prompt.versions.length > 0
    ? prompt.versions.reduce((prev, curr) =>
        curr.versionNumber > prev.versionNumber ? curr : prev
      )
    : null;

  const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;

  // React state for form fields
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<PromptStatus>('Active');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const detectedVariables = extractVariables(body);

  const handleSubmit = async () => {
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setValidationError('Prompt body cannot be empty.');
      return;
    }
    setValidationError(null);

    if (!id) {
      toast.error('Invalid prompt ID');
      return;
    }

    try {
      await createVersionMutation.mutateAsync({
        id: id as string,
        params: {
          body: trimmedBody,
          status,
          notes: notes.trim() || null,
        },
      });
      toast.success(`Version ${nextVersionNumber} published successfully`);
      router.back();
    } catch (err: any) {
      // Toast error is also dispatched by mutation onError
      setValidationError(err?.message || 'Failed to create prompt version');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={styles.formCard}>
        {/* Header Info */}
        <View style={styles.headerInfo}>
          <Text style={styles.promptName}>{prompt?.name || 'Prompt Template'}</Text>
          <Text style={styles.nextVersionText}>
            Creating Version {nextVersionNumber}
          </Text>
        </View>

        {/* Output Contract Guidance */}
        <View style={styles.guidanceBox}>
          <Info size={16} color={tokens.colors.primaryLight} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.guidanceTitle}>Output Contract Guidelines</Text>
            <Text style={styles.guidanceText}>
              Write prompt instructions producing clean output. Dynamic variables must follow the{' '}
              <Text style={styles.variableCodeSnippet}>{'{{variableName}}'}</Text> syntax.
            </Text>
          </View>
        </View>

        {/* Multiline Monospace Body Field */}
        <Field
          label="Prompt Body Template"
          required
          monospace
          multiline
          numberOfLines={10}
          inputStyle={styles.bodyInput}
          value={body}
          onChangeText={(text) => {
            setBody(text);
            if (validationError) setValidationError(null);
          }}
          placeholder={`Enter prompt system instructions...\ne.g. Generate a concise, engaging summary about {{topic}} for {{audience}}.\nTone: {{tone}}`}
          helperText="Define prompt logic and dynamic variable interpolation tokens"
          error={validationError || undefined}
        />

        {/* Live Detected Variables Indicator */}
        <View style={styles.variablesBox}>
          <View style={styles.variablesHeader}>
            <Sparkles size={14} color={tokens.colors.primaryLight} />
            <Text style={styles.variablesTitle}>
              Interpolation Variables ({detectedVariables.length})
            </Text>
          </View>
          {detectedVariables.length === 0 ? (
            <Text style={styles.noVariablesText}>
              No interpolation tags found. Insert {'{{variable}}'} to inject dynamic content at execution.
            </Text>
          ) : (
            <View style={styles.chipsRow}>
              {detectedVariables.map((v) => (
                <View key={v} style={styles.varChip}>
                  <Text style={styles.varChipText}>{'{{' + v + '}}'}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Status Picker Chips */}
        <View style={styles.statusSection}>
          <Text style={styles.statusLabel}>
            Deployment Status <Text style={styles.requiredAsterisk}>*</Text>
          </Text>
          <View style={styles.statusChipsContainer}>
            {STATUS_OPTIONS.map((opt) => {
              const isSelected = status === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setStatus(opt.id)}
                  style={[
                    styles.statusChip,
                    isSelected && styles.statusChipSelected,
                    isSelected && opt.id === 'Active' && styles.statusChipActive,
                    isSelected && opt.id === 'Draft' && styles.statusChipDraft,
                    isSelected && opt.id === 'Deprecated' && styles.statusChipDeprecated,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.statusChipHeader}>
                    {isSelected ? (
                      <Check size={14} color={tokens.colors.text} style={styles.checkIcon} />
                    ) : null}
                    <Text
                      style={[
                        styles.statusChipLabel,
                        isSelected && styles.statusChipLabelSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </View>
                  <Text style={styles.statusChipDesc}>{opt.description}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Revision Notes Field */}
        <Field
          label="Revision Notes (Optional)"
          placeholder="e.g. Fixed formatting rules and updated system tone instructions"
          value={notes}
          onChangeText={setNotes}
          helperText="Explain the rationale behind this version update"
        />

        {/* Submit Button */}
        <Button
          variant="primary"
          size="lg"
          icon={Plus}
          isLoading={createVersionMutation.isPending}
          loadingText="Deploying Version..."
          onPress={handleSubmit}
          style={{ marginTop: tokens.spacing.sm }}
        >
          Publish Version {nextVersionNumber}
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
  headerInfo: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    paddingBottom: tokens.spacing.sm,
  },
  promptName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  nextVersionText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.primaryLight,
    fontWeight: '600',
    marginTop: 2,
  },
  guidanceBox: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    backgroundColor: tokens.colors.surfaceRaised,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.input,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  guidanceTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  guidanceText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  variableCodeSnippet: {
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
    color: tokens.colors.primaryLight,
    fontWeight: '600',
  },
  bodyInput: {
    minHeight: 180,
    textAlignVertical: 'top',
    fontSize: 13,
    lineHeight: 19,
  },
  variablesBox: {
    backgroundColor: tokens.colors.surfaceRaised,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.input,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: tokens.spacing.xs,
  },
  variablesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  variablesTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  noVariablesText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
    fontStyle: 'italic',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  varChip: {
    backgroundColor: tokens.colors.primaryBgSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.primaryBorderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radius.xs,
  },
  varChipText: {
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
    fontSize: 11,
    color: tokens.colors.primaryLight,
    fontWeight: '700',
  },
  statusSection: {
    gap: tokens.spacing.xs,
  },
  statusLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.textMuted,
    marginBottom: 4,
  },
  requiredAsterisk: {
    color: tokens.colors.destructiveLight,
  },
  statusChipsContainer: {
    flexDirection: 'column',
    gap: tokens.spacing.xs,
  },
  statusChip: {
    backgroundColor: tokens.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.input,
    padding: tokens.spacing.sm,
  },
  statusChipSelected: {
    borderColor: tokens.colors.primaryLight,
    backgroundColor: tokens.colors.surfaceHover,
  },
  statusChipActive: {
    borderColor: tokens.colors.successLight,
    backgroundColor: tokens.colors.successBgSubtle,
  },
  statusChipDraft: {
    borderColor: tokens.colors.warningLight,
    backgroundColor: tokens.colors.warningBgSubtle,
  },
  statusChipDeprecated: {
    borderColor: tokens.colors.textSubtle,
    backgroundColor: tokens.colors.surfaceHover,
  },
  statusChipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkIcon: {
    marginRight: 2,
  },
  statusChipLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
  },
  statusChipLabelSelected: {
    color: tokens.colors.text,
    fontWeight: '700',
  },
  statusChipDesc: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
    marginTop: 2,
  },
});
