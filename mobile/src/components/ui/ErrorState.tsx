import React, { useState } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { Button } from './Button';
import { tokens } from '../../design/tokens';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => Promise<unknown> | void;
  onRefresh?: () => Promise<unknown> | void;
  style?: ViewStyle;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load data',
  message = 'An unexpected error occurred while fetching information from the server.',
  onRetry,
  onRefresh,
  style,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry) return;
    try {
      setIsRetrying(true);
      await Promise.resolve(onRetry());
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <AlertTriangle size={22} color={tokens.colors.destructiveLight} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.actionsRow}>
        {onRetry ? (
          <Button
            variant="danger"
            size="sm"
            isLoading={isRetrying}
            loadingText="Retrying..."
            onPress={handleRetry}
            icon={RefreshCw}
          >
            Try Again
          </Button>
        ) : null}

        {onRefresh ? (
          <Button
            variant="secondary"
            size="sm"
            onPress={onRefresh}
          >
            Refresh Data
          </Button>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.destructiveBgSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.destructiveBorderSubtle,
    borderRadius: tokens.radius.card,
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.pill,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.md,
  },
  title: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.destructiveLight,
    textAlign: 'center',
  },
  message: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.textMuted,
    textAlign: 'center',
    marginTop: tokens.spacing.xs,
    marginBottom: tokens.spacing.base,
    maxWidth: 300,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
  },
});
