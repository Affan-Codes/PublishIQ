import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import Constants from 'expo-constants';
import {
  User,
  Shield,
  Building,
  Globe,
  ExternalLink,
  LogOut,
  Info,
  FileText,
} from 'lucide-react-native';
import { useAuth } from '../../providers/AuthProvider';
import { tokens } from '../../design/tokens';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { env } from '../../lib/env';

export default function SettingsScreen() {
  const { operator, signOut } = useAuth();
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const appBuild =
    Constants.expoConfig?.ios?.buildNumber ||
    Constants.expoConfig?.android?.versionCode?.toString() ||
    '1';

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
    } finally {
      setIsSigningOut(false);
      setIsSignOutDialogOpen(false);
    }
  };

  const openUrl = async (url: string) => {
    const supported = await Linking.canOpenURL(url).catch(() => false);
    if (supported) {
      await Linking.openURL(url);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* SECTION: Account & Operator */}
      <View style={styles.sectionHeader}>
        <User size={18} color={tokens.colors.primaryLighter} />
        <Text style={styles.sectionTitle}>Operator Account</Text>
      </View>

      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{operator?.email || '—'}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.rowBetween}>
          <View style={styles.iconLabel}>
            <Shield size={14} color={tokens.colors.textSubtle} />
            <Text style={styles.label}>Role</Text>
          </View>
          <Badge
            label={operator?.role || 'User'}
            variant={operator?.role === 'Owner' || operator?.role === 'Administrator' ? 'primary' : 'neutral'}
            size="sm"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.rowBetween}>
          <View style={styles.iconLabel}>
            <Building size={14} color={tokens.colors.textSubtle} />
            <Text style={styles.label}>Workspace ID</Text>
          </View>
          <Text style={styles.monoValue} numberOfLines={1}>
            {operator?.workspaceId || 'Default'}
          </Text>
        </View>
      </Card>

      {/* SECTION: Environment & App Info */}
      <View style={styles.sectionHeader}>
        <Info size={18} color={tokens.colors.primaryLighter} />
        <Text style={styles.sectionTitle}>System & Build</Text>
      </View>

      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>App Version</Text>
          <Text style={styles.value}>
            v{appVersion} ({appBuild})
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.rowBetween}>
          <View style={styles.iconLabel}>
            <Globe size={14} color={tokens.colors.textSubtle} />
            <Text style={styles.label}>API Base URL</Text>
          </View>
          <Text style={styles.monoValue} numberOfLines={1}>
            {env.apiBaseUrl}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Architecture</Text>
          <Badge label="Expo SDK 57 (New Arch)" variant="info" size="sm" />
        </View>
      </Card>

      {/* SECTION: Legal & Compliance */}
      <View style={styles.sectionHeader}>
        <FileText size={18} color={tokens.colors.primaryLighter} />
        <Text style={styles.sectionTitle}>Legal & Privacy</Text>
      </View>

      <Card style={styles.card}>
        <Button
          variant="ghost"
          size="sm"
          icon={ExternalLink}
          iconPosition="right"
          onPress={() => openUrl('https://publishiq.app/privacy')}
          style={styles.legalButton}
        >
          Privacy Policy
        </Button>

        <View style={styles.divider} />

        <Button
          variant="ghost"
          size="sm"
          icon={ExternalLink}
          iconPosition="right"
          onPress={() => openUrl('https://publishiq.app/terms')}
          style={styles.legalButton}
        >
          Terms of Service
        </Button>
      </Card>

      {/* SECTION: Sign Out Action */}
      <View style={{ marginTop: tokens.spacing.xl, marginBottom: tokens.spacing.xxxl }}>
        <Button
          variant="danger"
          size="lg"
          icon={LogOut}
          onPress={() => setIsSignOutDialogOpen(true)}
        >
          Sign Out
        </Button>
      </View>

      <ConfirmDialog
        visible={isSignOutDialogOpen}
        title="Sign Out"
        message="Are you sure you want to end your operator session? You will need your credentials to sign back in."
        confirmLabel="Sign Out"
        variant="danger"
        isLoading={isSigningOut}
        onConfirm={handleSignOut}
        onCancel={() => setIsSignOutDialogOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bgApp,
  },
  content: {
    padding: tokens.spacing.base,
    gap: tokens.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.xs,
  },
  sectionTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  card: {
    padding: tokens.spacing.base,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.xs,
  },
  iconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.textMuted,
  },
  value: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  monoValue: {
    fontFamily: tokens.typography.mono.fontFamily,
    fontSize: 12,
    color: tokens.colors.primaryLighter,
    maxWidth: '55%',
  },
  divider: {
    height: 1,
    backgroundColor: tokens.colors.border,
    marginVertical: tokens.spacing.sm,
  },
  legalButton: {
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
});
