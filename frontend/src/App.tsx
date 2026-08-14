import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { NotificationProvider } from './context/NotificationContext.js';
import DashboardLayout from './components/shared/DashboardLayout.js';
import ErrorBoundary from './components/shared/ErrorBoundary.js';
import { PageSkeleton } from './components/ui/Skeleton.js';

// Lazy-loaded Page Views (Route Code Splitting)
const DashboardOverview = lazy(() => import('./routes/dashboard/DashboardOverview.js'));
const ChannelsView = lazy(() => import('./routes/channels/ChannelsView.js'));
const ContentProfilesView = lazy(() => import('./routes/content-profiles/ContentProfilesView.js'));
const PromptsView = lazy(() => import('./routes/prompts/PromptsView.js'));
const TemplatesView = lazy(() => import('./routes/templates/TemplatesView.js'));
const JobsView = lazy(() => import('./routes/jobs/JobsView.js'));
const QueueView = lazy(() => import('./routes/queue/QueueView.js'));
const NotificationsView = lazy(() => import('./routes/notifications/NotificationsView.js'));
const PublishingHistoryView = lazy(() => import('./routes/publishing-history/PublishingHistoryView.js'));
const AssetsView = lazy(() => import('./routes/assets/AssetsView.js'));
const ContentTypesView = lazy(() => import('./routes/content-types/ContentTypesView.js'));
const WorkspacesView = lazy(() => import('./routes/workspaces/WorkspacesView.js'));
const PlatformConnectionsView = lazy(() => import('./routes/platform-connections/PlatformConnectionsView.js'));
const LogsView = lazy(() => import('./routes/logs/LogsView.js'));
const SettingsView = lazy(() => import('./routes/settings/SettingsView.js'));
const LoginView = lazy(() => import('./routes/auth/LoginView.js'));
const NotFoundView = lazy(() => import('./routes/NotFoundView.js'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageSkeleton />;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export const AppContent: React.FC = () => {
  return (
    <BrowserRouter>
      {/* Global Sonner Toast Provider */}
      <Toaster position="bottom-right" theme="dark" richColors closeButton />

      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginView />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<DashboardOverview />} />
              <Route path="/channels" element={<ChannelsView />} />
              <Route path="/content-profiles" element={<ContentProfilesView />} />
              <Route path="/prompts" element={<PromptsView />} />
              <Route path="/templates" element={<TemplatesView />} />
              <Route path="/jobs" element={<JobsView />} />
              <Route path="/queue" element={<QueueView />} />
              <Route path="/notifications" element={<NotificationsView />} />
              <Route path="/publishing-history" element={<PublishingHistoryView />} />
              <Route path="/assets" element={<AssetsView />} />
              <Route path="/content-types" element={<ContentTypesView />} />
              <Route path="/workspaces" element={<WorkspacesView />} />
              <Route path="/platform-connections" element={<PlatformConnectionsView />} />
              <Route path="/logs" element={<LogsView />} />
              <Route path="/settings" element={<SettingsView />} />
            </Route>
          </Route>

          {/* 404 Route */}
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AuthProvider>
          <NotificationProvider>
            <AppContent />
          </NotificationProvider>
        </AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
};

export default App;
