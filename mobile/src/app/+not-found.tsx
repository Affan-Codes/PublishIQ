import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link, Stack } from 'expo-router';
import { AlertCircle } from 'lucide-react-native';
import { tokens } from '../design/tokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <AlertCircle size={32} color={tokens.colors.primaryLighter} />
        </View>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Text style={styles.message}>
          The requested route was not found in PublishIQ mobile.
        </Text>

        <Link href="/(app)/(tabs)" style={styles.link}>
          <Text style={styles.linkText}>Go to Dashboard</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.xl,
    backgroundColor: tokens.colors.bgPage,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.primaryBgSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.primaryBorderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.base,
  },
  title: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.text,
    textAlign: 'center',
  },
  message: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    color: tokens.colors.textMuted,
    textAlign: 'center',
    marginTop: tokens.spacing.xs,
    marginBottom: tokens.spacing.xl,
    maxWidth: 280,
  },
  link: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.button,
  },
  linkText: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.text,
  },
});
