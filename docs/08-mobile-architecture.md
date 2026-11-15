# PublishIQ — Mobile Frontend Architecture Analysis

> **Brutally Honest Mode: Activated.**
> Analysis date: 2026-10-02. Based on the repository snapshot `PublishIQ-main` (267 files). No source file was modified.
> Every claim is tagged **[VERIFIED]** (read in code), **[DOC]** (docs only, not confirmed in code), or **[UNVERIFIED]** (must be proven on a device or against live docs before relying on it).

---

# Executive Summary

**Verdict: the mobile app is buildable against the existing backend with zero backend code changes for a P0 launch. But the repository is in worse shape than its docs claim, and three of those problems will hit the mobile launch directly.**

What works in your favor:

- The API is clean and consistent: one success envelope `{success, data, meta}`, one error envelope `{success:false, error:{code,message,details}}` **[VERIFIED]**.
- Auth is a plain cookie session. React Native's native networking stack carries cookies, so the same mechanism works without inventing JWT **[VERIFIED code / UNVERIFIED on-device — Phase 0 spike required]**.
- YouTube OAuth uses the server-side authorization-code flow with a signed `state`; the client secret never leaves the backend **[VERIFIED]**. A system browser can run it unchanged.
- Notifications exist as REST + SSE. REST is enough to build everything; SSE is a foreground-only bonus.

What will hurt you:

1. **The web app at HEAD does not build.** `App.tsx` lazy-imports `./routes/logs/LogsView.js`; that file does not exist, and there is no `/logs` backend route either. `tsc -b` fails. The docs promise a Logs module; the code has a nav link to nothing. **[VERIFIED]**
2. **The web Publishing History "republish" action calls an endpoint that does not exist** (`POST /generated-contents/:id/republish`). The real endpoint is `POST /publishing-history/republish` with `{generatedContentId, channelId}`. The web feature is broken in production. Mobile must NOT copy the web call. **[VERIFIED]**
3. **Three web views bypass the API client** and call raw `axios` with a hard-coded `/api/v1` (Queue, Notifications, NotificationDropdown, plus `NotificationContext`). They only work because of the same-origin dev proxy / Caddy. Copying them to mobile would produce relative URLs that fail on a phone. **[VERIFIED]**
4. **Production deployment cannot satisfy the stores as shipped.** `Caddyfile` is `:80 { ... }` — no hostname, therefore no automatic HTTPS, while the README claims Caddy "automatically terminates SSL". The backend sets `Secure` cookies when `NODE_ENV=production`. iOS App Transport Security and Android's default cleartext block both reject plain HTTP. Either there is an undocumented TLS terminator in front, or production login is broken today. **[VERIFIED config, UNVERIFIED actual deployment]**
5. **The rate limiter will misbehave behind Caddy.** `app.set('trust proxy', …)` is never called. Behind Caddy every client appears to come from the proxy IP, so the "20 logins / 15 min" and "1000 requests / 15 min" limits are shared by **all users globally**. The Queue page alone polls at 3 s + 5 s (≈ 480 req/15 min). Add a phone polling Dashboard + Jobs and you will 429 yourself. **[VERIFIED]**
6. **There is no mobile push path.** The backend has no device-token table, no push provider, nothing. Native push is a backend project, not a mobile task. **[VERIFIED]**
7. **The web "Settings" page is fake.** It uses `setTimeout` and local state; nothing is saved. Do not port it as a working feature. **[VERIFIED]**
8. **Zero frontend tests exist.** `find frontend/src -name "*.test.*"` returns nothing. The mobile app inherits no test infrastructure and no behavioral spec other than the code. **[VERIFIED]**

Recommended stack: **Expo SDK 57 (React Native 0.86.x, React 19.2, New Architecture only) + Expo Router + TypeScript + TanStack Query v5 + React Hook Form + Zod 4 + Axios**, in a new top-level `mobile/` directory, no monorepo, no shared package in v1.

---

# Current Codebase Analysis

## Repository layout [VERIFIED]

```
backend/    Express, Prisma/Postgres, BullMQ/Valkey, Playwright+FFmpeg render, Cloudinary
frontend/   React 19.2, Vite 8, Tailwind v4, TanStack Query 5, RHF 7, Zod 4, Axios 1.18, react-router 7
docs/       11 markdown files (PROJECT_DECISIONS.md highest priority)
docker-compose.yml / docker-compose.prod.yml / Caddyfile
```

## Docs vs. code — discrepancies that matter

| Docs say | Code says | Impact on mobile |
|---|---|---|
| `docs/07` §5: forms share Zod schemas via an `@platform/schemas` package | No such package exists. Backend schemas live in `backend/src/schemas` and inline in routers; frontend defines its own | No shared-schema shortcut. Mobile must define its own Zod schemas and keep them in sync manually. |
| `docs/07` §2: Prompts live as a tab inside `/templates`; Jobs hold Generated Content as a tab | Real app has a separate `/prompts` route; Generated Content is a tab inside `JobsView` | Follow the **code**. |
| `docs/07` §2: `/logs` module | `LogsView` file missing; no backend endpoint | Mobile: **do not build Logs**. Report as a web defect. |
| `docs/07` §4: SSE for notifications only, polling elsewhere | Matches. Polling: Dashboard 10 s, Queue 3 s/5 s, Jobs conditional | Mobile must slow/pause polling (see Performance). |
| `docs/07` §2: Global Search is a persistent top-nav input | Matches, but results only navigate to the list route — no deep link to the item | Mobile can do better (deep link to detail), but see Search. |
| README: "Caddy automatically terminating SSL" | `Caddyfile` is `:80` only | Store-blocking deployment gap. |
| README SEC-006: "Session cookies signed … tamper-proof" | `requireAuth` accepts `req.signedCookies?.session \|\| req.cookies?.session`. An **unsigned** cookie holding a valid session UUID is accepted | Signature adds no protection. See Security. |
| `AGENTS.md`: shadcn/ui is part of the frontend stack | No shadcn components exist; UI uses hand-written Tailwind with hex literals | The "design system" is hex literals, not tokens. |

## Backend security/robustness findings (relevant to a public mobile client)

These are not mobile tasks, but they are risks the mobile launch inherits. Ranked by how soon they bite:

1. **Rate-limit keyed on proxy IP** (no `trust proxy`) — shared global bucket. **[VERIFIED]**
2. **Session signature bypass**: unsigned `session=<uuid>` cookie accepted; and `sessionRepository.getById` matches `OR tokenHash OR id`, so the stored raw `id` is itself the credential and the hash is decorative. A DB read leak = account takeover. **[VERIFIED]**
3. **Cross-workspace leakage**: `GET /scheduler/upcoming` calls `schedulerService.listUpcomingRuns()` with **no workspaceId**; dashboard BullMQ queue counts and worker health are global. Harmless with one workspace; wrong the moment a second exists. **[VERIFIED]**
4. **Session lifetime is 24 h fixed with 1 h sliding renewal**, no refresh token. A phone user who skips a day must retype a ≥12-character password. **[VERIFIED]**
5. `ENCRYPTION_SALT` has a static default (`publishiq_secure_static_salt_v1`) — production guard exists and rejects it, good. **[VERIFIED]**
6. Notification list accepts `severity` but ignores it server-side; the web filters severity **client-side on one page**, so pagination + severity filter returns wrong totals. **[VERIFIED]**
7. Asset upload uses `multer.memoryStorage()` with a 100 MB limit — 100 MB buffered in API RAM per request. **[VERIFIED]**

---

# Existing Web Architecture

- **Routing** (`App.tsx`): `BrowserRouter`; public `/login`; protected layout `DashboardLayout` with 15 routes; lazy-loaded views.
- **State**: TanStack Query for server state (`refetchOnWindowFocus:false`, `retry:1`); two React contexts (`AuthContext`, `NotificationContext`); local `useState` everywhere. No Redux/Zustand. **[VERIFIED]**
- **Auth**: `AuthContext` calls `GET /auth/session` once at mount, `POST /auth/login`, `POST /auth/logout`. **There is no 401 handling after startup.** If the session dies mid-use, requests just fail with toasts; the user is never sent to `/login`. **[VERIFIED]**
- **API client** (`lib/api-client.ts`): Axios, `baseURL = VITE_API_BASE_URL || '/api/v1'`, `withCredentials:true`, **no timeout set**, one response interceptor that normalizes errors to `{message, code, status, details}`. **[VERIFIED]**
- **Realtime** (`lib/sse-client.ts`): `EventSource(url,{withCredentials:true})`, events `notification` and `unread_count_update`, plus generic `onmessage` (ignores `status:'connected'`), exponential backoff (1 s base, 30 s cap, 5 retries then gives up permanently with a toast). Debounced invalidation (500 ms) of `['notifications']`, `['dashboard-stats']`, `['jobs']`. Module-level mutable singletons (`activeEventSource`, timers, `retryCount`). **[VERIFIED]**
  - Backend note: the server emits `event: connect` (named), but the client only checks the generic `onmessage` for `status:'connected'`. Harmless; the `connect` event is simply unhandled.
  - There is **no `id:` field** on events → no `Last-Event-ID` replay. Missed events are never replayed. **[VERIFIED]**
- **Toasts**: Sonner (`bottom-right`, dark, richColors, closeButton) plus a parallel `toasts[]` array in `NotificationContext` that nothing renders (dead state). **[VERIFIED]**
- **Skeletons**: `Skeleton.tsx` has `SkeletonStatCard`, `SkeletonCard`, `SkeletonContentCard`, `SkeletonTable`, `SkeletonList`, `PageContentSkeleton`, and a `FullAppSkeleton` (sidebar + header + body) used for **both** route-suspense and auth loading. **[VERIFIED]**

## Design language actually in use [VERIFIED]

`index.css` defines shadcn-style HSL variables (`--primary: 263.4 70% 50.4%`, etc.) — **none of the components use them.** Every component uses hard-coded hex values and Tailwind palette classes. The *real* design language:

| Role | Value used in code |
|---|---|
| App background | `#0c0c0e` (layout), `#0a0a0c` (main/login), body `rgb(10,10,12)` |
| Surface (cards, sidebar) | `#0e0e12` |
| Elevated surface / inputs | `#161620`, `#161622`, `#151522` |
| Hover surface | `#1d1d2e`, `#1c1c2e` |
| Border | `#1a1a24` (default), `#222235` (secondary buttons, empty state) |
| Text primary | `#e0e0e6` / white |
| Text muted | `#9c9cb0` |
| Text subtle / labels | `#6e6e80` |
| Primary | Tailwind `purple-600` bg, `purple-500` focus/border, `purple-400` text/icons |
| Danger | Tailwind `rose-600`; error panels `rose-500/30` border on `rose-950/20` |
| Success / live dot | `emerald-500` |
| Destructive text | `#e15c5c` |
| Radius | buttons `rounded-xl` (12px), cards `rounded-xl/2xl`, inputs `rounded-lg` (8px), pills `rounded-full`/`rounded-md` |
| Shadows | primary button `shadow-lg shadow-purple-600/20`; cards `shadow-lg`; glass `0 8px 32px rgba(0,0,0,.4)` |
| Type | `font-family: 'Inter', system-ui, sans-serif` declared, **but Inter is never loaded** (no `@font-face`/link in `index.html`/`index.css`) → web renders in system-ui. Labels: `text-xs uppercase font-semibold tracking-wider`. Titles `text-2xl font-bold tracking-tight`. |
| Motion | `transition-all duration-200`, `active:scale-[0.98]`, `animate-pulse` skeletons |
| Theme | **Dark only.** No light theme exists. |

Exact Tailwind v4 palette values (`purple-600`, `rose-600`, `emerald-500`) are OKLCH in v4; Antigravity must resolve them from `frontend/node_modules/tailwindcss/theme.css` after `npm ci`, not guess hex.

Component semantics to preserve on mobile: `Button` variants `primary|secondary|danger|outline|ghost`, sizes `sm|md|lg`, `isLoading` + `loadingText`; `EmptyState` (icon tile + title + description + optional primary action, dashed border); `ErrorState` (rose panel, "Try Again" danger button + "Refresh Data" secondary button); `RefreshButton` (spinner turns purple while refreshing).

## Web view inventory (verified from source)

| Route | Lines | Notes |
|---|---|---|
| `/login` | 105 | RHF + Zod (email, password ≥12 — backend only requires ≥4). Fields: "Operator Email", "Password". |
| `/` Dashboard | 407 | `GET /dashboard/stats` polled 10 s; retry via `POST /jobs/:id/retry` |
| `/channels` | 745 | CRUD + duplicate; needs `/content-profiles`, `/platform-connections` |
| `/content-profiles` | **2150** | Largest view. CRUD, readiness check, **dry-run job + polling**, prompt-version picker, background-asset picker |
| `/prompts` | 724 | List, create, add version, rollback, output-contract, (history) |
| `/templates` | 1228 | List, create, versions, rollback, live preview, stress test, version compare |
| `/jobs` | 1056 | Two tabs: Jobs and Generated Content. Create job, retry, cancel, regenerate, duplicate, delete content, preview |
| `/queue` | 549 | Raw axios. Stats (3 s), jobs (5 s), upcoming scheduler; approve/reject/retry/cancel |
| `/notifications` | 497 | Raw axios. History, filters, mark read/all, delete |
| `/publishing-history` | 619 | Filters + retry + **broken republish** |
| `/assets` | 1081 | Upload (multipart), edit, delete, type filter, music trim fields |
| `/content-types` | 334 | CRUD |
| `/workspaces` | 309 | CRUD (read-write against `/workspaces`) |
| `/platform-connections` | 370 | List, rename/disable, delete, OAuth start (`window.location.href = url`) |
| `/settings` | 123 | **Fake** (setTimeout) |
| `/logs` | — | **Missing** |
| `*` | — | NotFound |

---

# Backend API Inventory

All paths are under `/api/v1`. All routes except `/health`, `/auth/login`, `/auth/logout`, `/oauth/:platform/callback` require a session cookie. `workspaceId` is **never sent by the client**; it is derived from the session user (`req.workspaceId`). A user with no workspace gets `403 FORBIDDEN`. **[VERIFIED]**

Envelope: success `{success:true, data, meta}`; failure `{success:false, error:{code, message, details}}`. Error codes: `VALIDATION_ERROR 400`, `UNAUTHORIZED 401`, `FORBIDDEN 403`, `NOT_FOUND 404`, `CONFLICT 409`, `CONTENT_OVERFLOW_ERROR 422`, `EXTERNAL_PROVIDER_ERROR 502`, `TOO_MANY_REQUESTS 429` (note: the rate-limit body has **no** `details`), `INTERNAL_SERVER_ERROR 500`.

Pagination exists **only** on: `/jobs` (`page,limit≤100,default 10`), `/generated-contents` (same), `/notifications` (`limit` default 20, adds `meta.unreadCount`), `/publishing-history` (`limit` default 20, no max enforced), `/domain-events`. All other list endpoints return everything unpaginated.

| Method | Path | Auth/role | Body / query | Notes for mobile |
|---|---|---|---|---|
| POST | `/auth/login` | public, 20/15min/IP | `{email, password≥4}` | Sets signed `session` cookie; returns operator `{id,email,role,workspaceId}` |
| POST | `/auth/logout` | public | — | Deletes session, clears cookie |
| GET | `/auth/session` | auth | — | Session restore. Re-sets cookie (sliding) |
| GET | `/health` | public | — | Liveness; use for "server unavailable" probe |
| GET | `/health/diagnostics` | auth | — | Detailed; optional |
| GET | `/users/me`, PUT `/users/me` | auth | profile update | Profile |
| GET/POST/PUT/DELETE | `/users`, `/users/:id` | Owner/Admin (DELETE: Owner) | user schema | **P3 on mobile** |
| GET | `/notifications/stream` | auth | — | SSE. Events: `connect`, `notification{message,unreadCount,…}`, `unread_count_update{unreadCount}`; `: ping` every 30 s |
| GET | `/notifications/unread-count` | auth | — | `data.unreadCount` |
| GET | `/notifications` | auth | `page,limit,status(unread/read/all),type,search,startDate,endDate` (`severity` accepted, ignored) | `meta:{total,page,limit,unreadCount}`; each item includes `domainEvent` (source of `type`) |
| GET | `/notifications/:id` | auth | — | Includes `domainEvent` |
| POST | `/notifications/:id/read` · `/notifications/read-all` | auth | — | Broadcast `unread_count_update` over SSE |
| DELETE | `/notifications/:id` | auth | — | |
| GET | `/domain-events`, `/domain-events/:id` | auth | paged | Optional (job timeline source) |
| GET/POST/PUT/DELETE | `/workspaces`, `/workspaces/:id` | auth | `workspaceSchema` | Any authenticated user can mutate (no role guard) **[VERIFIED]** |
| GET/POST/PUT/DELETE | `/content-types`, `/content-types/:id` | auth | `contentTypeSchema` | |
| GET/POST/PUT | `/prompts`, `/prompts/:id` | auth | `promptCreateSchema/UpdateSchema` | |
| GET | `/prompts/output-contract` | auth | — | Read-only contract |
| GET/POST | `/prompts/:id/versions`, `/prompts/:id/versions/:versionNumber` | auth | `promptVersionSchema` | Versioned, immutable |
| POST | `/prompts/:id/versions/:versionNumber/rollback`, `/…/test` | auth | `promptTestSchema` for test | Test calls the AI provider (cost) |
| GET/POST/PUT | `/templates`, `/templates/:id`, `/templates/:id/versions…` | auth | `templateCreate/Update/VersionSchema` | |
| GET | `/templates/:id/versions/:n/preview` | auth | — | `data:{previewImageUrl}` (server-rendered, Playwright) |
| POST | `/templates/preview` | auth | `{definition, content, language, branding, watermark, …}` | `data:{html}` — an HTML string. Needs a WebView on mobile |
| POST | `/templates/stress-test` | auth | schema | Server-side scenarios |
| GET/POST/PUT/DELETE | `/assets`, `/assets/:id` | auth | **multipart** `file` + fields; `type, name, status, startTime, endTime, metadata(JSON string or object), licenseStatus` | 100 MB cap. `GET ?type=` filter. Music trim = `startTime/endTime` params only; **FFmpeg runs server-side** |
| GET/POST/PUT/DELETE | `/content-profiles`, `/:id` | auth | `ContentProfileCreateSchema` (full form below) | |
| GET | `/content-profiles/:id/readiness` | auth | — | |
| POST | `/content-profiles/:id/dry-run` | auth | body schema | Creates a dry-run job |
| GET/POST/PUT/DELETE | `/channels`, `/channels/:id` | auth | name, contentProfileId, automationMode, status, scheduleCron (5-field regex), publishingConfiguration, platformConnectionIds[] | |
| POST | `/channels/:id/duplicate` | auth | — | |
| GET | `/platform-connections`, `/:id` | auth | — | Tokens masked as `********` |
| POST/PUT/DELETE | `/platform-connections`, `/:id` | Owner/Admin | PUT only `{displayName?, status?}` | Tokens only via OAuth |
| GET | `/oauth/:platform/authorize` | Owner/Admin | `platform` ∈ youtube/facebook/instagram | Returns `{url}` |
| GET | `/oauth/:platform/callback` | public | `code, state` | Verifies HMAC state (10-min TTL, single-use via Valkey `SET NX`), then **302 → `${CORS_ORIGIN}/platform-connections?connected=…&count=…`** |
| GET/POST | `/jobs`, `/jobs/:id` | auth | list: `jobType, pipelineStage, channelId, page, limit`; create: `{channelId?, contentProfileId?, sourceGeneratedContentId?, dryRun}` (one of channelId/contentProfileId required) | |
| POST | `/jobs/:id/retry` · `/cancel` · `/approve` · `/reject` | auth | reject body `{reason}` | |
| GET/DELETE | `/generated-contents`, `/:id` | auth | `contentProfileId, publishStatus, language, contentTypeId, search, page, limit` | |
| POST | `/generated-contents/:id/duplicate` · `/regenerate` | auth | `{channelId}` | |
| GET | `/queue/stats` | auth | — | `{total,waiting,active,delayed,failed,archived,byType{…}}` |
| GET | `/scheduler/upcoming` | auth | — | **Not workspace-scoped** |
| GET | `/publishing-history`, `/:id` | auth | `platform, channelId, status, contentTypeSnapshot, search, page, limit` | |
| POST | `/publishing-history/republish` | auth | `{generatedContentId, channelId}` | **The real republish endpoint** |
| POST | `/publishing-history/:id/retry` | auth | — | |
| GET | `/dashboard/stats` | auth | — | `{counters, queues, connections[], failedJobs[], recentPublications[], health{database,valkey,worker}}` |
| GET | `/search` | auth | `q` (client enforces ≥2 chars) | `{channels, generatedContents, jobs, publishingRecords, assets, templates, prompts, contentProfiles}` |

**There is no endpoint for:** logs, system configuration/settings persistence, device/push-token registration, account self-deletion, password change, token refresh.

## ContentProfile payload (must be preserved field-for-field) [VERIFIED]

`name(1–100)`, `notes(≤500, nullable)`, `status(Active|Disabled)`, `contentTypeId`, `promptVersionId`, `templateVersionId` (explicit **version** IDs — never "latest"), `language(English|Hindi|Urdu|HindiRoman|UrduRoman)`, `tone`, `writingStyle`, and strict sub-objects: `promptVariables` (record of string/number/boolean), `brandingRules{text≤100, position∈{top-left,top-right,bottom-left,bottom-right,center}, color≤32, opacity 0–1}`, `watermarkRules{text, position, opacity}`, `captionStrategy{template≤500, prefix≤200, suffix≤200}`, `hashtagStrategy{tags≤30×≤50, mode∈{append,prepend,replace,none}}`, `musicSelectionRules{mood, genre, tempo, minDurationSeconds, maxDurationSeconds 0–3600}`, `backgroundSelectionRules{selectionMode∈{Manual,AI}, manualAssetId (required when Manual), mood, style, theme, tags≤20, orientation∈{portrait,landscape,square}}`, `renderingConfiguration{animation.preset∈{None,SlowZoomIn,SlowZoomOut,PanLeft,PanRight,PanUp,PanDown}}`, `validationRules{bannedWords≤100, minLength, maxLength, strictProfanity}`. All sub-objects are `.strict()` — **unknown keys are rejected with 400**, so mobile must not send extra keys.

## Enums (mobile must mirror exactly) [VERIFIED]

`Role{Owner,Administrator,User}` · `Language{English,Hindi,Urdu,HindiRoman,UrduRoman}` · `AutomationMode{Manual,Automatic,Hybrid}` · `ChannelStatus{Active,Disabled}` · `Platform{YouTube,Instagram,Facebook}` · `HealthStatus{Healthy,Unhealthy,Expired,Unknown}` · `ConnectionStatus{Active,Disabled}` · `JobType{ContentPipeline,Cleanup,Archive,RetryPublish,TokenRefresh,HealthCheck}` · `PipelineStage{Draft,Queued,Running,GeneratingContent,Validating,ResolvingBackground,RenderingImage,AttachingMusic,RenderingVideo,GeneratingCaption,GeneratingHashtags,Publishing,Completed,Failed,Archived}` · `PublishStatus{Unpublished,Published,PublishFailed}` · `PublishRecordStatus{Success,Failure}` · `AssetType{Background,Font,Music,Logo,Watermark,Icon}` · `AssetStatus{Active,Disabled}` · `LicenseStatus{Confirmed,Unconfirmed}` · `PromptStatus{Draft,Active,Deprecated}` · `ContentTypeStatus{Active,Disabled}` · `ContentProfileStatus{Active,Disabled}` · `TemplateCategory{CodeAnalogy,MinimalQuote,SplitStatement,Terminal,CodeBlock}`.

Note `Job` has `isDryRun`, `failureStage`, `failureReason`, `retryCount`, `failedAt`, `generatedText`, `imageUrl`, `videoUrl` (Cloudinary URLs), `caption`, `hashtags`. `GeneratedContent` has `mediaDeletedAt` — media is deleted after `MEDIA_RETENTION_DAYS` (default 14); the mobile UI must handle a record whose media is gone.

---

# Mobile Feature Inventory

Priority: **P0** required at launch · **P1** important, ship within first update · **P2** desktop-oriented / lower priority · **P3** not appropriate for mobile.

| # | Feature | Pri | Why |
|---|---|---|---|
| 1 | Login, session restore, logout, expired-session handling | P0 | Nothing works without it. |
| 2 | Dashboard (KPIs, queue counts, connection health, failed jobs, recent publications, system health) | P0 | The "is my pipeline healthy?" glance is the #1 reason to open a phone app. |
| 3 | Jobs list + job detail (stage, failure stage/reason, retry count, media preview) | P0 | Core monitoring. |
| 4 | Job actions: retry, cancel | P0 | Recovering a failed pipeline from your phone is the whole point. |
| 5 | Queue: stats, upcoming schedule, **approve/reject** (Hybrid mode) | P0 | Approvals are time-sensitive and phone-shaped. |
| 6 | Publishing History list + detail + retry + republish | P0 | Outcome visibility (Goal G5). Use the **correct** republish endpoint. |
| 7 | Notifications: unread badge, history, filters, mark read/all, delete | P0 | Existing behavior; also the only "alert" surface without push. |
| 8 | Platform Connections: list, health, rename, disable, delete, **connect YouTube** | P0 | YouTube works today; broken connections stop publishing. Role-gated (Owner/Admin). |
| 9 | Channels: list, create/edit, duplicate, delete, schedule (cron), automation mode, link connections | P0 | Operating the system. |
| 10 | Create job (run now) per channel/profile, optional dry run | P0 | Basic action. |
| 11 | Generated Content: list, preview, delete, duplicate, regenerate | P0 | Review loop. RTL/Devanagari/Nastaliq rendering required. |
| 12 | Content Profiles: list + **full edit form** + readiness + dry-run | P1 | Mandated by the spec: "do not remove fields". It is big (see forms), so schedule it right after the P0 monitoring set, but it is **in scope for v1.0 if the team has the capacity** — not deferred indefinitely. Read-only profile view is P0 (needed to understand a channel). |
| 13 | Prompts: list, view versions, create version, rollback, output contract | P1 | Structured; never one textarea. Test-run is P2 (AI cost, long output). |
| 14 | Templates: list, versions, rollback, **preview image**, version compare | P1 | Template *definition* editing is JSON-heavy. |
| 15 | Template live preview (`POST /templates/preview` → HTML) and stress test | P2 | Needs WebView + a definition editor. Desktop-oriented. |
| 16 | Template definition authoring (block/definition JSON) | P3 | Not a phone task. View-only on mobile. |
| 17 | Assets: browse, filter, upload via picker, rename/status/license, music trim values, delete | P1 | Upload from phone gallery/files is genuinely useful. Server does the processing. |
| 18 | Content Types: CRUD | P1 | Small form. |
| 19 | Workspaces: list/CRUD | P2 | Single workspace in practice; no role guard on backend. Read-only display in Settings is enough; full CRUD P2. |
| 20 | Global Search | P1 | Existing feature; mobile search screen with deep links. |
| 21 | Settings (profile/session, API environment info, sign out, app version) | P0 | Needs sign-out and legal links for the stores. **Do not** port the fake system-settings form. |
| 22 | Users admin (`/users`) | P3 | No web UI exists; no mobile need. |
| 23 | Logs | **N/A** | Does not exist in web or backend. |
| 24 | Domain events / pipeline timeline | P2 | Backend supports it; web does not use it. Optional enrichment for job detail. |
| 25 | Facebook / Instagram connection | **Deferred** | Postponed by product decision. Architecture must allow adding later. |
| 26 | Native push notifications | **Deferred (backend work)** | See Push Notification Analysis. |
| 27 | Account deletion UI | **Not required** if no self-signup; verify (see store sections) | |

---

# Web/Mobile Parity Matrix

| Feature | Web | Mobile | Same backend | Same behavior | Mobile adaptation |
|---|---|---|---|---|---|
| Login | ✅ | P0 | ✅ | ✅ | Autofill-friendly fields (`textContentType`, `autoComplete`), keyboard-aware, same Zod rules (email, ≥12 chars) |
| Session restore | ✅ (`/auth/session` at mount) | P0 | ✅ | ✅ + **improved**: global 401 handler | Splash held until restore resolves; skeleton, not spinner |
| Session expiry mid-use | ❌ none | P0 | ✅ | **Intentional delta** | 401 → clear cache → login with "Session expired" toast |
| Dashboard | ✅ 10 s poll | P0 | ✅ | ✅ | Vertical sections, horizontal KPI scroller; poll only while focused+foreground |
| Jobs list/detail | ✅ | P0 | ✅ | ✅ | List → full-screen detail; filters in bottom sheet |
| Job retry/cancel | ✅ | P0 | ✅ | ✅ | Swipe actions + detail buttons with confirm |
| Generated content | ✅ tab | P0 | ✅ | ✅ | Segmented control inside Jobs; RTL aware |
| Queue + approve/reject | ✅ raw axios | P0 | ✅ | ✅ | Use central client. Reject sends `{reason}` |
| Publishing history | ✅ | P0 | ✅ | ✅ (republish **fixed**) | Card list, filter sheet |
| Republish | ✅ **broken (404)** | P0 | ✅ `/publishing-history/republish` | **Intentional delta (bug fix)** | Channel picker sheet |
| Notifications | ✅ | P0 | ✅ | ✅ | Tab badge; swipe to read/delete |
| SSE realtime | ✅ | P0 (foreground) | ✅ | ✅ | `react-native-sse` or `expo/fetch` stream, **gated by AppState**; REST fallback |
| Platform connections | ✅ | P0 | ✅ | ✅ | Role-gated actions |
| YouTube OAuth | ✅ same-tab redirect | P0 | ✅ | ✅ | System browser session + refetch on return (see OAuth) |
| Channels | ✅ | P0 | ✅ | ✅ | Sectioned form, cron presets + raw cron |
| Content profiles | ✅ | P1 (read P0) | ✅ | ✅ | Accordion/section form; all fields preserved |
| Prompts | ✅ | P1 | ✅ | ✅ | Versions list + version editor screen with structured fields |
| Templates | ✅ | P1/P2 | ✅ | ✅ | Preview image; no definition editor |
| Assets | ✅ | P1 | ✅ | ✅ | Pickers → multipart upload |
| Content types | ✅ | P1 | ✅ | ✅ | Simple form |
| Workspaces | ✅ | P2 | ✅ | ✅ | Read-only in Settings first |
| Search | ✅ | P1 | ✅ | ✅ (+ deep links) | Dedicated screen, debounced 300 ms, ≥2 chars |
| Settings | ❌ fake | P0 (account only) | n/a | n/a | Account/session/legal/version |
| Logs | ❌ missing | — | ❌ no endpoint | — | Not built |
| Push | ❌ | Deferred | ❌ no backend | — | — |

Behavior differences deliberately introduced: global 401 handling, correct republish endpoint, timeouts, foreground-only polling. Each is a bug-fix or a mobile necessity, not a product change.

---

# Recommended React Native Stack

Versions verified against live Expo sources on 2026-10-02:

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Expo SDK 57** | Released 2026-06-30; RN **0.86.x**, React **19.2**. Pin `expo >= 57.0.17` (fixes the Hermes v1 memory regression fixed in 57.0.9 and dev-startup regression fixed in 57.0.17). |
| **Not** SDK 58 | — | SDK 58 beta opened 2026-09-15 on RN 0.88 RC; stable was still pending at the time of this analysis (sources conflict; one hobby repo claims stable, two production repos still list it as beta). **Do not ship a store app on a beta SDK.** Re-check `https://expo.dev/changelog` at implementation time; if 58 is stable *and* `npx create-expo-app@latest` scaffolds it, you may use it — but the prompt below pins 57 as the approved default. |
| Architecture | New Architecture only | Legacy architecture was removed in SDK 55. |
| Language | TypeScript (use the version the template pins; SDK 57 templates use TS 6.0) | Web is `~6.0.2`; keep majors aligned. |
| Navigation | **Expo Router** (bundled with SDK 57) | See Navigation. |
| Server state | `@tanstack/react-query` v5 (web uses 5.101.x) | Same philosophy. Wire `focusManager` to `AppState` and `onlineManager` to `expo-network`. |
| HTTP | `axios` ^1.18 | Same as web; interceptors port 1:1. Uses XHR → native cookie jar. |
| Forms | `react-hook-form` ^7.81 + `@hookform/resolvers` ^5 + `zod` ^4 | Same versions as web; works in RN with `Controller`. |
| Secure storage | `expo-secure-store` | See Secure Storage. |
| Browser/OAuth | `expo-web-browser`, `expo-linking` | |
| Pickers | `expo-image-picker`, `expo-document-picker` | Audio via document picker (`audio/*`). No camera in v1. |
| Media | `expo-video` (generated videos), `expo-image` (thumbnails) | `expo-av` is deprecated in modern SDKs — do not use. |
| Network status | `expo-network` | |
| Icons | `lucide-react-native` + `react-native-svg` | Same icon language as web (`lucide-react`). **[UNVERIFIED]** exact compatible version — resolve with `npx expo install react-native-svg` and `npm view lucide-react-native peerDependencies`. |
| Lists | `FlashList` (`@shopify/flash-list`) **only** where lists exceed ~100 rows; otherwise `FlatList` | Don't add FlashList by default (AGENTS: no unnecessary deps). |
| Bottom sheets | RN `Modal` + custom sheet **or** Expo Router's native modal/formSheet presentation | Avoid adding a bottom-sheet library unless proven necessary. |
| Fonts | `@expo-google-fonts/inter` + `expo-font` | Web declares Inter but never loads it; mobile should actually load it (small deliberate improvement). Alternative: system font to match web's *actual* rendering. Decision: **load Inter** — it is the declared brand font. |
| Date/time pickers | `@react-native-community/datetimepicker` | Only if channel scheduling UI needs it (cron is the real model). |
| Toasts | custom `ToastProvider` (see Feedback) | No third-party toast lib. |
| Tests | `jest-expo`, `@testing-library/react-native`, `msw` (node), Maestro for E2E | |

**Rejected:** Redux/MobX/Zustand (spec), NativeWind (v4 = Tailwind 3.4; web is Tailwind 4 — mismatch, not "sharing"), Uniwind (Tailwind 4 but young, v1.x; not worth the risk for a store app), `react-native-reanimated` (SDK 56/57 had Hermes-v1 memory regressions with Reanimated/Worklets; this app needs only skeleton pulses — use the built-in `Animated` API), any UI kit (spec: no new UI frameworks).

---

# Expo vs Bare React Native Decision

**Decision: Expo (managed config + Continuous Native Generation), development builds, EAS Build. Not Expo Go. Not bare.**

Why Expo:
- The app needs only first-party Expo modules (secure-store, web-browser, linking, image/document picker, video, network). No custom native code.
- SDK 57 uses `expo prebuild` by default: `ios/` and `android/` are generated, not checked in — less native maintenance.
- EAS Build supplies Xcode 26 images (Apple requires Xcode 26 + iOS 26 SDK for uploads since 2026-04-28) and Android API 36 targeting without you managing toolchains.
- Expo Router + typed routes + deep linking are first-class.

Why not bare: no requirement forces it, and it adds Xcode/Gradle upgrade work on every RN release for zero benefit.

Why not Expo Go: it can't carry your exact scheme/associated-domain configuration and masks native-config bugs. Use `expo-dev-client`.

**What would flip the decision:** a need for a native SDK with no config plugin (none exists here), or persistent background SSE (impossible on iOS regardless of framework).

---

# Project Structure

**Decision: `mobile/` at the repository root. No monorepo tooling. No shared package in v1.**

```
PublishIQ/
  backend/        (unchanged)
  frontend/       (unchanged)
  mobile/         NEW — self-contained Expo app with its own package.json + package-lock.json
  docs/           (add docs/08-mobile-architecture.md ONLY after approval — AGENTS.md: docs are source of truth)
```

Why not `apps/mobile`: it implies an `apps/` workspace convention that doesn't exist. Why not npm workspaces: Metro + workspaces + hoisting is a known source of Android build pain (Expo's own SDK 55 notes call out Android monorepo issues with Hermes v1), and web/backend/frontend each have independent lockfiles and Dockerfiles that assume that isolation.

`mobile/` internal layout (Expo Router; `src/app` is the routes root):

```
mobile/
  app.config.ts            env-driven config (name, slug, scheme, bundle IDs, extra.apiBaseUrl)
  eas.json                 development | preview | production profiles
  src/
    app/                   Expo Router routes (see Navigation)
    api/
      client.ts            single axios instance + interceptors
      errors.ts            ApiError normalization
      endpoints/           one file per resource; each function = one HTTP call (mirrors docs/07 "one hook per endpoint")
    hooks/queries/         useJobs, useJob, useChannels …  (one endpoint per hook)
    hooks/mutations/       useRetryJob, useApproveJob …
    features/<domain>/     screens' components, forms, schemas.ts (Zod)
    components/ui/         Button, Skeleton*, EmptyState, ErrorState, Badge, Card, Sheet, Field…
    design/tokens.ts       colors, spacing, radius, typography, shadows, motion
    providers/             AuthProvider, NotificationProvider, ToastProvider, QueryProvider
    lib/                   sse.ts, query-client.ts, app-state.ts, network.ts, format.ts, rtl.ts
    types/                 domain.ts (enums + DTO interfaces, hand-mirrored from backend)
  __tests__/
```

---

# Navigation Architecture

**Decision: Expo Router (file-based). Not hand-rolled React Navigation.** In SDK 56+ Expo Router no longer depends on React Navigation as a public contract; import theme/navigation helpers from `expo-router`/`expo-router/react-navigation` as the installed version documents. Do not install `@react-navigation/*` directly.

Information architecture (14 web sidebar items collapsed into 5 tabs + hub):

```
Root Stack
├─ (auth)/login
├─ (app)/(tabs)                     ← requires session
│   ├─ index            Dashboard
│   ├─ jobs             Jobs | Generated Content (segmented control)
│   ├─ publishing       Publishing History
│   ├─ alerts           Notifications   (tab badge = unreadCount)
│   └─ more             Hub list
├─ (app)/jobs/[id]                   push
├─ (app)/generated/[id]              push
├─ (app)/publishing/[id]             push
├─ (app)/queue                       push   (from Dashboard card, Jobs header, More)
├─ (app)/channels, channels/[id], channels/new
├─ (app)/content-profiles, content-profiles/[id] (+ edit sections), …/new
├─ (app)/prompts, prompts/[id], prompts/[id]/new-version
├─ (app)/templates, templates/[id]
├─ (app)/assets, assets/new, assets/[id]
├─ (app)/content-types, (app)/workspaces
├─ (app)/connections
├─ (app)/search                      modal presentation, opened from a header button on every tab
├─ (app)/notifications/[id]          formSheet/modal
└─ (app)/settings
```

Rationale: Dashboard / Jobs / Publishing / Alerts are the daily monitoring loop. Configuration objects (channels, profiles, prompts, templates, assets, types, workspaces, connections, queue, settings) are low-frequency → **More** hub. Search is a modal (global "single entry point" requirement preserved by a header icon on every tab). Detail views are pushed screens, not modals, so Android back and iOS swipe-back behave natively. Confirm-destructive and filter UIs are modals/sheets.

Auth gating via route groups: `(auth)` vs `(app)` with a redirect in the root layout based on `AuthProvider` state; the splash screen stays visible until session restore resolves.

Deep links: scheme `publishiq://` (+ associated domains later). Routes above are automatically linkable; search results navigate with `router.push('/jobs/<id>')` etc. (better than web, which only navigates to list pages).

---

# Authentication Compatibility Analysis

## How auth works today [VERIFIED]

1. `POST /auth/login` → bcrypt compare → creates `Session` row (24 h) → `Set-Cookie: session=s:<uuid>.<hmac>; HttpOnly; SameSite=Lax; Expires=…; Secure (prod only)`. Response body contains the operator only. **No token in the body.**
2. Every authenticated request: `cookie-parser(SESSION_SECRET)` → `req.signedCookies.session || req.cookies.session` → `validateSession` → renews if <1 h remains → re-issues the cookie.
3. 401 on missing/expired session; the server also clears the cookie on `UnauthorizedError`.
4. No CSRF token. Protection = `SameSite=Lax` + JSON content-type + strict-origin CORS.

## Can React Native use it? **Yes — with one mandatory proof.**

- RN's networking (`NSURLSession` on iOS, OkHttp on Android) maintains a native cookie jar. Axios/XHR requests automatically send and store cookies for the host; `withCredentials: true` is accepted. No JavaScript cookie handling is needed or desirable.
- **`HttpOnly`/`Secure`/`SameSite` are irrelevant to native clients**: `SameSite` is a browser cross-site policy; native apps are not cross-site contexts. `Secure` requires HTTPS — which stores require anyway.
- **CORS is irrelevant**: RN does not enforce CORS and sends no `Origin`; the `cors` middleware simply attaches headers. No backend change.
- **CSRF**: not applicable to native clients; web protections remain untouched.
- App restart: iOS persists cookies with an `Expires` in `NSHTTPCookieStorage`; Android persists via `CookieManager` (flushed asynchronously). Session restoration = `GET /auth/session` at launch.

**[UNVERIFIED] — Phase 0 spike (blocking, ½ day, on a physical Android and iOS device against an HTTPS staging backend):**
1. Login → force-quit immediately → relaunch → `GET /auth/session` returns 200. (Android CookieManager flush timing is the known risk.)
2. Cookie survives 24 h and sliding renewal updates it.
3. `POST /auth/logout` clears it; a subsequent `/auth/session` returns 401.
4. SSE stream (whichever client) sends the cookie.
5. Wi-Fi → cellular switch keeps the session.

If (1) fails on Android: call `CookieManager.flush` through a tiny Expo module, or fall back to reading `Set-Cookie` manually and replaying it — **that is the "smallest compatible solution"** and still needs no backend change. Do not pre-build it; prove the need first.

## Decision

**Keep cookie-session auth. Do not invent JWT. Report no auth blocker.** The backend requires no change for auth.

Known UX limits (not blockers): 24 h sliding expiry forces a password re-entry after a day of inactivity; mitigated only by OS password-manager autofill. Storing the password for biometric re-login is **explicitly rejected** (spec forbids; correct call). A longer session would be a backend constant change — deferred, product decision.

Mandatory client behavior (deltas from web, all required for a native app):
- Axios response interceptor: on `401` from any endpoint **except** `/auth/login` and `/auth/session` → `queryClient.clear()`, close SSE, set auth state signed-out, route to login, toast "Session expired — please sign in again."
- `403` with `Account is not assigned to a workspace` → sign-out screen with message (not a retry loop).
- `429` → toast with retry-after guidance; never auto-retry.
- Timeouts (web has none): 15 s default, 60 s for uploads.

---

# Secure Storage

Honest answer: **in this architecture the app holds no secret.** The session credential lives in the OS-managed cookie jar, never in JavaScript. So:

| Data | Where | Why |
|---|---|---|
| Session cookie | OS cookie jar (automatic) | Not readable/writable by JS; do not copy it anywhere |
| Cached operator `{id,email,role,workspaceId}` | `expo-secure-store` | Minor PII; lets the UI render role-gated nav instantly while `/auth/session` revalidates. Treated as *hint only* — the server is authoritative. |
| Last-used API environment (internal builds only) | `expo-secure-store` | Not shipped in production builds |
| UI preferences (last tab/filters) | Optional; in-memory v1 | Keep minimal |

Never store: password, tokens, provider secrets, OAuth codes. `AsyncStorage` must not be used for anything auth-related. **No persistent TanStack Query cache in v1**: business data (generated text, channels) is workspace-scoped and would need cleanup on logout; the backend is authoritative and offline mutations are explicitly out of scope.

On logout: call `POST /auth/logout`, clear SecureStore keys, `queryClient.clear()`, close SSE. If logout request fails (offline), still clear local state and remove the cached operator; the next launch's `/auth/session` is the truth.

---

# API Client Architecture

Port `lib/api-client.ts` and fix its omissions:

```ts
// mobile/src/api/client.ts — behavior contract
baseURL        = Constants.expoConfig.extra.apiBaseUrl  // full https URL ending in /api/v1
withCredentials = true
timeout        = 15_000 (override per call for multipart: 60_000, SSE excluded)
headers        = { 'Content-Type': 'application/json' }   // do NOT set for FormData; let the runtime add the boundary
response interceptor → throw ApiError { message, code, status, details }   // identical shape to web's customError
  - network failure (no response)   → code 'NETWORK_ERROR',  message 'Cannot reach the server'
  - timeout (ECONNABORTED)           → code 'TIMEOUT'
  - 401 (non-auth endpoints)         → trigger sessionExpired handler, then reject
  - 429                              → code 'TOO_MANY_REQUESTS'
unwrap helper: res.data.success === true ? res.data.data : throw
cancellation   → pass AbortSignal from TanStack Query (`signal`) to every GET
retry          → TanStack Query: retry 1 for GET on NETWORK_ERROR/5xx only; mutations retry 0
logging        → dev only, never log request bodies, never log Set-Cookie
```

Rules: no screen calls `axios` directly (this is exactly the bug the web has in Queue/Notifications); one function per endpoint in `api/endpoints/*`; one hook per endpoint in `hooks/*` (mirrors `docs/07` §3). Paginated hooks expose `meta`. List responses for unpaginated resources are fetched once with `staleTime` ≥ 60 s.

---

# State Management

Exactly as the web: **TanStack Query for server state; React state for UI state; two narrowly-scoped contexts (`AuthProvider`, `NotificationProvider`) plus a `ToastProvider`.** No Redux/MobX/Zustand — nothing here requires client state that outlives a query-cache entry.

Query key conventions (keep identical to web where a key exists so SSE-driven invalidation logic ports unchanged): `['notifications','unread-count']`, `['notifications', …]`, `['dashboard-stats']`, `['jobs', …]`, `['job', id]`, `['channels']`, `['content-profiles']`, `['publishing-history', …]`, `['platform-connections']`, `['assets', type?]`, `['queue-stats']`, `['queue-jobs', …]`, `['scheduled-upcoming']`.

React Native wiring (required):
- `focusManager.setEventListener` ← `AppState` `change` (`active` = focused). `refetchOnWindowFocus` then means "refetch on app resume" — enable it **selectively** (Dashboard, Jobs, Queue, Notifications) via `staleTime`, not globally.
- `onlineManager.setEventListener` ← `expo-network` state. Paused queries resume automatically.
- Screen-scoped polling: `refetchInterval` active only when `useIsFocused()` **and** app foreground (`refetchIntervalInBackground: false` is the default; also pass `enabled` from focus).
- Optimistic updates **only** for: mark-notification-read, mark-all-read, delete notification (all trivially reversible). Everything that touches the pipeline (retry, cancel, approve, reject, create job, publish) is **non-optimistic**: show mutation loading, then invalidate. The backend is authoritative.

---

# Design System Strategy

Honest assessment: **there is no design-token source to share.** The web uses hex literals in class strings; the HSL variables in `index.css` are dead shadcn residue. Sharing a token package would require rewriting the web UI — explicitly out of scope ("web must remain stable").

**Decision:**
1. Create `mobile/src/design/tokens.ts` as a *typed mirror* of the values catalogued in "Design language actually in use". Each token carries a comment pointing at the web source (`Button.tsx`, `DashboardLayout.tsx`, …).
2. Style with `StyleSheet.create` + tokens. No NativeWind/Uniwind.
3. Dark theme only (matches web). `StatusBar style="light"`. Set `userInterfaceStyle: "dark"` in app config.
4. **Shareable in principle** (via a future `packages/design-tokens`, only if the web is later refactored to consume it): color roles, spacing scale (Tailwind 4 px base: 4/8/12/16/24/32), radius (8/12/16/full), type scale, status→color mapping, motion durations (200 ms).
5. **Platform-specific:** shadows (iOS `shadow*` vs Android `elevation`), `backdrop-filter` glass (drop it — use solid `#0e0e12`; optional `expo-blur` only on the tab bar/header), hover/focus-ring states (replaced by pressed opacity/scale `0.98` and platform focus), scrollbars (n/a), touch targets (≥44 pt iOS / 48 dp Android — larger than web's `sm` buttons; `sm` maps to a 44 pt hit area using `hitSlop`).

Status color semantics must match web exactly. Derive the mapping by reading the web views' badge helpers (`JobsView`, `QueueView`, `PublishingHistoryView`) — Antigravity must extract each stage→color from code rather than invent.

Component parity set to build first: `Button` (5 variants, 3 sizes, `isLoading`, `loadingText`, icon), `Skeleton` family (StatCard, Card, ContentCard, List, Table→"rows" on mobile), `EmptyState`, `ErrorState`, `RefreshControl` styling (purple tint) replacing `RefreshButton`, `Badge`, `Card`, `Field` (label uppercase 12 pt tracking-wider `#6e6e80`), `Sheet`, `ConfirmDialog`, `SegmentedControl`, `ToastProvider`.

---

# Shared Code Strategy

| Candidate | Share? | Decision |
|---|---|---|
| Domain enums + DTO types | Could | **Copy into `mobile/src/types`**, don't share. The web has no shared types today (inline `any` in many views — see search results typed `any[]`). A shared package would first require typing the web. |
| Zod schemas | Could | **No** v1. `docs/07` promised `@platform/schemas`; it doesn't exist. Backend schemas are inline in routers, partly using Prisma enums (`z.nativeEnum`) that a phone can't import. Mobile defines its own; contract drift is caught by integration tests (below). |
| Design tokens | See above | Mirror, don't share. |
| API envelope + error codes | Tiny | Duplicate (10 lines). |
| React DOM / Tailwind classes / `lucide-react` | **Never** | |
| Backend code/Prisma | **Never** | |

A shared package is justified only when **two** consumers import the *same* source. Today there would be zero. Creating one now is theoretical reuse, which the spec forbids. Revisit when/if the web adopts a typed API layer.

**Contract-drift guard (cheap, worth doing):** one mobile integration test per P0 endpoint that parses a real response (against a staging backend or recorded fixtures captured from the real API — not invented) with the mobile Zod schema.

---

# Notification Strategy

Preserve web behavior: unread count badge, history list with filters (status, type, search, date range), mark read, mark all read, delete, details view, toast on new notification, debounced invalidation of `['notifications']`, `['dashboard-stats']`, `['jobs']`.

Data model reality [VERIFIED]: a `Notification` row is `{id, message, readAt, createdAt, domainEventId}`; **type and severity are not columns** — `type` comes from the joined `domainEvent.type`; the web derives severity client-side from the event type string (error/warning/info). Mobile must reuse the same derivation (read `NotificationsView.tsx` lines ~150–160 and port the exact predicates) and **must not** rely on a `severity` query param (ignored server-side).

Mobile behavior:
- **Tab badge** = `['notifications','unread-count']` query (via the central client — not raw axios).
- **Foreground**: SSE (if Phase 0 proves it) updates the count in `setQueryData` and debounced-invalidates as web does. In-app toast on `notification` event.
- **Resume from background** (`AppState` → `active`): always refetch unread-count and the notifications list, and invalidate `['dashboard-stats']`, `['jobs']`. **This is the missed-event strategy**: SSE has no replay, so reconciliation is by refetch, never by trust.
- **Dedup**: server count is authoritative; the SSE payload's `unreadCount` overwrites local state rather than incrementing (the web *increments* `old+1` in `NotificationContext` **and** sets the absolute value in `sse-client` — a double-count race; do not port the increment).
- **Server-side filtering only** for `status/type/search/startDate/endDate`. Severity filter: apply client-side on the already-fetched page and label it "filters this page" — or omit severity filter. Do not pretend it paginates.
- Pull-to-refresh on the list. Infinite scroll via `useInfiniteQuery` (page/limit, `meta.total`).

---

# SSE Analysis

**Backend [VERIFIED]:** `GET /notifications/stream`, cookie-authenticated, `Content-Type: text/event-stream`, headers flushed, 30 s `: ping` comments, events `connect`, `notification`, `unread_count_update`; broadcast scoped by `workspaceId`; no `id:`, no `retry:`, no replay. Caddy flushes `text/event-stream` responses without special config. Helmet doesn't interfere.

**Client reality:** React Native has **no built-in `EventSource`**. Options: (a) `react-native-sse` (XHR-based polyfill; supports custom headers; credential/cookie behavior rides on the native XHR stack), (b) a hand-rolled parser over `expo/fetch` streaming (Expo's fetch supports streaming bodies and is used for SSE in the wild — I could not confirm cookie behavior from docs), (c) REST polling.

**Can SSE work reliably on mobile? Foreground: yes (likely). Background: no.**
- iOS suspends the app within seconds of backgrounding; the socket dies. Android Doze/App Standby kills idle sockets and a foreground service is unjustifiable for this.
- Cellular NAT timeouts commonly drop idle TCP; 30 s pings help.
- Therefore SSE is a **foreground latency optimization**, never a delivery guarantee.

**Decision:**
1. `lib/sse.ts` connects **only** when: authenticated ∧ `AppState==='active'` ∧ online. Disconnects on background/logout/offline. Reconnects on resume with the same backoff constants as web (1 s base, ×2, cap 30 s, jitter ≤500 ms).
2. Fix web flaws instead of porting them: no module-level singletons (encapsulate in a class/hook), **no permanent give-up after 5 retries** (web stops forever; mobile keeps retrying while foreground at the 30 s cap, and surfaces a persistent "Live updates paused — pull to refresh" banner instead of repeated toasts).
3. **Fallback**: if the Phase 0 spike shows the SSE client cannot send the cookie on either platform, ship v1 with **foreground polling** of `GET /notifications/unread-count` every 30 s (+ list invalidation when the count changes). This needs no backend change and satisfies "preserve behavior" at coarser latency. Do not change the backend to make SSE work.
4. Gate: the rate limiter (shared global bucket) means a 30 s poll (~30 req/15 min) is cheap, but a 3 s poll is not. Mobile **must not** copy Queue's 3 s interval; use ≥10 s, focus-gated.

---

# Push Notification Analysis

| Capability | Possible with existing backend? |
|---|---|
| In-app notification list, unread count, mark read | ✅ |
| Real-time while app is open | ✅ (SSE or polling) |
| Local notification when app is foreground and an SSE event arrives | ✅ frontend-only — but it's just a toast; **not** push |
| Notification while app is backgrounded/killed | ❌ **needs backend** |
| Server push (APNs/FCM) | ❌ **needs backend** |

**Local notifications are not push.** They only fire if the app process is alive to receive the SSE event. Scheduling a local notification from an event that arrived in the background is impossible because the process isn't running. Do not market or document them as push.

What push requires (backend scope, **not in this task**): (1) a `DeviceToken` table (`userId, platform, token, createdAt, lastSeenAt`), (2) `POST/DELETE /devices` endpoints, (3) a provider adapter (`providers/push/expo-push.provider.ts` using Expo Push Service, or direct FCM+APNs) per AGENTS.md's provider rule, (4) a hook in `notification.service.ts` next to `broadcastToSSE`, (5) invalid-token cleanup, (6) APNs key + Firebase project for store builds, (7) client: `expo-notifications` + permission UX.

**Recommendation: ship v1 without push; defer.** Is it a store blocker? No. Is it a product gap? Yes — a publishing operator wants "your Instagram post failed" while the phone is in a pocket. State it plainly in release notes: *alerts appear when you open the app*. Plan push as v1.1 with a small backend milestone (~2–3 days) and design `NotificationProvider` so a push-tap deep link (`publishiq://notifications/<id>` / `jobs/<id>`) already routes correctly.

---

# OAuth / Deep Linking

**Scheme:** `publishiq://` (set in `app.config.ts`). Associated domains / Android App Links (`https://<domain>/…`) are **not needed for v1** because the OAuth callback is a backend HTTPS URL, not an app link.

**Android 16 note:** targeting API 36 requires correct `edge-to-edge`; Expo SDK 57 handles this by default.

---

# YouTube Mobile Connection

## Current flow [VERIFIED]

1. Web: `GET /oauth/youtube/authorize` (Owner/Admin) → `{url}` → `window.location.href = url`.
2. URL is Google's consent screen with `client_id`, `redirect_uri = ${APP_BASE_URL}/api/v1/oauth/youtube/callback`, scopes `youtube.upload youtube.readonly`, `access_type=offline`, `prompt=consent`, signed `state` (workspaceId, platform, ts; HMAC-SHA256 with `SESSION_SECRET`; 10 min TTL; single-use via Valkey).
3. Google redirects to the backend callback → backend verifies state, exchanges code (client secret server-side), requires a `refresh_token`, fetches channel, upserts the connection (tokens encrypted).
4. Backend **302 → `${CORS_ORIGIN}/platform-connections?connected=youtube&count=1`**.
5. The web page does **not** read `?connected=`; it just loads and lists connections.

## Mobile flow without backend changes (approved for v1)

1. App calls `GET /oauth/youtube/authorize` through the central client (cookie carries the session; the role check happens server-side).
2. Open `result.url` with `WebBrowser.openAuthSessionAsync(url, 'publishiq://oauth/youtube')` — this uses `ASWebAuthenticationSession` (iOS) / Custom Tabs (Android), i.e. the **system browser**, which is required (Google blocks embedded webviews for OAuth). **Never use a plain WebView.**
3. User consents. Google → backend callback → connection saved → backend redirects the *browser* to the **web** `/platform-connections` page. In the in-app browser the user will see the web login page (the browser has no session) or the web UI. **They close the sheet.**
4. `openAuthSessionAsync` resolves with `type: 'cancel' | 'dismiss'` (no custom-scheme redirect happens). Treat **any** return as "maybe done": invalidate `['platform-connections']` and refetch. If a new connection appeared → success toast "YouTube connected"; otherwise → neutral message "Connection not completed" with a retry button.
5. Also refetch on `AppState` → `active` while the OAuth screen is pending (covers Android where Custom Tabs return via app resume).

This works, is secure (no secrets or tokens in the bundle), does not break web OAuth, and requires zero backend change. **Its UX flaw:** the user ends on a web page they didn't need to see, and on iOS they must tap "Cancel/Done" because the session never auto-completes.

## Smallest backend change that fixes the UX (**deferred, not a blocker**)

In `oauth.controller.ts` callback: if the signed `state` payload carries `client: 'mobile'` (add the field in `generateSignedState`, request it via `GET /oauth/:platform/authorize?client=mobile`), redirect to `publishiq://oauth/youtube?connected=youtube&count=N` (or `?error=…`) instead of the web URL. ~10 lines, backwards compatible, covered by the existing `oauth-state.test.ts`. Also redirect failures: today `next(error)` returns a **JSON error page** inside the browser (e.g. "Google OAuth did not return a refresh_token") — a user sees raw JSON. Handle by the same redirect-with-error pattern.

## Edge cases the implementation must handle

- Google returns no `refresh_token` if the user previously consented (backend throws `EXTERNAL_PROVIDER_ERROR` → JSON in browser). Mobile can't see it. Mitigation in UI: after return, if no new connection, show help text: "If you've connected before, remove PublishIQ from your Google Account permissions and try again."
- Role: only Owner/Administrator get `/authorize`; a `403` must render "Only Owners and Administrators can connect accounts", not a generic error. Hide the button for role `User`.
- Google Cloud console: the existing **Web application** OAuth client and redirect URI remain valid. **No new Google client ID is needed**, and no iOS/Android OAuth client is needed, because the flow stays server-side. Production must use the verified HTTPS `APP_BASE_URL`.
- Facebook/Instagram: the **same** `authorize → system browser → backend callback → refetch` pattern applies unchanged. Design `ConnectionProvider` as a platform registry keyed by `Platform`; keep the buttons for Facebook/Instagram **hidden** (product decision: postponed), not "coming soon" stubs.

---

# Assets / Media

Backend [VERIFIED]: `POST /assets` multipart (`file` field, `type`, `name`, `status`, optional `startTime/endTime`, `metadata`, `licenseStatus`), Cloudinary upload server-side, 100 MB limit, `metadata` may be a JSON string. `PUT /assets/:id` accepts an optional replacement file. Backgrounds have a strict metadata schema (`mood, style, theme, tags, orientation, width, height, format, bytes, sizeBytes`; **`.strict()`**).

Mobile:
- `expo-image-picker` for Background/Logo/Watermark/Icon; `expo-document-picker` for Music (`audio/*`) and Font (`font/*`, ttf/otf — verify allowed formats server-side in `asset.service.ts` before enabling).
- Upload as `FormData` with `{ uri, name, type }`. Axios in RN supports this; do **not** set `Content-Type` manually. Show real progress via `onUploadProgress`. Timeout 60 s+; surface "Upload failed — file may be too large (limit 100 MB)".
- **No on-device processing.** Music trimming = send `startTime`/`endTime` numbers; the server's FFmpeg trims (`music-trimming.test.ts` exists). The UI offers numeric/slider inputs in seconds. Audio preview via `expo-audio`/`expo-video` is a P2 nicety.
- Upload continues only while app is foregrounded; backgrounding mid-upload may kill it on iOS. UX: keep screen awake during upload (`expo-keep-awake` is optional — avoid extra dep; show "Keep the app open" hint) and make it re-triable. No resumable uploads (backend has none).
- Large files over cellular: warn when file > 25 MB.
- Camera: not needed. Do not request camera permission (store review risk without need).

---

# Jobs / Pipeline

- Job detail renders either the 14-stage pipeline (ContentPipeline) or a simple linear state (other job types), branching on `jobType` — display-only branch, per `docs/07` §6.
- Stage chip + progress: map `PipelineStage` → ordered steps `Draft → Queued → Running → GeneratingContent → Validating → ResolvingBackground → RenderingImage → AttachingMusic → RenderingVideo → GeneratingCaption → GeneratingHashtags → Publishing → Completed`; `Failed` shows `failureStage` + `failureReason` + `retryCount`; `Archived` terminal.
- `isDryRun` badge ("Dry run") on every dry-run job; dry runs publish nothing.
- Actions: Retry (Failed), Cancel (non-terminal), Approve/Reject (jobs awaiting approval — read `QueueView.tsx` to mirror the exact eligibility predicate; it drives the "review" modal at ~line 500+). All non-optimistic, all with confirm for cancel/reject.
- Polling: Jobs list every 10–15 s **only while any visible job is non-terminal and the screen is focused**; job detail every 5 s while non-terminal; stop on terminal.

---

# Offline / Network Handling

| Scenario | Behavior |
|---|---|
| Airplane mode / no connectivity | `onlineManager` pauses queries; show a thin "Offline" banner; keep last in-memory data visible; **all mutations disabled with a clear reason** ("You're offline") — never queued |
| Weak network / timeout | 15 s timeout → `TIMEOUT` → inline `ErrorState` with "Try Again" on first-load, toast on refetch failure while keeping stale data |
| Wi-Fi ↔ cellular switch | Axios requests fail once with `NETWORK_ERROR`; one automatic GET retry; SSE reconnects via backoff |
| App backgrounded during a mutation | The HTTP request may complete or die; on resume, **always refetch** the affected resource before trusting UI state. Idempotency lives in the backend (publishing idempotency + duplicate-job tests exist); the client doesn't need a request queue |
| App killed during upload | Upload lost; no partial server state is created until the multipart completes. On relaunch nothing to recover; user retries |
| API unavailable (5xx / `/health` fails) | Full-screen `ErrorState` only if there is no cached data; otherwise banner "Server unavailable" |
| What can be cached | Query cache in memory with `gcTime` 5 min; **not persisted** (see Secure Storage) |
| What must fail immediately | Every mutation. No offline business logic |

---

# App Lifecycle

| Event | Auth | Queries | SSE | Notifications | Uploads | OAuth |
|---|---|---|---|---|---|---|
| Cold start | `GET /auth/session` behind splash | Fetch only the first-visible tab | Connect after auth | Fetch unread count | — | If launched via `publishiq://oauth/…` (future), route to Connections |
| Foreground (active) | — | Focus-gated polling | Connected | Live | Allowed | — |
| Background | Nothing | Polling stops (RN timers throttle) | **Disconnect** | None (no push) | May be killed | Pending auth session may complete |
| Resume | If last background > 1 h, revalidate via `/auth/session` | Refetch stale: dashboard, jobs, queue, notifications, connections | Reconnect with fresh backoff | Refetch unread + list | Detect failure → retry button | Refetch connections |
| Killed → restart | Cookie jar restores session (Phase 0 proof) | Fresh | Reconnect | — | Lost | — |

---

# Accessibility

Requirements, with concrete rules: every pressable has `accessibilityRole` + `accessibilityLabel` (icon-only buttons especially — RefreshButton, Search, notification bell); `accessibilityState` for `disabled/busy/selected`; touch target ≥ 44×44 pt (use `hitSlop` for `sm` buttons); support Dynamic Type/font scaling (`allowFontScaling` on, test at 200%; avoid fixed-height rows); contrast: web's `#6e6e80` on `#0e0e12` is ≈ 3.7:1 — **below WCAG AA (4.5:1) for small text**. This is the "do not sacrifice accessibility for visual similarity" case: mobile subtle text must be lightened (≈ `#8a8aa0`+) or used only for ≥18 pt/bold; verify with a contrast check before finalizing tokens. Keyboard: `KeyboardAvoidingView`/`react-native-keyboard-controller` is *not* required — Expo Router + `ScrollView keyboardShouldPersistTaps="handled"` suffices; verify long forms scroll fields into view. Form errors: announce via `accessibilityLiveRegion="polite"` (Android) / `AccessibilityInfo.announceForAccessibility` (iOS) and show inline text, not color alone. Screen-reader order for cards: title → status → meta → actions. RTL/multi-script: any text from `GeneratedContent`, `Job.generatedText`, or previews must set `writingDirection: 'rtl'` + `textAlign: 'right'` for `Urdu`/`UrduRoman`… and correct font for Devanagari/Nastaliq (system fonts generally cover Devanagari; **verify Nastaliq-style Urdu rendering on real iOS and Android devices** — coverage differs by OS version and may need a bundled font) — this is a **Goal G2 correctness requirement** carried from `docs/07` §7. Note: `HindiRoman`/`UrduRoman` are Latin-script romanizations → LTR; do not set RTL for them (the docs say RTL for "Urdu"; derive direction from `Language === 'Urdu'` only, and confirm with the web's implementation, which should be inspected in `JobsView`/preview code).

---

# Performance

- **Lists**: `FlatList` with `keyExtractor`, `getItemLayout` where fixed; paginated endpoints use `useInfiniteQuery` (page size 20). Don't render 2,000-line-style monoliths: split features into screens (the web's 2,150-line `ContentProfilesView` is the anti-pattern).
- **Unpaginated endpoints** (channels, profiles, prompts, templates, assets, types, connections): fetch once, long `staleTime`, client-side filter. If an account has hundreds of assets, thumbnails must use `expo-image` with `recyclingKey` and Cloudinary-transformed small URLs (append transformation segments only if verified against the stored URL format — **[UNVERIFIED]**; otherwise rely on `expo-image` downsampling).
- **Polling budget** (critical because of the shared rate-limit bucket): Dashboard 15 s, Jobs 10–15 s conditional, Queue 10 s, Notifications via SSE (or 30 s poll). All focus-gated and foreground-gated.
- **Dashboard**: the web deliberately keeps widgets separate (docs/07 §6) but the real backend returns everything in **one** `GET /dashboard/stats`. Use that single query (don't fabricate per-widget endpoints) and render sections from it.
- **Video**: `expo-video` with `useVideoPlayer`, create the player only when the detail screen is focused; never autoplay in lists; use `imageUrl` thumbnails in lists.
- **Re-renders**: with React 19.2 and the React Compiler (web enables it), `babel-plugin-react-compiler` can be opted into through Expo's `experiments.reactCompiler` setting (**[UNVERIFIED]** — confirm in current Expo docs); enable it **only if** lint and tests are green with it. Don't memoize by hand.
- Hermes + New Architecture are default; no tuning needed. **Do not** add Reanimated.
- Bundle: no manual code-splitting work; do not add lazy-loading libraries.

---

# Security

| Area | Position |
|---|---|
| Secrets in bundle | `EXPO_PUBLIC_*` and `extra` are **public**. Only the API base URL goes in. No Meta App Secret, Google client secret, Cloudinary secret, Gemini key, `SESSION_SECRET`, `ENCRYPTION_KEY`. These stay in the backend only (confirmed: all provider token exchanges are server-side) |
| Session credential | Native cookie jar; never read in JS; never logged |
| Transport | HTTPS only. iOS ATS default; Android `usesCleartextTraffic=false` in release. Dev builds may allow LAN HTTP via config plugin **only in the development profile** |
| Certificate pinning | Not in v1 (high operational cost, rotation risk); revisit if threat model requires |
| Deep links | `publishiq://` accepts only known route patterns; ignore unknown; never execute actions (retry/approve/delete) from a deep link — deep links only navigate. No auth-bearing parameters in links |
| OAuth | System browser only; `state` is backend-signed + single-use; the app never sees `code` |
| Logs | No request/response bodies in release; strip `console.*` in production (babel `transform-remove-console` is *not* needed — gate by `__DEV__`) |
| Screenshots / clipboard | Content is business-sensitive but not secret → no FLAG_SECURE in v1; **do** exclude the password field from autofill suggestions' logging; do not auto-copy anything |
| Screens in app switcher | Optional privacy overlay on `AppState` inactive — nice-to-have P2 |
| Auth abuse | Server rate-limits login (20/15 min; shared bucket today — fix `trust proxy`, see Risks) |
| Backend findings | Unsigned-cookie acceptance and `id`-as-credential (see Executive Summary): fix backend-side separately; mobile neither depends on nor worsens them |

---

# Testing Strategy

The web has **no tests**, so there's no behavioral baseline to port; the backend has 56 test files (domain logic) that remain untouched. Mobile test plan, critical-flow-first:

| Layer | Tooling | Targets |
|---|---|---|
| Unit | `jest-expo` | `api/errors` normalization, 401 handler, status→color mapping, severity derivation, cron helpers, Zod schemas (profile payload strictness: unknown keys rejected; `manualAssetId` required when Manual; opacity bounds) |
| Component | RN Testing Library | Button states, Skeletons, EmptyState/ErrorState, form field error display, ConfirmDialog |
| Integration (mocked network) | `msw/node` handlers using **fixtures captured from the real API** (never invented) | Login, session restore, 401→login redirect, dashboard load/error/empty, retry job, approve/reject, notification mark read optimistic rollback |
| Navigation | `expo-router/testing-library` | Auth gate redirects; tab badge; deep link `publishiq://jobs/<id>` |
| API contract | Jest against a staging backend (opt-in, `npm run test:contract`) | One request per P0 endpoint parsed with the mobile Zod schema |
| OAuth | Unit test of `connectYouTube` using mocked `expo-web-browser` returning each result type + connection refetch assertions | |
| E2E | **Maestro** on Android emulator + iOS simulator | Login → dashboard → job detail → retry → notifications → logout; YouTube connect on a physical device only (manual checklist) |
| Manual (Phase 0 + release) | Physical devices | Cookie persistence, SSE-with-cookie, RTL rendering, keyboard behavior, upload over cellular |

Priority flows to cover (per spec): login, session restoration, dashboard, content creation (job create), prompt configuration (new version), asset upload, job monitoring, notification, YouTube connection, publishing history, logout.

---

# Play Store Requirements

Verified against Google Play Console Help (target API page) on 2026-10-02:

- **Target API level 36 (Android 16)** for new apps and updates since 2026-08-31. Expo SDK 57 + EAS satisfies this by default — **verify** `targetSdkVersion` in the generated Gradle before submitting.
- App bundle (`.aab`) via EAS Build production profile; Play App Signing.
- Package name: e.g. `com.<yourorg>.publishiq` — **immutable after first release**; decide now.
- Version: `versionCode` auto-incremented (EAS `autoIncrement` / remote version source); `version` semver.
- Adaptive icon (foreground + background, 1024 px source), splash (dark `#0a0a0c`), feature graphic 1024×500, screenshots (phone required; 7/10-inch tablet if declaring tablet support).
- Permissions: request **none** at install. Image/document pickers use the system picker (no storage permission). Declare only `INTERNET` (implicit). Do not add camera/mic/location.
- **Data safety form** and **privacy policy URL** are required. What the app collects: email + password (account), user-generated content, and network diagnostics if you add crash reporting. State honestly. **[Verify the exact current form fields in Play Console.]**
- **App access**: the app requires login → provide reviewers a **demo operator account** in "App access". Create a dedicated demo workspace/user; never the real operator.
- Closed testing requirements for new personal developer accounts (e.g. minimum testers/duration) have changed several times — **[UNVERIFIED]: check current rules for your account type (individual vs organization) before planning the launch date.**
- HTTPS production API (see Environment Configuration).
- Content rating questionnaire; target audience: adults/business tool.
- Account deletion: Play requires an in-app *and* web way to request deletion **if the app lets users create accounts**. Accounts here are created by an Owner, not by self-signup → likely not applicable; **[verify against current Play policy wording]** and prepare a contact-based deletion request path in the privacy policy regardless.

---

# App Store Requirements

Verified: since **2026-04-28**, uploads must be built with **Xcode 26+ / iOS 26 SDK** (EAS provides this; SDK 55+ minimum Xcode is 26).

- Apple Developer Program membership; bundle ID (e.g. `com.<yourorg>.publishiq`, immutable); App Store Connect record.
- Icon 1024×1024 (no alpha), launch screen, screenshots for required iPhone sizes (and iPad if `supportsTablet:true` — see Device Support).
- **Privacy**: live privacy-policy URL; App Privacy "nutrition labels" (account info, user content); `PrivacyInfo.xcprivacy` — Expo/RN generate required-reason API declarations; **verify the generated manifest includes your third-party modules**.
- **Export compliance**: HTTPS/standard encryption only → set `ITSAppUsesNonExemptEncryption=false` in `app.config.ts` ios.infoPlist (standard exempt use; confirm with Apple's current questionnaire).
- **Review**: reviewer must be able to log in → provide demo credentials in App Review notes. Guideline 4.2 (minimum functionality) is satisfied by genuine operational features; Guideline 5.1.1(v) account deletion applies to apps that **support account creation** — here an Owner creates accounts, there is no in-app signup → likely not triggered **[verify against current guideline text]**.
- **Sign in with Apple** is only required when offering third-party social sign-in for the *app login*. The app's "Connect YouTube" is a *publishing connection*, not login → not triggered **[verify]**.
- Use of a third-party login for connecting accounts and in-app browser: `ASWebAuthenticationSession` is the approved pattern.
- **ATS**: HTTPS only in release. No `NSAllowsArbitraryLoads`.
- Uploading user-generated content to YouTube/Meta on a user's behalf: the app is the user's own tool; mention in review notes.
- Associated domains: not needed v1.

---

# Device Support

- **Platforms:** iOS (iPhone) and Android phones, at the minimum OS versions Expo SDK 57 sets by default. Do not override minimums unless a dependency demands it.
- **Orientation:** lock to **portrait** in v1 (`orientation: "portrait"`). Landscape adds layout cases (tables, forms, video) without a clear operator benefit.
- **Tablets:** not a v1 target. Set `ios.supportsTablet: false` (iPad runs the iPhone layout in compatibility mode) and do not declare tablet support on Play. **[UNVERIFIED]** — confirm current App Store policy on iPad compatibility-mode screenshots/review before choosing; if `supportsTablet: true` is required, constrain content to a centered max width (~640 pt) rather than designing a separate layout.
- **Small phones (≈320–360 pt wide):** every screen must work without horizontal scrolling; test at 320 pt and at 200 % font scale.
- **Safe areas:** use `react-native-safe-area-context` insets (bundled with Expo Router) on every screen; bottom tab bar respects the home indicator/gesture bar. Android 16 / API 36 enforces edge-to-edge — content must draw under system bars and pad by insets.
- **Keyboard:** forms scroll the focused field into view; primary submit stays reachable; dismiss on scroll drag.
- **Status bar:** light content on the dark background.

---

# Environment Configuration

`app.config.ts` (TypeScript; reads `process.env` at build time) with EAS profiles:

| Profile | Purpose | `API_BASE_URL` | Notes |
|---|---|---|---|
| `development` | Dev client on simulator/device | `http://<LAN-IP>:4000/api/v1` (Android emulator: `http://10.0.2.2:4000/api/v1`) | Allow cleartext **only here** (config plugin / `usesCleartextTraffic` for dev). Backend in dev sets `Secure=false`, so cookies work over HTTP. iOS device/simulator needs ATS exception for local network (Expo dev client enables it) |
| `preview` | Internal testing (TestFlight/internal track) | `https://staging.<domain>/api/v1` | **Must be HTTPS** — Secure cookies |
| `production` | Stores | `https://<domain>/api/v1` | |

Rules: base URL is read from `Constants.expoConfig.extra.apiBaseUrl` (never `EXPO_PUBLIC_` for anything but this URL); validate it at startup with Zod (must start with `https://` unless `__DEV__`); a missing/invalid URL renders a blocking config-error screen (not a crash). `.env*` files are gitignored; `eas.json` env or EAS secrets supply values. **No secrets anywhere.** If staging doesn't exist, create one — you cannot test Secure cookies, OAuth redirects, or store builds against localhost.

---

# Risks / Blockers

Legend: 🔴 blocks store launch · 🟠 blocks a feature/quality · 🟡 risk to manage.

| # | Sev | Item | Existing behavior | Mobile requirement | Smallest fix | When |
|---|---|---|---|---|---|---|
| B1 | 🔴 | **No HTTPS in repo's prod proxy** | `Caddyfile` = `:80`, no hostname; `Secure` cookies + `APP_BASE_URL` must be https | HTTPS API (iOS ATS, Android cleartext default, Google OAuth non-localhost redirect) | Deployment config only: set `{$DOMAIN} { … }` in Caddyfile (or confirm an external TLS terminator). **No application code change.** | Before any device test beyond dev |
| B2 | 🟠 | Rate limiting keyed on proxy IP | No `trust proxy`; global shared buckets (20 login/15 min, 1000 req/15 min) | Several clients polling | `app.set('trust proxy', 1)` in `app.ts` (1 line) + mobile poll budget | **Before mobile launch** — and cheap; recommend doing now. Mobile can launch without it only with strict polling budgets |
| B3 | 🟠 | OAuth callback hard-redirects to web | `${CORS_ORIGIN}/platform-connections…`; errors render raw JSON | Return-to-app | `client=mobile` in signed state → redirect `publishiq://…` | Defer (workaround approved) |
| B4 | 🟠 | No push infrastructure | None | Alerts when app is closed | Device-token model + provider + endpoints | Defer to v1.1 |
| B5 | 🟡 | Cookie persistence on Android after force-quit | Unknown | Session restore | Phase 0 spike; native `CookieManager.flush` fallback | Phase 0 |
| B6 | 🟡 | SSE cookie support in RN clients | Unknown | Real-time | Phase 0 spike; polling fallback | Phase 0 |
| B7 | 🟡 | Session 24 h, no refresh | Fixed constant | Fewer re-logins | Longer TTL or refresh token (backend) | Defer; product call |
| B8 | 🟡 | Web defects: missing LogsView, broken republish, raw axios, fake Settings | — | Don't inherit | Separate web fix task (out of scope) | Report; **web build currently fails** — Antigravity must not "fix" it silently; it must verify `frontend` still builds as it was and report the pre-existing failure |
| B9 | 🟡 | Unsigned cookie accepted / `id` is credential | Security debt | — | Backend hardening task | Defer; recommend soon |
| B10 | 🟡 | Role guards weak (Workspaces CRUD for any user; `/scheduler/upcoming` unscoped) | — | UI should hide by role anyway | Backend | Defer |
| B11 | 🟡 | Store process lead times | — | Review cycles, closed-testing rules | Start accounts, privacy policy, demo user early | Now |

**There is no hard application-code blocker for the P0 mobile launch.** B1 is a deployment prerequisite; B2 is a strongly recommended 1-line backend change; everything else has a workaround.

---

# Implementation Phases

Adjusted from your template based on what the code revealed (added **Phase 0**; split auth and OAuth proofs from build work; moved Content Profiles after monitoring):

| Phase | Scope | Exit criteria |
|---|---|---|
| **0 — Environment & proofs** | Staging HTTPS backend reachable; scaffold throwaway Expo SDK 57 dev-client app; run the five cookie/SSE tests on **real Android + iOS devices**; decide SSE vs polling; confirm `trust proxy` status | Written spike result recorded in `mobile/docs/phase0-results.md`; go/no-go on SSE |
| 1 — Foundation | `mobile/` project, TS strict, lint, jest-expo, `app.config.ts`, EAS profiles, env validation, providers skeleton | `npx expo-doctor` clean; app boots; tests run |
| 2 — Design system | tokens, Button, Skeletons, EmptyState, ErrorState, Badge, Card, Field, Sheet, Confirm, Toast, Inter font | Storybook-less gallery screen (dev-only) + component tests; contrast check passes |
| 3 — API client + auth | client, errors, interceptors, AuthProvider, login, restore, logout, 401 handling, SecureStore operator cache | Auth tests green; spike behaviors reproduced in-app |
| 4 — Navigation + shell | route groups, tabs, More hub, search modal shell, offline banner, deep-link scheme | Auth gate + navigation tests |
| 5 — Dashboard | `/dashboard/stats`, sections, pull-to-refresh, focus-gated polling, failed-job retry | Works with real backend; empty/error/skeleton states |
| 6 — Jobs / Queue / Publishing | jobs list/detail, generated content tab, queue (stats/upcoming/approve/reject), publishing history (+ **correct** republish) | Critical-flow integration tests |
| 7 — Notifications + realtime | unread badge, history, filters, mark read, SSE or polling, resume reconciliation | Dedup/reconcile tests; AppState tests |
| 8 — Config screens | Channels, Platform Connections (+ YouTube OAuth), Content Types, Workspaces (read) | OAuth device test passed |
| 9 — Content Profiles / Prompts / Templates | sectioned profile form (all fields), readiness, dry-run; prompts versions; templates preview image | Schema parity tests |
| 10 — Assets & media | pickers, upload with progress, music trim fields, `expo-video` | Upload over cellular tested |
| 11 — Hardening | a11y audit, RTL/Nastaliq check, perf pass, security checklist, Maestro E2E | Maestro E2E for the critical flows green |
| 12 — Release | store assets, privacy policy, demo account, EAS production builds, TestFlight + Play internal → closed → production | Builds installable; review notes complete |

Effort is not estimated here: without the web having tests or a typed API layer, honest estimates would be guesses. The two long poles are Content Profiles (Phase 9) and Phase 0 surprises.

---

# Final Recommendation

Build it, with Expo SDK 57 in `mobile/`, cookie auth unchanged, and a monitoring-first scope (Dashboard, Jobs, Queue approvals, Publishing, Notifications, Connections) before the configuration-heavy screens. **Do the two cheap backend/deployment items outside the mobile task** — HTTPS in the production proxy (B1) and `trust proxy` (B2) — because without them the mobile launch is either impossible or flaky. Treat push and the OAuth deep-link return as v1.1. Fix the web's broken Publishing History republish and missing `LogsView` in a separate task; mobile must not inherit them.

## Required final checks (explicit answers)

1. **Can the existing backend support mobile without modification?** Yes for P0 — every P0 feature maps to an existing endpoint. Push cannot; deployment needs HTTPS; `trust proxy` is a strongly recommended 1-line change.
2. **Can the existing authentication system work safely on React Native?** Yes — cookie sessions via the native cookie jar, no JWT. Safety caveat: backend accepts unsigned cookies and treats `id` as the credential (pre-existing, not mobile-caused). Requires Phase 0 device proof on Android persistence.
3. **Can the existing YouTube OAuth flow work on mobile?** Yes — `authorize` URL → system browser → backend callback → refetch on return. Unchanged Google client; no secrets on device. UX is rough (ends on a web page).
4. **What deep-link changes are required?** For v1: none on the backend. App registers scheme `publishiq://` for internal navigation. Optional later: `client=mobile` redirect to `publishiq://oauth/…`; universal/app links only if you later want https links to open the app.
5. **Can SSE work reliably on mobile?** Foreground: probably (needs Phase 0 cookie proof); background: no. Reconcile on resume by refetch; polling fallback ready.
6. **What requires native push support?** Any notification while the app is backgrounded/killed — needs device-token storage, endpoints, and a push provider on the backend.
7. **What should mobile expose at launch?** P0 list above (auth, dashboard, jobs + actions, queue + approvals, publishing history + retry/republish, notifications, connections incl. YouTube, channels, job creation, generated content review, account/settings).
8. **What should be deferred?** Push, Facebook/Instagram, template live-preview/stress-test/definition editing, user admin, workspace CRUD, domain-event timeline, offline persistence, biometric re-login; Content Profiles/Prompts/Templates/Assets editing are **P1** (build right after P0, not dropped).
9. **What code can be shared?** Nothing is worth sharing today. Design tokens and types are *mirrored*, not shared; revisit a `packages/` extraction only when two consumers would import the same source.
10. **What must remain platform-specific?** All UI components, navigation, shadows/elevation, glass effects, pickers, OAuth browser, secure storage, SSE client, lifecycle handling.
11. **How will web and mobile remain visually consistent?** Typed token mirror extracted from the web's actual hex values and Tailwind v4 palette; same component semantics (Button variants, EmptyState, ErrorState, status colors, terminology); dark-only; documented deltas (solid surfaces instead of backdrop blur; higher-contrast subtle text).
12. **How will they remain behaviorally consistent?** Same endpoints, same envelopes, same enums, same query keys and invalidation rules, same non-optimistic pipeline actions; contract tests with real fixtures; deliberate deltas listed (401 handling, republish fix, timeouts, foreground-gated polling).
13. **What are the actual production blockers?** B1 (HTTPS in prod proxy — deployment). Everything else is a workaround, a recommended fix (B2), or deferred scope. Pre-existing web defects (B8) don't block mobile but mean the web app cannot currently be built from HEAD.