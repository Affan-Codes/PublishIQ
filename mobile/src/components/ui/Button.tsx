import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  PressableProps,
} from 'react-native';
import { tokens } from '../../design/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  icon?: React.ComponentType<{ size: number; color: string }>;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText,
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  style,
  textStyle,
  accessibilityLabel,
  ...rest
}) => {
  const isDisabled = disabled || isLoading;

  // Accessible label falls back to children if string
  const defaultLabel = typeof children === 'string' ? children : 'Button';
  const a11yLabel = accessibilityLabel || (loadingText && isLoading ? loadingText : defaultLabel);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      disabled={isDisabled}
      hitSlop={size === 'sm' ? { top: 8, bottom: 8, left: 8, right: 8 } : undefined}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      {...rest}
    >
      {isLoading ? (
        <>
          <ActivityIndicator
            size="small"
            color={getTextColor(variant, isDisabled)}
            style={styles.spinner}
          />
          {loadingText ? (
            <Text style={[styles.text, styles[`text_${size}`], { color: getTextColor(variant, isDisabled) }, textStyle]}>
              {loadingText}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && (
            <Icon size={getIconSize(size)} color={getTextColor(variant, isDisabled)} />
          )}
          <Text style={[styles.text, styles[`text_${size}`], { color: getTextColor(variant, isDisabled) }, textStyle]}>
            {children}
          </Text>
          {Icon && iconPosition === 'right' && (
            <Icon size={getIconSize(size)} color={getTextColor(variant, isDisabled)} />
          )}
        </>
      )}
    </Pressable>
  );
};

function getIconSize(size: ButtonSize): number {
  switch (size) {
    case 'sm':
      return 14;
    case 'lg':
      return 20;
    default:
      return 16;
  }
}

function getTextColor(variant: ButtonVariant, disabled: boolean): string {
  if (disabled) return tokens.colors.textDisabled;
  switch (variant) {
    case 'primary':
      return tokens.colors.text;
    case 'secondary':
      return tokens.colors.textPrimary;
    case 'outline':
      return tokens.colors.textPrimary;
    case 'danger':
      return tokens.colors.text;
    case 'ghost':
      return tokens.colors.textPrimary;
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.button,
    gap: tokens.spacing.sm,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.5,
  },
  spinner: {
    marginRight: 4,
  },

  // Sizes
  sm: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 32,
  },
  md: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44, // WCAG minimum hit height
  },
  lg: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    minHeight: 50,
  },

  // Variants
  primary: {
    backgroundColor: tokens.colors.primary,
  },
  secondary: {
    backgroundColor: tokens.colors.surfaceRaisedButton,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
  },
  danger: {
    backgroundColor: tokens.colors.destructive,
  },
  ghost: {
    backgroundColor: 'transparent',
  },

  // Text Styles
  text: {
    fontFamily: tokens.typography.fontFamily,
    fontWeight: '600',
    textAlign: 'center',
  },
  text_sm: {
    fontSize: 13,
    lineHeight: 18,
  },
  text_md: {
    fontSize: 14,
    lineHeight: 20,
  },
  text_lg: {
    fontSize: 16,
    lineHeight: 22,
  },
});
