import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import {
  LayoutDashboard,
  Layers,
  History,
  Bell,
  Menu,
  Search,
} from 'lucide-react-native';
import { useNotifications } from '../../../providers/NotificationProvider';
import { tokens } from '../../../design/tokens';

export default function TabsLayout() {
  const { unreadCount } = useNotifications();
  const router = useRouter();

  const renderSearchButton = () => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open global search"
      onPress={() => router.push('/search' as any)}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={styles.searchButton}
    >
      <Search size={20} color={tokens.colors.textMuted} />
    </Pressable>
  );

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: tokens.colors.surface,
        },
        headerTintColor: tokens.colors.text,
        headerTitleStyle: {
          fontFamily: tokens.typography.fontFamily,
          fontWeight: '700',
          fontSize: 18,
        },
        headerShadowVisible: false,
        headerRight: renderSearchButton,
        tabBarStyle: {
          backgroundColor: tokens.colors.surface,
          borderTopColor: tokens.colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: tokens.colors.primaryLighter,
        tabBarInactiveTintColor: tokens.colors.textSubtle,
        tabBarLabelStyle: {
          fontFamily: tokens.typography.fontFamily,
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'AI Pipeline',
          tabBarLabel: 'Jobs',
          tabBarIcon: ({ color, size }) => <Layers size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="publishing"
        options={{
          title: 'Publishing',
          tabBarLabel: 'Publishing',
          tabBarIcon: ({ color, size }) => <History size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarLabel: 'Alerts',
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: tokens.colors.primary,
            color: tokens.colors.text,
            fontSize: 10,
            fontWeight: '700',
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            lineHeight: 18,
          },
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarLabel: 'More',
          tabBarIcon: ({ color, size }) => <Menu size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  searchButton: {
    marginRight: 16,
    padding: 4,
  },
});
