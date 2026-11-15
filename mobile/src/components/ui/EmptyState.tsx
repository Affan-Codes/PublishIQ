import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Button } from './Button';
import { tokens } from '../../design/tokens';

export interface EmptyStateProps {
  icon?: React.ComponentType<{ size: number; color: string }>;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {Icon && (
        <View style={styles.iconTile}>
          <Icon size={24} color={tokens.colors.primaryLighter} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Button
          variant="primary"
          size="sm"
          onPress={onAction}
          style={{ marginTop: tokens.spacing.base }}
        >
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xxl,
    paddingHorizontal: tokens.spacing.xl,
    backgroundColor: 'rgba(12, 12, 16, 0.5)',
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    borderStyle: 'dashed',
    borderRadius: tokens.radius.card,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: tokens.radius.button,
    backgroundColor: tokens.colors.primaryBgSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.primaryBorderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.md,
  },
  title: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
    textAlign: 'center',
  },
  description: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.textMuted,
    textAlign: 'center',
    marginTop: tokens.spacing.xs,
    maxWidth: 280,
    lineHeight: 18,
  },
});
