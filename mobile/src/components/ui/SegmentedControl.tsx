import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { tokens } from '../../design/tokens';

export interface SegmentOption<T extends string = string> {
  id: T;
  label: string;
  count?: number;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  selectedId: T;
  onChange: (id: T) => void;
  style?: ViewStyle;
}

export function SegmentedControl<T extends string = string>({
  options,
  selectedId,
  onChange,
  style,
}: SegmentedControlProps<T>): React.ReactElement {
  return (
    <View style={[styles.container, style]}>
      {options.map((option) => {
        const isSelected = option.id === selectedId;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${option.label}${option.count !== undefined ? ` (${option.count})` : ''}`}
            onPress={() => onChange(option.id)}
            style={[styles.segment, isSelected && styles.segmentSelected]}
          >
            <Text style={[styles.label, isSelected && styles.labelSelected]}>
              {option.label}
            </Text>
            {option.count !== undefined && (
              <View style={[styles.badge, isSelected && styles.badgeSelected]}>
                <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
                  {option.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surfaceRaised,
    borderRadius: tokens.radius.button,
    padding: 3,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: tokens.radius.input,
    gap: 6,
    minHeight: 36,
  },
  segmentSelected: {
    backgroundColor: tokens.colors.primary,
    ...tokens.shadows.card,
  },
  label: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.textSubtle,
  },
  labelSelected: {
    color: tokens.colors.text,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: tokens.radius.pill,
  },
  badgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  badgeText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.textMuted,
  },
  badgeTextSelected: {
    color: tokens.colors.text,
  },
});
