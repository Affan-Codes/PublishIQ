import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  RotateCcw,
  Activity,
  Layers,
  Radio,
  Share2,
  CheckCircle,
  Database,
  Cpu,
  Server,
  ArrowRight,
} from 'lucide-react-native';
import { useDashboardStatsQuery } from '../../../hooks/queries/useDashboardStatsQuery';
import { useRetryJobMutation } from '../../../hooks/mutations/useJobMutations';
import { useNotifications } from '../../../providers/NotificationProvider';
import { SkeletonStatCard, SkeletonCard } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Banner } from '../../../components/ui/Banner';
import { formatDateTime, formatRelativeTime } from '../../../lib/format';
import { getConnectionHealthStatus } from '../../../lib/status';
import { tokens } from '../../../design/tokens';

export default function DashboardScreen() {
  const router = useRouter();
  const { bannerMessage } = useNotifications();
  const { data, isLoading, isError, error, refetch, isRefetching } = useDashboardStatsQuery();
  const retryMutation = useRetryJobMutation();
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  const handleRetryJob = async (jobId: string) => {
    setRetryingJobId(jobId);
    try {
      await retryMutation.mutateAsync(jobId);
    } finally {
      setRetryingJobId(null);
    }
  };

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <ErrorState
          title="Failed to load dashboard metrics"
          message={(error as any)?.message || 'Could not communicate with background services.'}
          onRetry={refetch}
          onRefresh={refetch}
        />
      </View>
    );
  }

  const counters = data?.counters;
  const queues = data?.queues;
  const failedJobs = data?.failedJobs || [];
  const recentPubs = data?.recentPublications || [];
  const connections = data?.connections || [];
  const health = data?.health;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={tokens.colors.primaryLight}
          colors={[tokens.colors.primaryLight]}
        />
      }
    >
      {/* Realtime stream / polling banner if applicable */}
      {bannerMessage && (
        <Banner variant="warning" message={bannerMessage} style={{ marginBottom: 12 }} />
      )}

      {/* 1. KPI Horizontal Scroller */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Overview Metrics</Text>
      </View>

      {isLoading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kpiScroller}
        >
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </ScrollView>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kpiScroller}
        >
          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Channels</Text>
            <Text style={styles.kpiValue}>{counters?.totalChannels ?? 0}</Text>
            <Text style={styles.kpiSub}>Active publishing pipelines</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Generations</Text>
            <Text style={[styles.kpiValue, { color: tokens.colors.primaryLighter }]}>
              {counters?.totalGenerations ?? 0}
            </Text>
            <Text style={styles.kpiSub}>AI rendered content</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Published</Text>
            <Text style={[styles.kpiValue, { color: tokens.colors.successLight }]}>
              {counters?.totalPublishSuccess ?? 0}
            </Text>
            <Text style={styles.kpiSub}>Successful posts</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Failures</Text>
            <Text style={[styles.kpiValue, { color: tokens.colors.destructiveLight }]}>
              {counters?.totalPublishFailure ?? 0}
            </Text>
            <Text style={styles.kpiSub}>Failed attempts</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Success Rate</Text>
            <Text style={[styles.kpiValue, { color: tokens.colors.cyanLight }]}>
              {counters?.successRate !== undefined ? `${Math.round(counters.successRate * 100)}%` : '—'}
            </Text>
            <Text style={styles.kpiSub}>Pipeline reliability</Text>
          </Card>
        </ScrollView>
      )}

      {/* 2. Critical Failures Section (Rendered first if any exist per Section 10.2) */}
      {!isLoading && failedJobs.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.titleWithIcon}>
              <AlertTriangle size={18} color={tokens.colors.destructiveLight} />
              <Text style={[styles.sectionTitle, { color: tokens.colors.destructiveLight }]}>
                Attention Needed ({failedJobs.length})
              </Text>
            </View>
            <Pressable onPress={() => router.push('/(app)/queue')}>
              <Text style={styles.linkText}>View Queue</Text>
            </Pressable>
          </View>

          <View style={{ gap: tokens.spacing.md }}>
            {failedJobs.map((job) => (
              <Card
                key={job.id}
                onPress={() => router.push(`/(app)/jobs/${job.id}`)}
                style={styles.failureCard}
              >
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.jobChannelName}>
                      {job.channel?.name || 'Manual Run'}
                    </Text>
                    <Text style={styles.jobIdText}>ID: {job.id}</Text>
                  </View>
                  <Badge
                    label={job.failureStage || 'Failed'}
                    variant="danger"
                    size="sm"
                  />
                </View>

                {job.failureReason ? (
                  <Text style={styles.failureReason} numberOfLines={2}>
                    {job.failureReason}
                  </Text>
                ) : null}

                <View style={[styles.rowBetween, { marginTop: 12 }]}>
                  <Text style={styles.metaTime}>
                    {formatRelativeTime(job.failedAt)} (Attempt {job.retryCount + 1})
                  </Text>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={RotateCcw}
                    isLoading={retryingJobId === job.id}
                    loadingText="Retrying..."
                    onPress={() => handleRetryJob(job.id)}
                  >
                    Retry
                  </Button>
                </View>
              </Card>
            ))}
          </View>
        </View>
      )}

      {/* 3. Queue Summary */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.titleWithIcon}>
            <Activity size={18} color={tokens.colors.primaryLighter} />
            <Text style={styles.sectionTitle}>Queue Engine</Text>
          </View>
          <Pressable onPress={() => router.push('/(app)/queue')} style={styles.rowCentered}>
            <Text style={styles.linkText}>Manage Queue</Text>
            <ArrowRight size={14} color={tokens.colors.primaryLighter} />
          </Pressable>
        </View>

        {isLoading ? (
          <SkeletonCard />
        ) : (
          <Card onPress={() => router.push('/(app)/queue')}>
            <View style={styles.queueGrid}>
              <View style={styles.queueItem}>
                <Text style={styles.queueLabel}>Active</Text>
                <Text style={[styles.queueCount, { color: tokens.colors.primaryLighter }]}>
                  {queues?.active ?? 0}
                </Text>
              </View>
              <View style={styles.queueItem}>
                <Text style={styles.queueLabel}>Waiting</Text>
                <Text style={[styles.queueCount, { color: tokens.colors.warningLight }]}>
                  {queues?.waiting ?? 0}
                </Text>
              </View>
              <View style={styles.queueItem}>
                <Text style={styles.queueLabel}>Delayed</Text>
                <Text style={styles.queueCount}>{queues?.delayed ?? 0}</Text>
              </View>
              <View style={styles.queueItem}>
                <Text style={styles.queueLabel}>Failed</Text>
                <Text style={[styles.queueCount, { color: tokens.colors.destructiveLight }]}>
                  {queues?.failed ?? 0}
                </Text>
              </View>
              <View style={styles.queueItem}>
                <Text style={styles.queueLabel}>Completed</Text>
                <Text style={[styles.queueCount, { color: tokens.colors.successLight }]}>
                  {queues?.completed ?? 0}
                </Text>
              </View>
            </View>
          </Card>
        )}
      </View>

      {/* 4. Connected Platforms Health */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.titleWithIcon}>
            <Radio size={18} color={tokens.colors.primaryLighter} />
            <Text style={styles.sectionTitle}>Platform Connections</Text>
          </View>
          <Pressable onPress={() => router.push('/connections' as any)}>
            <Text style={styles.linkText}>All Connections</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <SkeletonCard />
        ) : connections.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No platform connections configured.</Text>
          </Card>
        ) : (
          <View style={styles.connectionsRow}>
            {connections.map((conn, idx) => {
              const statusConfig = getConnectionHealthStatus(conn.healthStatus);
              return (
                <View key={idx} style={styles.connectionChip}>
                  <Text style={styles.connectionName}>{conn.platform}</Text>
                  <Badge
                    label={statusConfig.label}
                    bg={statusConfig.bg}
                    border={statusConfig.border}
                    textColor={statusConfig.text}
                    size="sm"
                  />
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* 5. Recent Publications */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.titleWithIcon}>
            <Share2 size={18} color={tokens.colors.primaryLighter} />
            <Text style={styles.sectionTitle}>Recent Publications</Text>
          </View>
          <Pressable onPress={() => router.push('/(app)/(tabs)/publishing')}>
            <Text style={styles.linkText}>View History</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <SkeletonCard />
        ) : recentPubs.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No recent publication records found.</Text>
          </Card>
        ) : (
          <View style={{ gap: tokens.spacing.md }}>
            {recentPubs.slice(0, 4).map((pub) => (
              <Card
                key={pub.id}
                onPress={() => router.push(`/(app)/publishing/${pub.id}`)}
              >
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.pubChannelName}>{pub.channel?.name || 'Social Post'}</Text>
                    <Text style={styles.metaTime}>
                      {pub.platform} • {formatDateTime(pub.publishedAt)}
                    </Text>
                  </View>
                  <Badge
                    label={pub.status}
                    variant={pub.status === 'Success' ? 'success' : 'danger'}
                    size="sm"
                  />
                </View>
                {pub.generatedContent?.text ? (
                  <Text style={styles.pubSnippet} numberOfLines={2}>
                    "{pub.generatedContent.text}"
                  </Text>
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </View>

      {/* 6. System Health */}
      <View style={[styles.section, { marginBottom: 32 }]}>
        <View style={styles.titleWithIcon}>
          <Server size={18} color={tokens.colors.textSubtle} />
          <Text style={styles.sectionTitle}>System Health</Text>
        </View>

        <Card style={{ marginTop: 8 }}>
          <View style={styles.systemHealthRow}>
            <View style={styles.systemHealthItem}>
              <View style={styles.rowCentered}>
                <Database size={14} color={tokens.colors.textMuted} />
                <Text style={styles.healthLabel}>Database</Text>
              </View>
              <Badge
                label={health?.database || 'OK'}
                variant={health?.database === 'unhealthy' ? 'danger' : 'success'}
                size="sm"
              />
            </View>

            <View style={styles.systemHealthItem}>
              <View style={styles.rowCentered}>
                <Activity size={14} color={tokens.colors.textMuted} />
                <Text style={styles.healthLabel}>Valkey</Text>
              </View>
              <Badge
                label={health?.valkey || 'OK'}
                variant="success"
                size="sm"
              />
            </View>

            <View style={styles.systemHealthItem}>
              <View style={styles.rowCentered}>
                <Cpu size={14} color={tokens.colors.textMuted} />
                <Text style={styles.healthLabel}>Worker Nodes</Text>
              </View>
              <Badge
                label={
                  typeof health?.worker === 'object'
                    ? `${health.worker.count} Active`
                    : String(health?.worker || '1 Node')
                }
                variant="success"
                size="sm"
              />
            </View>
          </View>
        </Card>
      </View>
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
  },
  errorContainer: {
    flex: 1,
    padding: tokens.spacing.xl,
    justifyContent: 'center',
    backgroundColor: tokens.colors.bgApp,
  },
  section: {
    marginTop: tokens.spacing.xl,
  },
  sectionHeader: {
    marginBottom: tokens.spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.sm,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  linkText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.primaryLighter,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  // KPI cards
  kpiScroller: {
    gap: tokens.spacing.md,
    paddingBottom: 4,
  },
  kpiCard: {
    width: 140,
    padding: tokens.spacing.base,
  },
  kpiLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 24,
    fontWeight: '800',
    color: tokens.colors.text,
    marginVertical: 4,
  },
  kpiSub: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textMuted,
  },

  // Failures
  failureCard: {
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.destructiveLight,
  },
  jobChannelName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  jobIdText: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: tokens.colors.textSubtle,
    marginTop: 2,
  },
  failureReason: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.destructiveText,
    marginTop: 6,
    lineHeight: 16,
  },
  metaTime: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textMuted,
  },

  // Queue
  queueGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  queueItem: {
    alignItems: 'center',
    flex: 1,
  },
  queueLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    color: tokens.colors.textSubtle,
    marginBottom: 4,
  },
  queueCount: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text,
  },

  // Connections
  connectionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.md,
  },
  connectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.input,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  connectionName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.text,
  },

  // Publications
  pubChannelName: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  pubSnippet: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 6,
    fontStyle: 'italic',
    lineHeight: 16,
  },

  // System Health
  systemHealthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  systemHealthItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  healthLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  emptyText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.textSubtle,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
