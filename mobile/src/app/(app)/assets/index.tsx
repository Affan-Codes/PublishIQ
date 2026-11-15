import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Plus,
  ChevronRight,
  Clock,
  Layers,
  Music,
  Image as ImageIcon,
  Type as TypeIcon,
  FileQuestion,
} from 'lucide-react-native';
import { useAssetsQuery } from '../../../hooks/queries/useAssetsQuery';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { tokens } from '../../../design/tokens';
import { getAssetStatus, getLicenseStatus } from '../../../lib/status';
import { formatDateTime, formatDuration } from '../../../lib/format';
import { Asset, AssetType } from '../../../types/domain';

const ASSET_TYPES: (AssetType | 'All')[] = [
  'All',
  'Background',
  'Font',
  'Music',
  'Logo',
  'Watermark',
  'Icon',
];

function getAssetTypeIcon(type: AssetType) {
  switch (type) {
    case 'Background':
    case 'Logo':
    case 'Watermark':
    case 'Icon':
      return ImageIcon;
    case 'Music':
      return Music;
    case 'Font':
      return TypeIcon;
    default:
      return FileQuestion;
  }
}

export default function AssetsListScreen() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<AssetType | 'All'>('All');

  const queryParams = useMemo(() => {
    return selectedType === 'All' ? undefined : { type: selectedType };
  }, [selectedType]);

  const {
    data: assets = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useAssetsQuery(queryParams);

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <ErrorState
          title="Failed to load assets"
          message={(error as any)?.message || 'Could not retrieve assets.'}
          onRetry={refetch}
          onRefresh={refetch}
        />
      </View>
    );
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerTop}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Asset Library</Text>
          <Text style={styles.headerSubtitle}>
            {assets.length} {assets.length === 1 ? 'asset' : 'assets'} available
          </Text>
        </View>
        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onPress={() => router.push('/assets/new' as any)}
        >
          Upload
        </Button>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {ASSET_TYPES.map((type) => {
          const isActive = selectedType === type;
          return (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${type}`}
              accessibilityState={{ selected: isActive }}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setSelectedType(type)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isActive && styles.filterChipTextActive,
                ]}
              >
                {type}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={tokens.colors.primaryLight}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          isLoading ? (
            <SkeletonList count={4} />
          ) : (
            <EmptyState
              icon={Layers}
              title={
                selectedType === 'All'
                  ? 'No assets found'
                  : `No ${selectedType} assets found`
              }
              description={
                selectedType === 'All'
                  ? 'Get started by uploading background images, fonts, music, or logos.'
                  : `Upload your first ${selectedType.toLowerCase()} asset to use in content generation.`
              }
              actionLabel="Upload Asset"
              onAction={() => router.push('/assets/new' as any)}
            />
          )
        }
        renderItem={({ item }) => {
          const TypeIconComponent = getAssetTypeIcon(item.type);
          const statusStyle = getAssetStatus(item.status);
          const licenseStyle = getLicenseStatus(item.licenseStatus);
          const musicDuration =
            item.type === 'Music' &&
            typeof (item.metadata as any)?.trimmedDuration === 'number'
              ? (item.metadata as any).trimmedDuration
              : null;

          return (
            <Card
              style={styles.assetCard}
              onPress={() => router.push(`/assets/${item.id}` as any)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.typeIconContainer}>
                  <TypeIconComponent
                    size={20}
                    color={tokens.colors.primaryLight}
                  />
                </View>
                <View style={styles.cardTitleContainer}>
                  <Text style={styles.assetName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.badgesRow}>
                    <Badge label={item.type} variant="neutral" size="sm" />
                    <Badge
                      label={statusStyle.label}
                      bg={statusStyle.bg}
                      border={statusStyle.border}
                      textColor={statusStyle.text}
                      size="sm"
                    />
                    <Badge
                      label={licenseStyle.label}
                      bg={licenseStyle.bg}
                      border={licenseStyle.border}
                      textColor={licenseStyle.text}
                      size="sm"
                    />
                  </View>
                </View>
                <ChevronRight size={18} color={tokens.colors.textSubtle} />
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.metaRow}>
                  <Clock size={12} color={tokens.colors.textMuted} />
                  <Text style={styles.metaText}>
                    {formatDateTime(item.createdAt)}
                  </Text>
                </View>
                {musicDuration !== null && (
                  <Text style={styles.durationText}>
                    {formatDuration(musicDuration)}
                  </Text>
                )}
              </View>
            </Card>
          );
        }}
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
    backgroundColor: tokens.colors.bgApp,
  },
  headerContainer: {
    marginBottom: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextContainer: {
    flex: 1,
    marginRight: tokens.spacing.md,
  },
  headerTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.title.fontSize,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  headerSubtitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.textMuted,
    marginTop: tokens.spacing.xxs,
  },
  filterScroll: {
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xxs,
  },
  filterChip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  filterChipActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primaryLight,
  },
  filterChipText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
    color: tokens.colors.textMuted,
  },
  filterChipTextActive: {
    color: tokens.colors.text,
  },
  assetCard: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  typeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.input,
    backgroundColor: tokens.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  cardTitleContainer: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  assetName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: tokens.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  metaText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
  },
  durationText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
    color: tokens.colors.primaryLight,
  },
});
