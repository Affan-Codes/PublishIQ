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
  Layout,
  ChevronRight,
  History,
  Layers,
  Sparkles,
  Eye,
} from 'lucide-react-native';
import { useTemplatesQuery } from '../../../hooks/queries/useTemplatesQuery';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { tokens } from '../../../design/tokens';
import { getStatusBadge } from '../../../lib/status';
import { Template } from '../../../types/domain';

const CATEGORY_LABELS: Record<string, string> = {
  CodeAnalogy: 'Code Analogy',
  MinimalQuote: 'Minimal Quote',
  SplitStatement: 'Split Statement',
  Terminal: 'Terminal',
  CodeBlock: 'Code Block',
};

export default function TemplatesListScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: templates = [], isLoading, isError, error, refetch, isRefetching } = useTemplatesQuery();

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <ErrorState
          title="Failed to load templates"
          message={(error as any)?.message}
          onRetry={refetch}
          onRefresh={refetch}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchBar}>
        <Field
          label=""
          placeholder="Search templates..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={{ marginBottom: 0 }}
        />
      </View>

      <FlatList
        data={filteredTemplates}
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
              <Text style={styles.headerTitle}>Design Templates</Text>
              <Text style={styles.headerSubtitle}>
                {filteredTemplates.length} layout templates available
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const statusBadge = getStatusBadge(item.status);
          const versionsCount = item.versions?.length || 1;
          const activeVersion =
            item.versions?.find((v) => v.status === 'Active') || item.versions?.[0];
          const categoryName = activeVersion?.category
            ? CATEGORY_LABELS[activeVersion.category] || activeVersion.category
            : 'Minimal Quote';

          return (
            <Card
              style={styles.templateCard}
              onPress={() => router.push(`/templates/${item.id}` as any)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.templateInfo}>
                  <Text style={styles.templateName}>{item.name}</Text>
                  <Text style={styles.categoryText}>{categoryName}</Text>
                </View>
                <Badge
                  label={statusBadge.label}
                  variant={statusBadge.variant}
                  size="sm"
                />
              </View>

              {item.notes ? (
                <Text style={styles.templateNotes} numberOfLines={2}>
                  {item.notes}
                </Text>
              ) : null}

              <View style={styles.cardFooter}>
                <View style={styles.versionRow}>
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
              icon={Layout}
              title="No templates found"
              description="Design templates define typography, color palettes, and visual hierarchy for short video generation."
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bgApp,
  },
  searchBar: {
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
    marginBottom: tokens.spacing.sm,
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
  templateCard: {
    padding: tokens.spacing.base,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  templateInfo: {
    flex: 1,
    paddingRight: 10,
  },
  templateName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  categoryText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.primaryLight,
    fontWeight: '600',
    marginTop: 2,
  },
  templateNotes: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
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
  versionRow: {
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
});
