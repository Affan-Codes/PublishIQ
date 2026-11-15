import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TextInput,
  Pressable,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Search,
  X,
  ArrowLeft,
  ChevronRight,
  Globe,
  Sparkles,
  Layers,
  FileCode,
  Clock,
  Upload,
  Image as ImageIcon,
  Video as VideoIcon,
  Music as MusicIcon,
  FileText,
} from 'lucide-react-native';
import { useSearchQuery } from '../../hooks/queries/useSearchQuery';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { SkeletonList } from '../../components/ui/Skeleton';
import { tokens } from '../../design/tokens';
import { formatDateTime } from '../../lib/format';
import {
  getPipelineStageStatus,
  getPublishRecordStatus,
  getChannelStatus,
  getAssetStatus,
  getStatusBadge,
} from '../../lib/status';
import {
  Channel,
  Prompt,
  Template,
  ContentProfile,
  Job,
  PublishingRecord,
  Asset,
  GeneratedContent,
} from '../../types/domain';

type SearchItem =
  | { type: 'channel'; data: Channel }
  | { type: 'prompt'; data: Prompt }
  | { type: 'template'; data: Template }
  | { type: 'contentProfile'; data: ContentProfile }
  | { type: 'job'; data: Job }
  | { type: 'publishingRecord'; data: PublishingRecord }
  | { type: 'asset'; data: Asset }
  | { type: 'generatedContent'; data: GeneratedContent };

interface SearchSection {
  title: string;
  data: SearchItem[];
}

export default function GlobalSearchScreen() {
  const router = useRouter();

  const [searchText, setSearchText] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchText.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const isQueryEligible = debouncedQuery.length >= 2;
  const { data: searchResults, isLoading, isFetching } = useSearchQuery(
    debouncedQuery,
    isQueryEligible
  );

  const sections: SearchSection[] = useMemo(() => {
    if (!searchResults || !isQueryEligible) return [];
    const list: SearchSection[] = [];

    if (searchResults.channels && searchResults.channels.length > 0) {
      list.push({
        title: 'Channels',
        data: searchResults.channels.map((c) => ({ type: 'channel', data: c })),
      });
    }
    if (searchResults.prompts && searchResults.prompts.length > 0) {
      list.push({
        title: 'Prompts',
        data: searchResults.prompts.map((p) => ({ type: 'prompt', data: p })),
      });
    }
    if (searchResults.templates && searchResults.templates.length > 0) {
      list.push({
        title: 'Templates',
        data: searchResults.templates.map((t) => ({ type: 'template', data: t })),
      });
    }
    if (searchResults.contentProfiles && searchResults.contentProfiles.length > 0) {
      list.push({
        title: 'Content Profiles',
        data: searchResults.contentProfiles.map((cp) => ({
          type: 'contentProfile',
          data: cp,
        })),
      });
    }
    if (searchResults.jobs && searchResults.jobs.length > 0) {
      list.push({
        title: 'Jobs',
        data: searchResults.jobs.map((j) => ({ type: 'job', data: j })),
      });
    }
    if (searchResults.publishingRecords && searchResults.publishingRecords.length > 0) {
      list.push({
        title: 'Publications',
        data: searchResults.publishingRecords.map((pr) => ({
          type: 'publishingRecord',
          data: pr,
        })),
      });
    }
    if (searchResults.assets && searchResults.assets.length > 0) {
      list.push({
        title: 'Assets',
        data: searchResults.assets.map((a) => ({ type: 'asset', data: a })),
      });
    }
    if (searchResults.generatedContents && searchResults.generatedContents.length > 0) {
      list.push({
        title: 'Generated Content',
        data: searchResults.generatedContents.map((gc) => ({
          type: 'generatedContent',
          data: gc,
        })),
      });
    }

    return list;
  }, [searchResults, isQueryEligible]);

  const handleNavigate = (item: SearchItem) => {
    switch (item.type) {
      case 'channel':
        router.push(`/channels/${item.data.id}` as any);
        break;
      case 'prompt':
        router.push(`/prompts/${item.data.id}` as any);
        break;
      case 'template':
        router.push(`/templates/${item.data.id}` as any);
        break;
      case 'contentProfile':
        router.push(`/content-profiles/${item.data.id}` as any);
        break;
      case 'job':
        router.push(`/jobs/${item.data.id}` as any);
        break;
      case 'publishingRecord':
        router.push(`/publishing/${item.data.id}` as any);
        break;
      case 'asset':
        router.push(`/assets/${item.data.id}` as any);
        break;
      case 'generatedContent':
        router.push(`/generated/${item.data.id}` as any);
        break;
    }
  };

  const renderItemContent = (item: SearchItem) => {
    switch (item.type) {
      case 'channel': {
        const status = getChannelStatus(item.data.status);
        return (
          <View style={styles.itemInner}>
            <View style={styles.iconWrap}>
              <Globe size={18} color={tokens.colors.primaryLight} />
            </View>
            <View style={styles.itemMain}>
              <View style={styles.itemTitleRow}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.data.name}
                </Text>
                <Badge
                  label={status.label}
                  bg={status.bg}
                  border={status.border}
                  textColor={status.text}
                  size="sm"
                />
              </View>
              <Text style={styles.itemSubtext}>
                Mode: {item.data.automationMode}
              </Text>
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </View>
        );
      }
      case 'prompt': {
        const badge = getStatusBadge(item.data.status);
        return (
          <View style={styles.itemInner}>
            <View style={styles.iconWrap}>
              <Sparkles size={18} color={tokens.colors.primaryLight} />
            </View>
            <View style={styles.itemMain}>
              <View style={styles.itemTitleRow}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.data.name}
                </Text>
                <Badge label={badge.label} variant={badge.variant} size="sm" />
              </View>
              {item.data.notes ? (
                <Text style={styles.itemSubtext} numberOfLines={1}>
                  {item.data.notes}
                </Text>
              ) : null}
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </View>
        );
      }
      case 'template': {
        const badge = getStatusBadge(item.data.status);
        return (
          <View style={styles.itemInner}>
            <View style={styles.iconWrap}>
              <FileCode size={18} color={tokens.colors.primaryLight} />
            </View>
            <View style={styles.itemMain}>
              <View style={styles.itemTitleRow}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.data.name}
                </Text>
                <Badge label={badge.label} variant={badge.variant} size="sm" />
              </View>
              {item.data.notes ? (
                <Text style={styles.itemSubtext} numberOfLines={1}>
                  {item.data.notes}
                </Text>
              ) : null}
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </View>
        );
      }
      case 'contentProfile': {
        const badge = getStatusBadge(item.data.status);
        return (
          <View style={styles.itemInner}>
            <View style={styles.iconWrap}>
              <Layers size={18} color={tokens.colors.primaryLight} />
            </View>
            <View style={styles.itemMain}>
              <View style={styles.itemTitleRow}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.data.name}
                </Text>
                <Badge label={badge.label} variant={badge.variant} size="sm" />
              </View>
              <Text style={styles.itemSubtext} numberOfLines={1}>
                Tone: {item.data.tone} • Language: {item.data.language}
              </Text>
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </View>
        );
      }
      case 'job': {
        const stageStatus = getPipelineStageStatus(item.data.pipelineStage);
        return (
          <View style={styles.itemInner}>
            <View style={styles.iconWrap}>
              <Clock size={18} color={tokens.colors.primaryLight} />
            </View>
            <View style={styles.itemMain}>
              <View style={styles.itemTitleRow}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.data.jobType}
                  {item.data.channel?.name ? ` • ${item.data.channel.name}` : ''}
                </Text>
                <Badge
                  label={stageStatus.label}
                  bg={stageStatus.bg}
                  border={stageStatus.border}
                  textColor={stageStatus.text}
                  size="sm"
                />
              </View>
              {item.data.failureReason ? (
                <Text style={[styles.itemSubtext, { color: tokens.colors.destructiveLight }]} numberOfLines={1}>
                  {item.data.failureReason}
                </Text>
              ) : (
                <Text style={styles.itemSubtext} numberOfLines={1}>
                  Stage: {item.data.pipelineStage || 'Draft'}
                </Text>
              )}
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </View>
        );
      }
      case 'publishingRecord': {
        const pubStatus = getPublishRecordStatus(item.data.status);
        return (
          <View style={styles.itemInner}>
            <View style={styles.iconWrap}>
              <Upload size={18} color={tokens.colors.primaryLight} />
            </View>
            <View style={styles.itemMain}>
              <View style={styles.itemTitleRow}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.data.platform}
                  {item.data.channel?.name ? ` • ${item.data.channel.name}` : ''}
                </Text>
                <Badge
                  label={pubStatus.label}
                  bg={pubStatus.bg}
                  border={pubStatus.border}
                  textColor={pubStatus.text}
                  size="sm"
                />
              </View>
              <Text style={styles.itemSubtext}>
                Published: {formatDateTime(item.data.publishedAt)}
              </Text>
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </View>
        );
      }
      case 'asset': {
        const assetStatus = getAssetStatus(item.data.status);
        const IconComponent =
          item.data.type === 'Music'
            ? MusicIcon
            : item.data.type === 'Font'
            ? FileText
            : ImageIcon;
        return (
          <View style={styles.itemInner}>
            <View style={styles.iconWrap}>
              <IconComponent size={18} color={tokens.colors.primaryLight} />
            </View>
            <View style={styles.itemMain}>
              <View style={styles.itemTitleRow}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.data.name}
                </Text>
                <Badge
                  label={assetStatus.label}
                  bg={assetStatus.bg}
                  border={assetStatus.border}
                  textColor={assetStatus.text}
                  size="sm"
                />
              </View>
              <Text style={styles.itemSubtext}>
                Type: {item.data.type}
                {item.data.licenseStatus ? ` • License: ${item.data.licenseStatus}` : ''}
              </Text>
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </View>
        );
      }
      case 'generatedContent': {
        return (
          <View style={styles.itemInner}>
            <View style={styles.iconWrap}>
              <FileText size={18} color={tokens.colors.primaryLight} />
            </View>
            <View style={styles.itemMain}>
              <Text style={styles.previewText} numberOfLines={2}>
                {item.data.text}
              </Text>
              <Text style={styles.itemSubtext}>
                Language: {item.data.language}
                {item.data.contentProfile?.name ? ` • ${item.data.contentProfile.name}` : ''}
              </Text>
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </View>
        );
      }
    }
  };

  const isSearching = (isLoading || isFetching) && isQueryEligible;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Search Header Bar */}
        <View style={styles.searchHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={22} color={tokens.colors.text} />
          </Pressable>

          <View style={styles.searchInputContainer}>
            <Search size={18} color={tokens.colors.textSubtle} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search all entities..."
              placeholderTextColor={tokens.colors.textSubtle}
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Global search input"
            />
            {searchText.length > 0 && (
              <Pressable
                onPress={() => setSearchText('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search text"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.clearButton}
              >
                <X size={16} color={tokens.colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Search Content */}
        {isSearching ? (
          <View style={styles.skeletonContainer}>
            <SkeletonList count={4} />
          </View>
        ) : !isQueryEligible ? (
          <View style={styles.centerContainer}>
            <View style={styles.promptIconCircle}>
              <Search size={32} color={tokens.colors.primaryLight} />
            </View>
            <Text style={styles.emptyTitle}>Search Workspace</Text>
            <Text style={styles.emptySubtitle}>
              Search across all workspace entities
            </Text>
            <Text style={styles.emptyHint}>
              Type at least 2 characters to search channels, prompts, templates, jobs, assets, and publications.
            </Text>
          </View>
        ) : sections.length === 0 ? (
          <View style={styles.centerContainer}>
            <View style={styles.promptIconCircle}>
              <Search size={32} color={tokens.colors.textSubtle} />
            </View>
            <Text style={styles.emptyTitle}>No matches found</Text>
            <Text style={styles.emptySubtitle}>
              No workspace entities matched &quot;{debouncedQuery}&quot;
            </Text>
            <Text style={styles.emptyHint}>
              Try refining your search keyword or checking for spelling errors.
            </Text>
          </View>
        ) : (
          <SectionList<SearchItem, SearchSection>
            sections={sections}
            keyExtractor={(item) => `${item.type}-${item.data.id}`}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{title}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <Card
                style={styles.resultCard}
                onPress={() => handleNavigate(item)}
              >
                {renderItemContent(item)}
              </Card>
            )}
            ItemSeparatorComponent={() => <View style={{ height: tokens.spacing.sm }} />}
            SectionSeparatorComponent={() => <View style={{ height: tokens.spacing.xs }} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bgApp,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.base,
    paddingVertical: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    gap: tokens.spacing.sm,
  },
  backButton: {
    padding: tokens.spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceRaised,
    borderRadius: tokens.radius.input,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.spacing.sm,
    height: 42,
  },
  searchIcon: {
    marginRight: tokens.spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    color: tokens.colors.text,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  skeletonContainer: {
    padding: tokens.spacing.base,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.xl,
    gap: tokens.spacing.sm,
  },
  promptIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  emptyTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    color: tokens.colors.textMuted,
    textAlign: 'center',
  },
  emptyHint: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textSubtle,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: tokens.spacing.xs,
  },
  listContent: {
    padding: tokens.spacing.base,
    paddingBottom: 40,
  },
  sectionHeader: {
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.xs,
  },
  sectionHeaderText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.label.fontSize,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: tokens.colors.textSubtle,
    letterSpacing: 0.8,
  },
  resultCard: {
    padding: tokens.spacing.md,
  },
  itemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.input,
    backgroundColor: tokens.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemMain: {
    flex: 1,
    gap: 3,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  itemName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.text,
    flex: 1,
  },
  itemSubtext: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  previewText: {
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
    fontSize: 12,
    color: tokens.colors.textPrimary,
    lineHeight: 17,
  },
});
