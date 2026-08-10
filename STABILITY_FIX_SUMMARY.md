# Stability Fix & Media Retention Summary

## Overview
A full-stack targeted stability and performance pass was performed on PublishIQ to eliminate blank white screens, standardize React Query cache data shapes, harden real-time Server-Sent Events (SSE) connections, and implement automated media retention cleanup.

---

## 1. Summary of Changes Per File

### Task A — Root-Level & Page-Scoped Error Boundaries (Frontend)
- **[`frontend/src/components/shared/ErrorBoundary.tsx`](file:///c:/Users/Admin/Desktop/PublishIQ/frontend/src/components/shared/ErrorBoundary.tsx)** [NEW]:
  - Class component implementing `componentDidCatch` and `getDerivedStateFromError`.
  - Logs unhandled render exceptions with full component stack trace (`console.error`).
  - Renders a styled dark-theme fallback panel with "Try Again" state reset and "Reload Application" button instead of crashing to a blank white screen. Shows developer stack trace in development mode.
- **[`frontend/src/App.tsx`](file:///c:/Users/Admin/Desktop/PublishIQ/frontend/src/App.tsx)**:
  - Wrapped `<AppContent />` in top-level `<ErrorBoundary>` inside `QueryClientProvider` to catch unhandled context and global rendering exceptions.
- **[`frontend/src/components/shared/DashboardLayout.tsx`](file:///c:/Users/Admin/Desktop/PublishIQ/frontend/src/components/shared/DashboardLayout.tsx)**:
  - Wrapped `<Outlet />` inside page `<main>` container with a secondary page-scoped `<ErrorBoundary>`. A crash in an individual route (e.g. Jobs view) will isolate to that route's body without taking down the navigation shell or sidebar.

### Task B — Standardized Notification Unread-Count Cache Shape (Frontend)
- **[`frontend/src/context/NotificationContext.tsx`](file:///c:/Users/Admin/Desktop/PublishIQ/frontend/src/context/NotificationContext.tsx)**:
  - Standardized the query key `['notifications', 'unread-count']` to a plain `number` shape.
  - `queryFn` unwraps `/api/v1/notifications/unread-count` response directly to return a plain `number`.
  - All cache setters `queryClient.setQueryData<number>(['notifications', 'unread-count'], ...)` write and read plain numbers.
- **[`frontend/src/lib/sse-client.ts`](file:///c:/Users/Admin/Desktop/PublishIQ/frontend/src/lib/sse-client.ts)**:
  - Updated SSE event listeners (`notification`, `unread_count_update`) to write `data.unreadCount` as plain number into `['notifications', 'unread-count']`, eliminating live shape-drift bugs.

### Task C — Hardened SSE Real-Time Client (Frontend)
- **[`frontend/src/lib/sse-client.ts`](file:///c:/Users/Admin/Desktop/PublishIQ/frontend/src/lib/sse-client.ts)**:
  - Implemented exponential backoff with jitter and a max retry ceiling (5 attempts) on `EventSource.onerror`.
  - Added user-visible Sonner toast warnings ("Notification stream disconnected. Reconnecting...") and success notifications upon recovery.
  - Added cleanup logic to fully close any existing `activeEventSource` instance before starting new connections, preventing stale socket leaks across auth state changes.
  - Implemented a 500ms debounce (`debouncedInvalidate`) for `queryClient.invalidateQueries` calls to prevent thundering-herd API refetches on rapid SSE event bursts.

### Task D — Automatic Media Retention Cleanup (Backend)
- **[`backend/src/config/env.ts`](file:///c:/Users/Admin/Desktop/PublishIQ/backend/src/config/env.ts)**:
  - Added `MEDIA_RETENTION_DAYS` environment variable using Zod validation (`z.coerce.number().default(14)`).
- **[`backend/.env.example`](file:///c:/Users/Admin/Desktop/PublishIQ/backend/.env.example)**:
  - Documented `MEDIA_RETENTION_DAYS=14`.
- **[`backend/prisma/schema.prisma`](file:///c:/Users/Admin/Desktop/PublishIQ/backend/prisma/schema.prisma)**:
  - Added `mediaDeletedAt DateTime?` column to `GeneratedContent` model.
- **[`backend/prisma/migrations/20260810072941_add_media_deleted_at/migration.sql`](file:///c:/Users/Admin/Desktop/PublishIQ/backend/prisma/migrations/20260810072941_add_media_deleted_at/migration.sql)** [NEW]:
  - Database migration adding `mediaDeletedAt` column to `GeneratedContent`.
- **[`backend/src/services/maintenance.service.ts`](file:///c:/Users/Admin/Desktop/PublishIQ/backend/src/services/maintenance.service.ts)**:
  - Implemented `runMediaCleanup()` function:
    1. Queries `GeneratedContent` rows linked to terminal jobs (`Completed`, `Failed`, `Archived`) older than `MEDIA_RETENTION_DAYS` (default 14 days).
    2. Verifies all linked `PublishingRecord` rows are in terminal status (`Success` or `Failure`).
    3. Invokes `localDiskStorageProvider.delete()` on `imageUrl` and `videoUrl` files.
    4. Sets `imageUrl = null`, `videoUrl = null`, and `mediaDeletedAt = new Date()`.
    5. Logs deletion audit entries with job IDs, file paths, and retention age.
  - Integrated `runMediaCleanup()` into scheduled worker cleanup `runCleanup()`.

---

## 2. Operator Action Checklist

For local development or deployment to production environments, operators should ensure the following steps:

1. **Database Migration**:
   - Run Prisma migrations on the target database:
     ```bash
     cd backend
     npx prisma migrate deploy
     ```
2. **Environment Configuration**:
   - (Optional) Configure custom media retention period in `backend/.env` (default is 14 days):
     ```env
     MEDIA_RETENTION_DAYS=14
     ```
3. **Build & Restart Verification**:
   - Compile frontend and backend bundles:
     ```bash
     cd frontend && npm run build
     cd backend && npm run build
     ```
