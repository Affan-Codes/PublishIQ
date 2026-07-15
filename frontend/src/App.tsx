import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { NotificationProvider, useNotifications } from './context/NotificationContext.js';
import DashboardLayout from './components/shared/DashboardLayout.js';

// Import Views
import DashboardOverview from './routes/dashboard/DashboardOverview.js';
import ChannelsView from './routes/channels/ChannelsView.js';
import ContentProfilesView from './routes/content-profiles/ContentProfilesView.js';
import TemplatesView from './routes/templates/TemplatesView.js';
import JobsView from './routes/jobs/JobsView.js';
import QueueView from './routes/queue/QueueView.js';
import PublishingHistoryView from './routes/publishing-history/PublishingHistoryView.js';
import AssetsView from './routes/assets/AssetsView.js';
import PlatformConnectionsView from './routes/platform-connections/PlatformConnectionsView.js';
import LogsView from './routes/logs/LogsView.js';
import SettingsView from './routes/settings/SettingsView.js';
import LoginView from './routes/auth/LoginView.js';
import NotFoundView from './routes/NotFoundView.js';

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
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0c] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
          <p className="text-sm text-[#9c9cb0]">Verifying operator session...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

const ToastOverlay: React.FC = () => {
  const { toasts, removeToast } = useNotifications();

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center justify-between rounded-lg px-4 py-3 shadow-xl backdrop-blur-md transition-all duration-300 border ${
            toast.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-200'
              : toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-[#161622] border-[#222233] text-gray-200'
          }`}
        >
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-4 text-xs font-bold opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export const AppContent: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginView />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<DashboardOverview />} />
            <Route path="/channels" element={<ChannelsView />} />
            <Route path="/content-profiles" element={<ContentProfilesView />} />
            <Route path="/templates" element={<TemplatesView />} />
            <Route path="/jobs" element={<JobsView />} />
            <Route path="/queue" element={<QueueView />} />
            <Route path="/publishing-history" element={<PublishingHistoryView />} />
            <Route path="/assets" element={<AssetsView />} />
            <Route path="/platform-connections" element={<PlatformConnectionsView />} />
            <Route path="/logs" element={<LogsView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Route>
        </Route>

        {/* 404 Route */}
        <Route path="*" element={<NotFoundView />} />
      </Routes>
      
      <ToastOverlay />
    </BrowserRouter>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
