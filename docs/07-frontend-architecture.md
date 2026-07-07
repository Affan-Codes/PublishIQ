# 07 — Frontend Architecture

**Status:** Draft — pending approval
**Version:** 1.0
**Last revised:** 2026-07-04
**Owning document for:** Dashboard SPA structure, routing, state management, real-time update mechanism, module-to-route mapping.
**Does not own:** Visual/interaction design system specifics (a `frontend-design`-skill concern at implementation time, not frozen here), backend contracts (`06-backend-architecture.md`), technology rationale (`03-technical-requirements.md`).

---

## 1. Stack Recap (from `03-technical-requirements.md`)

React + TypeScript, built with Vite. Server state via **React Query** (formerly TanStack Query) — chosen specifically because it removes the need for Redux/global-store boilerplate for what is, functionally, a dashboard whose entire job is "fetch, display, occasionally mutate, refetch." Local/UI-only state (open modals, form drafts, active filter selections) uses plain React `useState`/`useReducer` and, where genuinely cross-component, a small number of narrowly-scoped React Contexts — not a global store.

**Explicitly rejected:** Redux/MobX/Zustand as a global store. Nothing in this Dashboard needs client-side state that outlives a single query cache entry; adding a global store would duplicate what React Query already does for server data and add ceremony for the UI-only state that doesn't need it.

---

## 2. Routing — Module-to-Route Mapping

Routes map directly onto the 11 frozen Dashboard Modules (`PROJECT_DECISIONS.md` Section 30), with the PRD's provisional placements (A-1, A-11) honored exactly as flagged — as sub-views inside an existing module, not as new top-level routes, since Section 30 is frozen pending its own future revision:

| Route | Module | Notes |
|---|---|---|
| `/` | Dashboard (overview) | FR-NAV-02/03 |
| `/channels` | Channels | FR-CHN-01/02, FR-AUT-01/02/03 |
| `/content-profiles` | Content Profiles | FR-CFG-01–04 |
| `/templates` | Templates | FR-TPL-01–04 **and** Prompt Library (FR-PRM-01–04) as a tab within this module — the PRD's A-1 placement, made concrete |
| `/jobs` | Jobs | FR-JOB-01–07, FR-MON-01, **and** Generated Content Management (FR-GC-01–06) as a tab within this module — A-11's placement, made concrete |
| `/queue` | Queue | FR-QUE-01–08 |
| `/publishing-history` | Publishing History | FR-PUB-01–03 |
| `/assets` | Assets | FR-AST-01–03 |
| `/platform-connections` | Platform Connections | FR-CHN-03 |
| `/logs` | Logs | FR-MON-03 |
| `/settings` | Settings | FR-SYS-01/02, `FR-WS-01` (Workspace context, read-only display) |

Global Search (FR-NAV-04) is not a route — it is a persistent search input in the top nav, present on every route, per its own "single entry point" requirement.

**If Section 30 is ever revised** (per `PROJECT_DECISIONS.md` Section 34's already-flagged open item) to give Prompt Library or Generated Content their own module, the corresponding tab above is promoted to a top-level route — a route change, not a rearchitecture, because both already live behind their own component boundary (see Section 3).

---

## 3. Component Structure

```
src/
  routes/
    dashboard/
    channels/
    content-profiles/
    templates/
      PromptLibraryTab.tsx
      TemplateLibraryTab.tsx
    jobs/
      JobListView.tsx
      JobDetailView.tsx
      GeneratedContentTab.tsx
    queue/
    publishing-history/
    assets/
    platform-connections/
    logs/
    settings/
  components/
    shared/            # buttons, tables, filter bars, empty states — reused across modules
    forms/              # Content Profile form, Channel form, etc. — one form component per entity, reused for create AND edit
  hooks/
    queries/            # one React Query hook per API resource: useChannels(), useJob(id), useGeneratedContent(filters)
    mutations/           # useCreateChannel(), useRetryJob(), etc.
  lib/
    api-client.ts        # thin fetch wrapper, versioned base URL (/api/v1)
    sse-client.ts        # Notification stream subscription (Section 4 below)
  context/
    NotificationContext.tsx   # unread count + toast queue, fed by sse-client
```

Each `useX()` query hook wraps a single backend endpoint and nothing else — no hook silently fans out to multiple endpoints and merges results client-side; if a view needs data from two resources, the component composes two hooks, keeping each hook's cache key and invalidation behavior predictable (this matters directly for FR-CFG-03's guarantee that editing a Content Profile doesn't retroactively touch an in-flight Job's view — cache keys are scoped per entity ID, not globally invalidated on every write).

---

## 4. Real-Time Updates

Per `03-technical-requirements.md` A-8: **Server-Sent Events for Notifications only.** Everything else (Job status, Queue counts, Publishing History) uses React Query's `refetchInterval` polling (10–15s, per view — Jobs/Queue poll faster than, say, Publishing History, since staleness there matters more to Goal G5's failure-visibility target).

```ts
// lib/sse-client.ts
const source = new EventSource('/api/v1/notifications/stream');
source.onmessage = (e) => {
  const notification = JSON.parse(e.data);
  queryClient.setQueryData(['notifications', 'unread-count'], (n) => n + 1);
  notificationContext.pushToast(notification);
};
```

**Why not WebSockets everywhere:** every other real-time-ish need in this Dashboard is "poll something that changes every few seconds," which React Query already does with one config option per query — building a WebSocket channel per resource type would be strictly more infrastructure for a use case polling already satisfies. SSE is reserved for the one case (Notifications) where the PRD's own acceptance criteria (FR-MON-02) actually demand push-not-poll latency.

---

## 5. Forms & Validation

Every create/edit form (Content Profile, Channel, Prompt, Template, Asset, Platform Connection, System Configuration) uses the **same Zod schema the backend validates against**, shared via a small `@platform/schemas` internal package imported by both `src/` (frontend) and the backend's `middleware/` validators. This is the single place client-side and server-side validation could drift, so it is structurally prevented from drifting — one schema, two consumers, not two schemas kept in sync by hand.

Version-pinning fields (Prompt Version, Template Version — `PROJECT_DECISIONS.md` Sections 12.1/13.1) render as an explicit version-picker component (`<VersionSelect>`) that **never** offers a "latest" option and always shows the version number/date alongside the name — this is a shared component specifically so the "never latest" rule (already frozen) can't be accidentally reintroduced by a form built without reusing it.

---

## 6. Views Requiring Special Handling

- **Job Detail (FR-JOB-01):** renders either the 13-stage pipeline timeline (Content Pipeline Job) or a simpler linear state view (Independent Job Types), branching on `job.jobType` at the component level — this is a display branch, not a business-logic branch, and lives entirely in `JobDetailView.tsx`.
- **Template Preview Matrix (FR-TPL-04):** a fixed 3×2 grid (English/Hindi/Urdu × short/long) rendered via an `<iframe>` or sandboxed render call against the backend's preview endpoint — never executed client-side, since the actual rendering pipeline (Playwright) only runs server-side (`PROJECT_DECISIONS.md` Section 7.1); the frontend only requests and displays the resulting images.
- **Global Search (FR-NAV-04):** a single debounced input hitting one `/api/v1/search?q=` endpoint that fans out server-side across the eight searchable areas — the frontend renders one flat, labeled result list; it does not itself query eight endpoints and merge them client-side (that fan-out belongs in a backend Service, per `06-backend-architecture.md`, not in a frontend hook).
- **Dashboard Overview widgets (FR-NAV-03):** each widget is its own small component with its own React Query hook and its own empty-state — deliberately not one big "overview" query aggregating everything server-side, so a slow widget (e.g., Queue Summary under load) never blocks the rest of the overview from rendering.

---

## 7. Accessibility & Multi-Script Display

Because the platform generates and previews Hindi (Devanagari) and Urdu (Nastaliq, RTL) content (`PROJECT_DECISIONS.md` Section 8), any Dashboard surface displaying generated text (Generated Content preview, Job detail, Template preview) sets `dir="rtl"` and appropriate `lang` attributes per the Content Profile's `language` field — this is a rendering correctness requirement carried over from Goal G2, not a cosmetic nice-to-have, since a mis-set `dir` attribute on Urdu text is a real bug the operator would otherwise have to catch by eye on every review.

---

## 8. Consistency Check

Every route above maps to an existing frozen Dashboard Module (`PROJECT_DECISIONS.md` Section 30); no new top-level module is introduced. Every FR in `02-product-requirements-prd.md` has a corresponding view or component named above except the FRs already rejected in `03-technical-requirements.md` (FR-JOB-04/05, Pause/Resume) — no UI is built for those.

**No contradictions with any prior document were introduced.**

**This document remains a draft pending your approval.**
