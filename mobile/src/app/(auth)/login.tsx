import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogIn, Sparkles } from 'lucide-react-native';
import { useAuth } from '../../providers/AuthProvider';
import { useToast } from '../../providers/ToastProvider';
import { Field } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Banner } from '../../components/ui/Banner';
import { tokens } from '../../design/tokens';

const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(12, 'Password must be at least 12 characters long'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { signIn, isInitialNetworkError, retryInitialAuth } = useAuth();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setFormError(null);
    try {
      await signIn(data);
    } catch (err: any) {
      const msg = err?.message || 'Login failed. Please verify credentials.';
      setFormError(msg);
      toast.error(msg);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardContainer}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Sparkles size={24} color={tokens.colors.primaryLighter} />
            </View>
            <Text style={styles.title}>PublishIQ</Text>
            <Text style={styles.subtitle}>Sign in to the operator dashboard</Text>
          </View>

          {/* Cold-start network failure banner with Retry */}
          {isInitialNetworkError && (
            <View style={{ marginBottom: tokens.spacing.base }}>
              <Banner
                variant="offline"
                message="Cannot reach the server. Check your connection."
              />
              <Button
                variant="secondary"
                size="sm"
                onPress={retryInitialAuth}
                style={{ marginTop: 8 }}
              >
                Retry Connection
              </Button>
            </View>
          )}

          {/* Form error banner */}
          {formError && (
            <Banner
              variant="danger"
              message={formError}
              style={{ marginBottom: tokens.spacing.base }}
            />
          )}

          {/* Inputs */}
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label="Operator Email"
                placeholder="operator@publishiq.com"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="username"
                returnKeyType="next"
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label="Password"
                placeholder="••••••••••••"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
                isPassword
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleSubmit(onSubmit)}
              />
            )}
          />

          {/* Submit Button */}
          <Button
            variant="primary"
            size="lg"
            icon={LogIn}
            isLoading={isSubmitting}
            loadingText="Signing In as Operator..."
            onPress={handleSubmit(onSubmit)}
            style={styles.submitButton}
          >
            Sign In as Operator
          </Button>

          {/* Footer note */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              System configured for secure operator access.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: tokens.colors.bgPage,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: tokens.spacing.xl,
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.xl,
    padding: tokens.spacing.xxl,
    ...tokens.shadows.card,
  },
  header: {
    alignItems: 'center',
    marginBottom: tokens.spacing.xxl,
  },
  logoBadge: {
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
    fontSize: 28,
    fontWeight: '800',
    color: tokens.colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    color: tokens.colors.textMuted,
    marginTop: tokens.spacing.xs,
  },
  submitButton: {
    marginTop: tokens.spacing.base,
    width: '100%',
  },
  footer: {
    marginTop: tokens.spacing.xxl,
    paddingTop: tokens.spacing.base,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textSubtle,
    textAlign: 'center',
  },
});
