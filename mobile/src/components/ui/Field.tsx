import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  Pressable,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { AlertCircle, Eye, EyeOff } from 'lucide-react-native';
import { tokens } from '../../design/tokens';

export interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  isPassword?: boolean;
  monospace?: boolean;
}

export const Field = React.forwardRef<TextInput, FieldProps>(
  (
    {
      label,
      error,
      helperText,
      required = false,
      containerStyle,
      inputStyle,
      isPassword = false,
      monospace = false,
      secureTextEntry,
      ...rest
    },
    ref
  ) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const isSecure = isPassword && !isPasswordVisible;

    return (
      <View style={[styles.container, containerStyle]}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.requiredAsterisk}> *</Text>}
          </Text>
        </View>

        <View
          style={[
            styles.inputWrapper,
            isFocused && styles.inputFocused,
            Boolean(error) && styles.inputError,
          ]}
        >
          <TextInput
            ref={ref}
            accessibilityLabel={label}
            accessibilityState={{ disabled: rest.editable === false }}
            placeholderTextColor={tokens.colors.textSubtle}
            secureTextEntry={isPassword ? isSecure : secureTextEntry}
            onFocus={(e) => {
              setIsFocused(true);
              rest.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              rest.onBlur?.(e);
            }}
            style={[
              styles.input,
              monospace && styles.monospaceText,
              isPassword && { paddingRight: 40 },
              inputStyle,
            ]}
            {...rest}
          />

          {isPassword && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              style={styles.eyeButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isPasswordVisible ? (
                <EyeOff size={18} color={tokens.colors.textSubtle} />
              ) : (
                <Eye size={18} color={tokens.colors.textSubtle} />
              )}
            </Pressable>
          )}
        </View>

        {error ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={styles.errorRow}
          >
            <AlertCircle size={14} color={tokens.colors.destructiveLight} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : helperText ? (
          <Text style={styles.helperText}>{helperText}</Text>
        ) : null}
      </View>
    );
  }
);

Field.displayName = 'Field';

const styles = StyleSheet.create({
  container: {
    marginBottom: tokens.spacing.base,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
  },
  label: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
  },
  requiredAsterisk: {
    color: tokens.colors.destructiveLight,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.input,
    minHeight: 44, // WCAG accessibility standard
  },
  inputFocused: {
    borderColor: tokens.colors.primaryLight,
  },
  inputError: {
    borderColor: tokens.colors.destructive,
  },
  input: {
    flex: 1,
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    color: tokens.colors.text,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    minHeight: 44,
  },
  monospaceText: {
    fontFamily: 'Courier',
    fontSize: 13,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  errorText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.destructiveLight,
    flex: 1,
  },
  helperText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 4,
  },
});
