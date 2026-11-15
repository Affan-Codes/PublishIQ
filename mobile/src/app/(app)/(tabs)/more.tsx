import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Activity,
  Search,
  Radio,
  Sliders,
  FileCode,
  Layout,
  FolderOpen,
  FolderTree,
  Building2,
  Settings as SettingsIcon,
  LogOut,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react-native';
import { useAuth } from '../../../providers/AuthProvider';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { tokens } from '../../../design/tokens';

export default function MoreScreen() {
  const router = useRouter();
  const { operator, signOut, hasRole } = useAuth();
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);

  const isPrivileged = hasRole(['Owner', 'Administrator']);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Operator Account Overview */}
      <Card style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileInitials}>
            {(operator?.email?.[0] || 'O').toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.operatorEmail}>{operator?.email}</Text>
          <Text style={styles.operatorRole}>
            Role: {operator?.role} {operator?.workspaceId ? `• Workspace: ${operator.workspaceId.slice(0, 8)}...` : ''}
          </Text>
        </View>
      </Card>

      {/* Operations Group */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>Operations</Text>
        <Card style={styles.groupCard}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/queue' as any)}
            style={styles.navRow}
          >
            <View style={styles.navLeading}>
              <Activity size={18} color={tokens.colors.primaryLighter} />
              <Text style={styles.navLabel}>Queue Management</Text>
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </Pressable>

          <View style={styles.separator} />

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/search' as any)}
            style={styles.navRow}
          >
            <View style={styles.navLeading}>
              <Search size={18} color={tokens.colors.primaryLighter} />
              <Text style={styles.navLabel}>Global Search</Text>
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </Pressable>
        </Card>
      </View>

      {/* Configuration Group */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>Configuration & Assets</Text>
        <Card style={styles.groupCard}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/channels' as any)}
            style={styles.navRow}
          >
            <View style={styles.navLeading}>
              <Radio size={18} color={tokens.colors.primaryLighter} />
              <Text style={styles.navLabel}>Channels</Text>
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </Pressable>

          <View style={styles.separator} />

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/content-profiles' as any)}
            style={styles.navRow}
          >
            <View style={styles.navLeading}>
              <Sliders size={18} color={tokens.colors.primaryLighter} />
              <Text style={styles.navLabel}>Content Profiles</Text>
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </Pressable>

          <View style={styles.separator} />

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/prompts' as any)}
            style={styles.navRow}
          >
            <View style={styles.navLeading}>
              <FileCode size={18} color={tokens.colors.primaryLighter} />
              <Text style={styles.navLabel}>Prompts Library</Text>
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </Pressable>

          <View style={styles.separator} />

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/templates' as any)}
            style={styles.navRow}
          >
            <View style={styles.navLeading}>
              <Layout size={18} color={tokens.colors.primaryLighter} />
              <Text style={styles.navLabel}>Templates</Text>
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </Pressable>

          <View style={styles.separator} />

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/assets' as any)}
            style={styles.navRow}
          >
            <View style={styles.navLeading}>
              <FolderOpen size={18} color={tokens.colors.primaryLighter} />
              <Text style={styles.navLabel}>Asset Library</Text>
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </Pressable>

          <View style={styles.separator} />

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/content-types' as any)}
            style={styles.navRow}
          >
            <View style={styles.navLeading}>
              <FolderTree size={18} color={tokens.colors.primaryLighter} />
              <Text style={styles.navLabel}>Content Types</Text>
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </Pressable>

          <View style={styles.separator} />

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/connections' as any)}
            style={styles.navRow}
          >
            <View style={styles.navLeading}>
              <ShieldAlert size={18} color={tokens.colors.primaryLighter} />
              <Text style={styles.navLabel}>Platform Connections</Text>
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </Pressable>

          {isPrivileged && (
            <>
              <View style={styles.separator} />
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/workspaces' as any)}
                style={styles.navRow}
              >
                <View style={styles.navLeading}>
                  <Building2 size={18} color={tokens.colors.primaryLighter} />
                  <Text style={styles.navLabel}>Workspaces</Text>
                </View>
                <ChevronRight size={16} color={tokens.colors.textSubtle} />
              </Pressable>
            </>
          )}
        </Card>
      </View>

      {/* Account & System Group */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>Account & System</Text>
        <Card style={styles.groupCard}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings' as any)}
            style={styles.navRow}
          >
            <View style={styles.navLeading}>
              <SettingsIcon size={18} color={tokens.colors.primaryLighter} />
              <Text style={styles.navLabel}>Settings & System Info</Text>
            </View>
            <ChevronRight size={16} color={tokens.colors.textSubtle} />
          </Pressable>

          <View style={styles.separator} />

          <Pressable
            accessibilityRole="button"
            onPress={() => setIsSignOutDialogOpen(true)}
            style={styles.navRow}
          >
            <View style={styles.navLeading}>
              <LogOut size={18} color={tokens.colors.destructiveLight} />
              <Text style={[styles.navLabel, { color: tokens.colors.destructiveLight }]}>
                Sign Out
              </Text>
            </View>
            <ChevronRight size={16} color={tokens.colors.destructiveLight} />
          </Pressable>
        </Card>
      </View>

      {/* Sign Out Confirm Dialog */}
      <ConfirmDialog
        visible={isSignOutDialogOpen}
        title="Sign Out"
        message="Are you sure you want to sign out of this operator session?"
        confirmLabel="Sign Out"
        variant="danger"
        onConfirm={async () => {
          setIsSignOutDialogOpen(false);
          await signOut();
        }}
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
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.base,
    padding: tokens.spacing.base,
    marginBottom: tokens.spacing.base,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  operatorEmail: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  operatorRole: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  group: {
    marginTop: tokens.spacing.base,
  },
  groupTitle: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  groupCard: {
    padding: 0,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: tokens.spacing.base,
  },
  navLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navLabel: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  separator: {
    height: 1,
    backgroundColor: tokens.colors.border,
    marginLeft: 44,
  },
});
