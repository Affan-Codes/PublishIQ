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
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FileCode,
  Plus,
  ChevronRight,
  History,
  Search,
} from 'lucide-react-native';
import { usePromptsQuery } from '../../../hooks/queries/usePromptsQuery';
import { useCreatePromptMutation } from '../../../hooks/mutations/usePromptMutations';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Sheet } from '../../../components/ui/Sheet';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { tokens } from '../../../design/tokens';
import { getStatusBadge } from '../../../lib/status';
import { Prompt } from '../../../types/domain';

const promptCreateSchema = z.object({
  name: z.string().min(1, 'Prompt name is required').max(100),
  notes: z.string().max(500).optional(),
  body: z.string().min(10, 'Prompt body must be at least 10 characters'),
});

type PromptCreateValues = z.infer<typeof promptCreateSchema>;

export default function PromptsListScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: prompts = [], isLoading, isError, error, refetch, isRefetching } = usePromptsQuery();
  const createMutation = useCreatePromptMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PromptCreateValues>({
    resolver: zodResolver(promptCreateSchema),
    defaultValues: {
      name: '',
      notes: '',
      body: 'Generate a short, impactful thought about {{topic}} in {{language}}.\nTone: {{tone}}\nLength: Under 30 words.',
    },
  });

  const filteredPrompts = prompts.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onCreateSubmit = (values: PromptCreateValues) => {
    createMutation.mutate(
      {
        name: values.name,
        notes: values.notes || null,
        status: 'Active',
        body: values.body,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          reset();
        },
      }
    );
  };

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <ErrorState
          title="Failed to load prompts"
          message={(error as any)?.message}
          onRetry={refetch}
          onRefresh={refetch}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <Field
          label=""
          placeholder="Search prompt templates..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={{ marginBottom: 0 }}
        />
      </View>

      <FlatList
        data={filteredPrompts}
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
              <Text style={styles.headerTitle}>Prompt Templates</Text>
              <Text style={styles.headerSubtitle}>
                {filteredPrompts.length} templates configured
              </Text>
            </View>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onPress={() => setIsCreateOpen(true)}
            >
              New Prompt
            </Button>
          </View>
        }
        renderItem={({ item }) => {
          const statusBadge = getStatusBadge(item.status);
          const versionsCount = item.versions?.length || 1;
          const activeVersion = item.versions?.find((v) => v.status === 'Active') || item.versions?.[0];

          return (
            <Card
              style={styles.promptCard}
              onPress={() => router.push(`/prompts/${item.id}` as any)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.promptInfo}>
                  <Text style={styles.promptName}>{item.name}</Text>
                  {item.notes ? (
                    <Text style={styles.promptNotes} numberOfLines={2}>
                      {item.notes}
                    </Text>
                  ) : null}
                </View>
                <Badge
                  label={statusBadge.label}
                  variant={statusBadge.variant}
                  size="sm"
                />
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.versionBadge}>
                  <History size={12} color={tokens.colors.primaryLight} />
                  <Text style={styles.versionText}>
                    v{activeVersion?.versionNumber || 1} Active • {versionsCount} versions
                  </Text>
                </View>
                <ChevronRight size={16} color={tokens.colors.textSubtle} />
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <SkeletonList count={3} />
          ) : (
            <EmptyState
              icon={FileCode}
              title="No prompts found"
              description="Create reusable AI prompt templates with variable interpolation and version control."
              actionLabel="Create Prompt"
              onAction={() => setIsCreateOpen(true)}
            />
          )
        }
      />

      {/* Create Prompt Sheet */}
      <Sheet
        visible={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Prompt Template"
        subtitle="Version 1 will be created and activated"
      >
        <View style={styles.createSheetContent}>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label="Prompt Name"
                placeholder="e.g. Daily Tech Insight Generator"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.name?.message}
                required
              />
            )}
          />

          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label="Description / Notes"
                placeholder="Targeted at developer humor and concise statements"
                value={value || ''}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.notes?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="body"
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label="Prompt Body Template"
                monospace
                multiline
                numberOfLines={6}
                inputStyle={{ minHeight: 120, textAlignVertical: 'top' }}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                helperText="Use {{variable}} syntax for dynamic token interpolation"
                error={errors.body?.message}
                required
              />
            )}
          />

          <Button
            variant="primary"
            size="lg"
            icon={Plus}
            isLoading={createMutation.isPending}
            loadingText="Creating..."
            onPress={handleSubmit(onCreateSubmit)}
            style={{ marginTop: 8 }}
          >
            Create Prompt
          </Button>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bgApp,
  },
  searchBarContainer: {
    paddingHorizontal: tokens.spacing.base,
    paddingTop: tokens.spacing.md,
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
  promptCard: {
    padding: tokens.spacing.base,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  promptInfo: {
    flex: 1,
    paddingRight: 10,
  },
  promptName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  promptNotes: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: 10,
  },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  versionText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textSubtle,
    fontWeight: '600',
  },
  createSheetContent: {
    gap: 8,
    paddingBottom: 24,
  },
});
