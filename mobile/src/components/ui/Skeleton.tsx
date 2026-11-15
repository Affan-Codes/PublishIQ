import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { tokens } from '../../design/tokens';

export interface SkeletonProps {
  width?: number | `${number}%` | 'auto';
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = tokens.radius.input,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1.0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeletonBox,
        {
          width: width as any,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const SkeletonStatCard: React.FC = () => (
  <View style={styles.statCard}>
    <Skeleton width={80} height={12} style={{ marginBottom: 8 }} />
    <Skeleton width={50} height={26} style={{ marginBottom: 6 }} />
    <Skeleton width={110} height={10} />
  </View>
);

export const SkeletonCard: React.FC = () => (
  <View style={styles.card}>
    <View style={styles.rowBetween}>
      <Skeleton width={120} height={16} />
      <Skeleton width={70} height={20} borderRadius={tokens.radius.pill} />
    </View>
    <Skeleton width="85%" height={14} style={{ marginTop: 12 }} />
    <Skeleton width="60%" height={12} style={{ marginTop: 8 }} />
    <View style={[styles.rowBetween, { marginTop: 16 }]}>
      <Skeleton width={90} height={12} />
      <Skeleton width={60} height={28} borderRadius={tokens.radius.button} />
    </View>
  </View>
);

export const SkeletonContentCard: React.FC = () => (
  <View style={styles.contentCard}>
    <Skeleton width="100%" height={160} borderRadius={tokens.radius.md} />
    <View style={{ marginTop: 12 }}>
      <Skeleton width="90%" height={16} style={{ marginBottom: 6 }} />
      <Skeleton width="70%" height={14} style={{ marginBottom: 10 }} />
      <View style={styles.rowBetween}>
        <Skeleton width={80} height={12} />
        <Skeleton width={60} height={12} />
      </View>
    </View>
  </View>
);

export const SkeletonRows: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <View style={styles.rowsContainer}>
    {Array.from({ length: rows }).map((_, index) => (
      <View key={index} style={styles.rowItem}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Skeleton width="60%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="40%" height={10} />
        </View>
        <Skeleton width={64} height={20} borderRadius={tokens.radius.pill} />
      </View>
    ))}
  </View>
);

export const SkeletonList: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <View style={{ gap: tokens.spacing.md }}>
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonCard key={index} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  skeletonBox: {
    backgroundColor: 'rgba(24, 24, 36, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(34, 34, 52, 0.4)',
  },
  statCard: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.card,
    padding: tokens.spacing.base,
    minWidth: 140,
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.card,
    padding: tokens.spacing.base,
  },
  contentCard: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.card,
    padding: tokens.spacing.md,
  },
  rowsContainer: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.card,
    overflow: 'hidden',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
