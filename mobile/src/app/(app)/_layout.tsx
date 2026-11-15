import React from 'react';
import { Stack } from 'expo-router';
import { tokens } from '../../design/tokens';

export default function AppLayout() {
  return (
    <Stack
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
        contentStyle: { backgroundColor: tokens.colors.bgApp },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="jobs/[id]" options={{ title: 'Job Execution' }} />
      <Stack.Screen name="generated/[id]" options={{ title: 'Generated Content' }} />
      <Stack.Screen name="publishing/[id]" options={{ title: 'Publication Details' }} />
      <Stack.Screen name="queue" options={{ title: 'Queue Management' }} />
      <Stack.Screen name="channels/index" options={{ title: 'Channels' }} />
      <Stack.Screen name="channels/[id]" options={{ title: 'Channel Configuration' }} />
      <Stack.Screen name="channels/new" options={{ title: 'Create Channel' }} />
      <Stack.Screen name="content-profiles/index" options={{ title: 'Content Profiles' }} />
      <Stack.Screen name="content-profiles/[id]" options={{ title: 'Profile Configuration' }} />
      <Stack.Screen name="content-profiles/new" options={{ title: 'New Content Profile' }} />
      <Stack.Screen name="prompts/index" options={{ title: 'Prompts Library' }} />
      <Stack.Screen name="prompts/[id]" options={{ title: 'Prompt History' }} />
      <Stack.Screen name="prompts/[id]/new-version" options={{ title: 'New Prompt Version' }} />
      <Stack.Screen name="templates/index" options={{ title: 'Templates' }} />
      <Stack.Screen name="templates/[id]" options={{ title: 'Template Preview' }} />
      <Stack.Screen name="assets/index" options={{ title: 'Asset Library' }} />
      <Stack.Screen name="assets/new" options={{ title: 'Upload Asset' }} />
      <Stack.Screen name="assets/[id]" options={{ title: 'Asset Details' }} />
      <Stack.Screen name="content-types" options={{ title: 'Content Types' }} />
      <Stack.Screen name="workspaces" options={{ title: 'Workspaces' }} />
      <Stack.Screen name="connections" options={{ title: 'Platform Connections' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings & Account' }} />
      <Stack.Screen
        name="search"
        options={{
          presentation: 'modal',
          title: 'Global Search',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="notifications/[id]"
        options={{
          presentation: 'modal',
          title: 'Notification Details',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
