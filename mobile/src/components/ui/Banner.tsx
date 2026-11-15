import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { WifiOff, AlertTriangle, Info, AlertCircle } from 'lucide-react-native';
import { tokens } from '../../design/tokens';

export type BannerVariant = 'warning' | 'danger' | 'info' | 'offline';

export interface BannerProps {
  message: string;
  variant?: BannerVariant;
  style?: ViewStyle;
}

export const Banner: React.FC<BannerProps> = ({
  message,
  variant = 'warning',
  style,
}) => {
  const config = getBannerConfig(variant);
  const Icon = config.icon;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
        },
        style,
      ]}
    >
      <Icon size={16} color={config.iconColor} />
      <Text style={[styles.text, { color: config.textColor }]}>{message}</Text>
    </View>
  );
};

function getBannerConfig(variant: BannerVariant) {
  switch (variant) {
    case 'offline':
      return {
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(251, 191, 36, 0.3)',
        textColor: tokens.colors.warningLight,
        iconColor: tokens.colors.warningLight,
        icon: WifiOff,
      };
    case 'danger':
      return {
        bg: tokens.colors.destructiveBgSubtle,
        border: tokens.colors.destructiveBorderSubtle,
        textColor: tokens.colors.destructiveLight,
        iconColor: tokens.colors.destructiveLight,
        icon: AlertCircle,
      };
    case 'info':
      return {
        bg: tokens.colors.infoBgSubtle,
        border: tokens.colors.infoBorderSubtle,
        textColor: tokens.colors.infoLight,
        iconColor: tokens.colors.infoLight,
        icon: Info,
      };
    case 'warning':
    default:
      return {
        bg: tokens.colors.warningBgSubtle,
        border: tokens.colors.warningBorderSubtle,
        textColor: tokens.colors.warningLight,
        iconColor: tokens.colors.warningLight,
        icon: AlertTriangle,
      };
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: tokens.spacing.base,
    borderWidth: 1,
    borderRadius: tokens.radius.input,
    gap: tokens.spacing.sm,
    marginVertical: 4,
  },
  text: {
    flex: 1,
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
});
