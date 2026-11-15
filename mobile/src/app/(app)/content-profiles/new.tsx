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
import { Check, Plus, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useContentTypesQuery } from '../../../hooks/queries/useContentTypesQuery';
import { usePromptsQuery } from '../../../hooks/queries/usePromptsQuery';
import { useTemplatesQuery } from '../../../hooks/queries/useTemplatesQuery';
import { useCreateContentProfileMutation } from '../../../hooks/mutations/useContentProfileMutations';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { tokens } from '../../../design/tokens';
import {
  Language,
  ContentProfileStatus,
  PromptVersion,
  TemplateVersion,
} from '../../../types/domain';

const contentProfileSchema = z.object({
  name: z.string().min(1, 'Profile name is required').max(100),
  notes: z.string().max(500).optional(),
  status: z.enum(['Active', 'Disabled']),
  language: z.enum(['English', 'Hindi', 'Urdu', 'HindiRoman', 'UrduRoman']),
  tone: z.string().min(1, 'Tone is required'),
  writingStyle: z.string().min(1, 'Writing style is required'),
  contentTypeId: z.string().uuid('Please select a Content Type'),
  promptVersionId: z.string().uuid('Please select a Prompt Version'),
  templateVersionId: z.string().uuid('Please select a Template Version'),

  // Sub-object rules
  brandingText: z.string().optional(),
  brandingPosition: z.string(),
  brandingColor: z.string(),
  brandingOpacity: z.coerce.number().min(0).max(1),

  watermarkText: z.string().optional(),
  watermarkPosition: z.string(),
  watermarkOpacity: z.coerce.number().min(0).max(1),

  captionTemplate: z.string().optional(),
  captionPrefix: z.string().optional(),
  captionSuffix: z.string().optional(),

  hashtagTags: z.string().optional(),
  hashtagMode: z.enum(['append', 'prepend', 'replace', 'none']),

  animationPreset: z.enum([
    'None',
    'SlowZoomIn',
    'SlowZoomOut',
    'PanLeft',
    'PanRight',
    'PanUp',
    'PanDown',
  ]),

  bannedWords: z.string().optional(),
  minLength: z.coerce.number().min(0),
  maxLength: z.coerce.number().min(1),
  strictProfanity: z.boolean(),
});

type ContentProfileFormValues = z.infer<typeof contentProfileSchema>;

export default function CreateContentProfileScreen() {
  const router = useRouter();
  const createMutation = useCreateContentProfileMutation();

  const [expandedSection, setExpandedSection] = useState<'branding' | 'caption' | 'animation' | 'validation' | null>(null);

  const { data: contentTypes = [] } = useContentTypesQuery();
  const { data: prompts = [] } = usePromptsQuery();
  const { data: templates = [] } = useTemplatesQuery();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContentProfileFormValues>({
    resolver: zodResolver(contentProfileSchema),
    defaultValues: {
      name: '',
      notes: '',
      status: 'Active',
      language: 'English',
      tone: 'Inspiring',
      writingStyle: 'Direct',
      contentTypeId: '',
      promptVersionId: '',
      templateVersionId: '',
      brandingText: '',
      brandingPosition: 'bottom-right',
      brandingColor: '#ffffff',
      brandingOpacity: 0.8,
      watermarkText: '',
      watermarkPosition: 'bottom-left',
      watermarkOpacity: 0.5,
      captionTemplate: '',
      captionPrefix: '',
      captionSuffix: '',
      hashtagTags: 'quotes, motivation, publishiq',
      hashtagMode: 'append',
      animationPreset: 'SlowZoomIn',
      bannedWords: '',
      minLength: 10,
      maxLength: 280,
      strictProfanity: true,
    },
  });

  const selectedTypeId = watch('contentTypeId');
  const selectedPromptVersionId = watch('promptVersionId');
  const selectedTemplateVersionId = watch('templateVersionId');
  const strictProfanity = watch('strictProfanity');

  const toggleSection = (section: 'branding' | 'caption' | 'animation' | 'validation') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const onSubmit = (values: ContentProfileFormValues) => {
    const payload = {
      name: values.name,
      notes: values.notes || null,
      status: values.status,
      language: values.language,
      tone: values.tone,
      writingStyle: values.writingStyle,
      contentTypeId: values.contentTypeId,
      promptVersionId: values.promptVersionId,
      templateVersionId: values.templateVersionId,
      brandingRules: {
        text: values.brandingText || undefined,
        position: values.brandingPosition,
        color: values.brandingColor,
        opacity: values.brandingOpacity,
      },
      watermarkRules: {
        text: values.watermarkText || undefined,
        position: values.watermarkPosition,
        opacity: values.watermarkOpacity,
      },
      captionStrategy: {
        template: values.captionTemplate || undefined,
        prefix: values.captionPrefix || undefined,
        suffix: values.captionSuffix || undefined,
      },
      hashtagStrategy: {
        tags: values.hashtagTags
          ? values.hashtagTags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        mode: values.hashtagMode,
      },
      renderingConfiguration: {
        animation: {
          preset: values.animationPreset,
        },
      },
      validationRules: {
        bannedWords: values.bannedWords
          ? values.bannedWords.split(',').map((w) => w.trim()).filter(Boolean)
          : [],
        minLength: values.minLength,
        maxLength: values.maxLength,
        strictProfanity: values.strictProfanity,
      },
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        router.replace('/content-profiles');
      },
    });
  };

  // Flatten versions from prompts and templates
  const allPromptVersions: { id: string; label: string }[] = [];
  prompts.forEach((p) => {
    (p.versions || []).forEach((v: PromptVersion) => {
      allPromptVersions.push({
        id: v.id,
        label: `${p.name} (v${v.versionNumber})`,
      });
    });
  });

  const allTemplateVersions: { id: string; label: string }[] = [];
  templates.forEach((t) => {
    (t.versions || []).forEach((v: TemplateVersion) => {
      allTemplateVersions.push({
        id: v.id,
        label: `${t.name} (v${v.versionNumber})`,
      });
    });
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={styles.formCard}>
        {/* Profile Name */}
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field
              label="Profile Name"
              placeholder="e.g. Stoic Philosophy Shorts"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.name?.message}
              required
            />
          )}
        />

        {/* Language */}
        <View style={styles.sectionArea}>
          <Text style={styles.sectionLabel}>Target Language</Text>
          <Controller
            control={control}
            name="language"
            render={({ field: { onChange, value } }) => (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
                {(['English', 'Hindi', 'Urdu', 'HindiRoman', 'UrduRoman'] as Language[]).map((lang) => {
                  const isSelected = value === lang;
                  return (
                    <TouchableOpacity
                      key={lang}
                      style={[styles.pickerChip, isSelected && styles.pickerChipSelected]}
                      onPress={() => onChange(lang)}
                    >
                      <Text style={[styles.pickerChipText, isSelected && styles.pickerChipTextSelected]}>
                        {lang}
                      </Text>
                      {isSelected && <Check size={14} color="#fff" />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          />
        </View>

        {/* Tone & Writing Style */}
        <View style={styles.twoColumnRow}>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="tone"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label="Tone"
                  placeholder="e.g. Philosophical"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.tone?.message}
                  required
                />
              )}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="writingStyle"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label="Writing Style"
                  placeholder="e.g. Aphoristic"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.writingStyle?.message}
                  required
                />
              )}
            />
          </View>
        </View>

        {/* Status */}
        <View style={styles.sectionArea}>
          <Text style={styles.sectionLabel}>Status</Text>
          <Controller
            control={control}
            name="status"
            render={({ field: { onChange, value } }) => (
              <SegmentedControl<ContentProfileStatus>
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

        {/* Content Type Picker */}
        <View style={styles.sectionArea}>
          <Text style={styles.sectionLabel}>
            Content Type <Text style={styles.requiredAsterisk}>*</Text>
          </Text>
          {errors.contentTypeId && (
            <Text style={styles.fieldError}>{errors.contentTypeId.message}</Text>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
            {contentTypes.map((t) => {
              const isSelected = selectedTypeId === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.pickerChip, isSelected && styles.pickerChipSelected]}
                  onPress={() => setValue('contentTypeId', t.id)}
                >
                  <Text style={[styles.pickerChipText, isSelected && styles.pickerChipTextSelected]}>
                    {t.name}
                  </Text>
                  {isSelected && <Check size={14} color="#fff" />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Prompt Version Picker */}
        <View style={styles.sectionArea}>
          <Text style={styles.sectionLabel}>
            Prompt Version <Text style={styles.requiredAsterisk}>*</Text>
          </Text>
          {errors.promptVersionId && (
            <Text style={styles.fieldError}>{errors.promptVersionId.message}</Text>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
            {allPromptVersions.map((pv) => {
              const isSelected = selectedPromptVersionId === pv.id;
              return (
                <TouchableOpacity
                  key={pv.id}
                  style={[styles.pickerChip, isSelected && styles.pickerChipSelected]}
                  onPress={() => setValue('promptVersionId', pv.id)}
                >
                  <Text style={[styles.pickerChipText, isSelected && styles.pickerChipTextSelected]}>
                    {pv.label}
                  </Text>
                  {isSelected && <Check size={14} color="#fff" />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Template Version Picker */}
        <View style={styles.sectionArea}>
          <Text style={styles.sectionLabel}>
            Template Version <Text style={styles.requiredAsterisk}>*</Text>
          </Text>
          {errors.templateVersionId && (
            <Text style={styles.fieldError}>{errors.templateVersionId.message}</Text>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
            {allTemplateVersions.map((tv) => {
              const isSelected = selectedTemplateVersionId === tv.id;
              return (
                <TouchableOpacity
                  key={tv.id}
                  style={[styles.pickerChip, isSelected && styles.pickerChipSelected]}
                  onPress={() => setValue('templateVersionId', tv.id)}
                >
                  <Text style={[styles.pickerChipText, isSelected && styles.pickerChipTextSelected]}>
                    {tv.label}
                  </Text>
                  {isSelected && <Check size={14} color="#fff" />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Collapsible: Branding & Watermark */}
        <View style={styles.accordionBox}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('branding')}
          >
            <Text style={styles.accordionTitle}>Branding & Watermark Rules</Text>
            {expandedSection === 'branding' ? (
              <ChevronUp size={18} color={tokens.colors.textSubtle} />
            ) : (
              <ChevronDown size={18} color={tokens.colors.textSubtle} />
            )}
          </TouchableOpacity>

          {expandedSection === 'branding' && (
            <View style={styles.accordionBody}>
              <Controller
                control={control}
                name="brandingText"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field
                    label="Branding Text"
                    placeholder="@PublishIQ"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
              <Controller
                control={control}
                name="watermarkText"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field
                    label="Watermark Text"
                    placeholder="PublishIQ Originals"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
            </View>
          )}
        </View>

        {/* Collapsible: Caption & Hashtag Strategy */}
        <View style={styles.accordionBox}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('caption')}
          >
            <Text style={styles.accordionTitle}>Caption & Hashtags Strategy</Text>
            {expandedSection === 'caption' ? (
              <ChevronUp size={18} color={tokens.colors.textSubtle} />
            ) : (
              <ChevronDown size={18} color={tokens.colors.textSubtle} />
            )}
          </TouchableOpacity>

          {expandedSection === 'caption' && (
            <View style={styles.accordionBody}>
              <Controller
                control={control}
                name="captionTemplate"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field
                    label="Caption Template"
                    placeholder="{quote} — Follow for more daily wisdom."
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
              <Controller
                control={control}
                name="hashtagTags"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field
                    label="Default Hashtags (comma-separated)"
                    placeholder="quotes, wisdom, mindset"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
            </View>
          )}
        </View>

        {/* Collapsible: Animation & Rendering */}
        <View style={styles.accordionBox}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('animation')}
          >
            <Text style={styles.accordionTitle}>Rendering & Animation</Text>
            {expandedSection === 'animation' ? (
              <ChevronUp size={18} color={tokens.colors.textSubtle} />
            ) : (
              <ChevronDown size={18} color={tokens.colors.textSubtle} />
            )}
          </TouchableOpacity>

          {expandedSection === 'animation' && (
            <View style={styles.accordionBody}>
              <Text style={styles.sectionLabel}>Animation Preset</Text>
              <Controller
                control={control}
                name="animationPreset"
                render={({ field: { onChange, value } }) => (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
                    {[
                      'None',
                      'SlowZoomIn',
                      'SlowZoomOut',
                      'PanLeft',
                      'PanRight',
                      'PanUp',
                      'PanDown',
                    ].map((preset) => {
                      const isSelected = value === preset;
                      return (
                        <TouchableOpacity
                          key={preset}
                          style={[styles.pickerChip, isSelected && styles.pickerChipSelected]}
                          onPress={() => onChange(preset)}
                        >
                          <Text style={[styles.pickerChipText, isSelected && styles.pickerChipTextSelected]}>
                            {preset}
                          </Text>
                          {isSelected && <Check size={14} color="#fff" />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              />
            </View>
          )}
        </View>

        {/* Collapsible: Content Validation Rules */}
        <View style={styles.accordionBox}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection('validation')}
          >
            <Text style={styles.accordionTitle}>Content Quality & Validation Rules</Text>
            {expandedSection === 'validation' ? (
              <ChevronUp size={18} color={tokens.colors.textSubtle} />
            ) : (
              <ChevronDown size={18} color={tokens.colors.textSubtle} />
            )}
          </TouchableOpacity>

          {expandedSection === 'validation' && (
            <View style={styles.accordionBody}>
              <Controller
                control={control}
                name="bannedWords"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field
                    label="Banned Words (comma-separated)"
                    placeholder="spam, clickbait, promote"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
              <View style={styles.switchRow}>
                <View style={styles.switchLabelArea}>
                  <Text style={styles.switchTitle}>Strict Profanity Filter</Text>
                  <Text style={styles.switchSubtitle}>
                    Reject generation if flagged by profanity validator
                  </Text>
                </View>
                <Switch
                  value={strictProfanity}
                  onValueChange={(val) => setValue('strictProfanity', val)}
                  trackColor={{
                    false: tokens.colors.surfaceRaised,
                    true: tokens.colors.primary,
                  }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>
          )}
        </View>

        {/* Submit */}
        <Button
          variant="primary"
          size="lg"
          icon={Plus}
          isLoading={createMutation.isPending}
          loadingText="Creating Profile..."
          onPress={handleSubmit(onSubmit)}
          style={styles.submitButton}
        >
          Create Content Profile
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
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerRow: {
    gap: 8,
    paddingVertical: 2,
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
  accordionBox: {
    backgroundColor: tokens.colors.surfaceRaised,
    borderRadius: tokens.radius.input,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
  },
  accordionTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  accordionBody: {
    padding: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    gap: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
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
  submitButton: {
    marginTop: tokens.spacing.md,
  },
});
