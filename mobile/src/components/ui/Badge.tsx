import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { tokens } from '../../design/tokens';

export interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';
  bg?: string;
  border?: string;
  textColor?: string;
  icon?: React.ComponentType<{ size: number; color: string }>;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  bg,
  border,
  textColor,
  icon: Icon,
  style,
  textStyle,
  size = 'sm',
}) => {
  const colors = getBadgeColors(variant);
  const finalBg = bg || colors.bg;
  const finalBorder = border || colors.border;
  const finalText = textColor || colors.text;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
      style={[
        styles.base,
        styles[size],
        {
          backgroundColor: finalBg,
          borderColor: finalBorder,
        },
        style,
      ]}
    >
      {Icon && <Icon size={size === 'sm' ? 11 : 13} color={finalText} />}
      <Text style={[styles.text, styles[`text_${size}`], { color: finalText }, textStyle]}>
        {label}
      </Text>
    </View>
  );
};

function getBadgeColors(variant: string) {
  switch (variant) {
    case 'success':
      return {
        bg: tokens.colors.successBgSubtle,
        border: tokens.colors.successBorderSubtle,
        text: tokens.colors.successLight,
      };
    case 'warning':
      return {
        bg: tokens.colors.warningBgSubtle,
        border: tokens.colors.warningBorderSubtle,
        text: tokens.colors.warningLight,
      };
    case 'danger':
      return {
        bg: tokens.colors.destructiveBgSubtle,
        border: tokens.colors.destructiveBorderSubtle,
        text: tokens.colors.destructiveText,
      };
    case 'info':
      return {
        bg: tokens.colors.infoBgSubtle,
        border: tokens.colors.infoBorderSubtle,
        text: tokens.colors.infoLight,
      };
    case 'primary':
      return {
        bg: tokens.colors.primaryBgSubtle,
        border: tokens.colors.primaryBorderSubtle,
        text: tokens.colors.primaryLighter,
      };
    default:
      return {
        bg: 'rgba(255, 255, 255, 0.05)',
        border: tokens.colors.border,
        text: tokens.colors.textSubtle,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    gap: 4,
    alignSelf: 'flex-start',
  },
  sm: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  md: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  text: {
    fontFamily: tokens.typography.fontFamily,
    fontWeight: '600',
  },
  text_sm: {
    fontSize: 11,
    lineHeight: 14,
  },
  text_md: {
    fontSize: 12,
    lineHeight: 16,
  },
});
