import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle, StyleProp, PressableProps } from 'react-native';
import { tokens } from '../../design/tokens';

export interface CardProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'raised';
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  style,
  variant = 'default',
  ...rest
}) => {
  const cardStyle = [
    styles.card,
    variant === 'raised' && styles.raised,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          styles.pressable,
          pressed && styles.pressed,
        ]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.card,
    padding: tokens.spacing.base,
    ...tokens.shadows.card,
  },
  raised: {
    backgroundColor: tokens.colors.surfaceRaised,
    borderColor: tokens.colors.borderStrong,
  },
  pressable: {
    cursor: 'pointer',
  },
  pressed: {
    borderColor: tokens.colors.primaryBorderSubtle,
    backgroundColor: tokens.colors.surfaceHover,
    transform: [{ scale: 0.99 }],
  },
});
