# YouTube Integration — Production Verification Audit

**Auditor stance:** Independent verification only. No code was modified. Every finding below is backed by an exact file path and, where relevant, a line range I actually read — not inferred from file names or doc claims. Where I compared behavior against Google's official/current documentation, I searched for it live (August 2026) rather than relying on training-data memory, because Google's upload/OAuth docs change.

**Scope actually covered:** `backend/src/controllers/oauth.controller.ts`, `services/oauth.service.ts`, `providers/publishing/youtube.provider.ts`, `providers/publishing/publishing.interface.ts`, `providers/publishing/index.ts`, `services/publishing.service.ts`, `services/platformConnection.service.ts`, `services/maintenance.service.ts`, `repositories/platformConnection.repository.ts`, `middlewares/auth.ts`, `routes/oauth.router.ts`, `routes/platform-connections.router.ts`, `utils/crypto.ts`, `utils/logger.ts`, `config/env.ts`, `app.ts`, `prisma/schema.prisma`, `.env.example`, `frontend/src/routes/platform-connections/PlatformConnectionsView.tsx`, plus `AGENTS.md`, `README_AI.md`, `docs/00-glossary.md` → `docs/07-frontend-architecture.md`, `docs/PROJECT_DECISIONS.md`, and the repo's own prior `FINAL_PRODUCTION_VERIFICATION_REPORT.md` (used only as historical context, not as ground truth — several of its findings are now stale, noted below). No top-level `README.md` exists in this repository — only `README_AI.md` (a 50-line AI-agent-facing note) and `frontend/README.md` (the stock Vite template).

---

# Executive Summary

| Score Category | Score (0–100) | Basis |
|---|---|---|
| **Overall YouTube Integration Readiness** | **31 / 100** | See Final Verdict |
| OAuth Score | 35 | Working authorization-code + offline-access flow, but no CSRF/state validation and an unauthenticated callback route |
| Google API Score | 40 | Correct endpoints, wrong upload strategy (multipart, not resumable) and no official client library |
| Security Score | 30 | Strong encryption-at-rest, good redaction, but a real unauthenticated token-injection path and no RBAC on token endpoints |
| Platform Connection Score | 45 | Schema is reasonable but two competing connection-creation paths coexist (real OAuth + a raw-token "mock" form) |
| Publishing Pipeline Score | 55 | Genuinely solid retry/backoff and provider abstraction; undermined by the upload strategy and error classification |
| Configuration Score | 60 | Zod-validated env with production guardrails, but incomplete (see CFG-01) |
| Database Score | 65 | Sound relations/indexes; minor doc/schema drift, no dedicated "lastValidatedAt"/owner-user field |
| Maintainability Score | 45 | Clean provider interface undermined by a fake maintenance job and leftover mock UI |
| Testing Readiness Score | 50 | DI-friendly adapter pattern; the one existing test mocks around the real upload path entirely |

---

## Issues

### YT-001 — Scheduled Token Refresh job is a fake implementation; it never talks to Google
- **Category:** Production Blocker
- **Severity:** Critical
- **Description:** `maintenance.service.ts` → `runTokenRefresh()` is the code that implements the `TokenRefresh` Job Type explicitly added in `docs/PROJECT_DECISIONS.md` (v2.2, Section 268: *"refreshes a Platform Connection's Access/Refresh Token ahead of, or upon, expiry"*). The actual implementation does not call Google's token endpoint, does not call `youtubeAdapter.refreshToken()`, and does not touch `accessTokenEnc` at all. It fabricates a new `expiresAt` 24 hours in the future and sets `healthStatus = Healthy` unconditionally for every connection expiring within the next 2 hours:
  ```ts
  const newExpiresAt = new Date();
  newExpiresAt.setHours(newExpiresAt.getHours() + 24);
  await platformConnectionRepository.updateRaw(conn.id, {
    expiresAt: newExpiresAt,
    healthStatus: HealthStatus.Healthy,
  });
  ```
  The real (working) refresh implementation exists elsewhere — `youtubeAdapter.refreshToken()` in `youtube.provider.ts` and `publishingService.refreshConnectionTokens()` in `publishing.service.ts` — but the scheduled maintenance job never calls either. This is a stub dressed up as a finished feature, which directly violates `AGENTS.md`'s own rules ("Never generate fake implementations," "Never leave placeholders").
- **Files:** `backend/src/services/maintenance.service.ts` (function `runTokenRefresh`, lines ~44–61)
- **Classes/Functions:** `maintenanceService.runTokenRefresh`
- **Production Impact:** Every `HealthStatus`/`expiresAt` value shown on the Platform Connections dashboard after a scheduled refresh is fiction. A connection whose real Google access token expired an hour ago will read "Healthy, valid for 24h" in the database and UI. The system is only saved from total failure by the *separate*, correct on-demand refresh path in `publishing.service.ts` (`ensureConnectionHealth`), which re-checks and re-refreshes immediately before every publish attempt regardless of what the maintenance job claimed. In other words: the proactive refresh job the architecture document promises does not exist; only a reactive, just-in-time refresh exists, and it works by accident of a different code path, not because of this one.
- **Recommendation:** Replace the body of `runTokenRefresh` with an actual call to `getPublishingAdapter(conn.platform).refreshToken(decryptedRefreshToken)`, encrypt and persist the real returned `accessToken`/`expiresIn`, and only set `healthStatus = Healthy` after a successful Google response. On failure, set `Unhealthy`/`Expired` and emit a `TokenExpiring`/`RefreshFailed` domain event (the notification types already exist per `PROJECT_DECISIONS.md` Section 324).

---

### YT-002 — OAuth callback endpoint accepts unauthenticated requests and trusts a forgeable `state` parameter
- **Category:** Security Risk
- **Severity:** Critical
- **Description:** `routes/oauth.router.ts` deliberately does **not** put `requireAuth` on the callback route:
  ```ts
  router.get('/oauth/:platform/authorize', requireAuth, oauthController.authorize);
  router.get('/oauth/:platform/callback', oauthController.callback);  // no auth
  ```
  That's a reasonable choice on its own (Google's redirect can't carry app-specific auth), *provided* `state` is cryptographically bound to the session that started the flow. It isn't. `oauthService.getAuthorizationUrl` builds `state` as plain, unsigned base64:
  ```ts
  const state = Buffer.from(JSON.stringify({ workspaceId, platform, ts: Date.now() })).toString('base64url');
  ```
  and `oauthController.callback` just base64-decodes it back out with no HMAC, no server-side single-use nonce store, and no expiry check on the `ts` field it captured but never reads again:
  ```ts
  const decodedState = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'));
  workspaceId = decodedState.workspaceId;
  ```
  Because `state` is just readable/writable JSON with no secret component, and the callback route has no session check, **any unauthenticated caller** can: (1) run their own Google OAuth consent flow against this app's registered `client_id`/`redirect_uri` using their own Google account to obtain a valid `code`, then (2) call `GET /api/v1/oauth/youtube/callback?code=<their code>&state=<base64 JSON with a target workspaceId of their choosing>` directly, with no cookie, no login, nothing. `platformConnectionRepository.upsertOAuth` will happily create or overwrite a `PlatformConnection` row in that workspace keyed on `(workspaceId, platform, externalAccountId)`. Given `docs/PROJECT_DECISIONS.md` Section 26 states there is "exactly one Workspace row" in v1, the workspaceId is not even meaningfully secret — it's discoverable from any legitimate `/oauth/*/authorize` response.
- **Files:** `backend/src/routes/oauth.router.ts`, `backend/src/controllers/oauth.controller.ts` (`callback`, lines 29–66), `backend/src/services/oauth.service.ts` (`getAuthorizationUrl`, `handleOAuthCallback`), `backend/src/repositories/platformConnection.repository.ts` (`upsertOAuth`)
- **Classes/Functions:** `oauthController.callback`, `oauthService.getAuthorizationUrl`, `platformConnectionRepository.upsertOAuth`
- **Production Impact:** An attacker can inject arbitrary Platform Connection rows into the application's workspace without ever authenticating to the app itself. At minimum this pollutes the connections table and can trigger real (attacker-controlled) publishes to run against the attacker's own YouTube channel using the app's infrastructure/quota; depending on how `Channel`↔`PlatformConnection` linking is done downstream, it can also be used to disrupt or confuse legitimate automated publishing. This is exactly the class of bug the audit brief's "State parameter validation / CSRF protection / Secure callback implementation" checklist item exists to catch.
- **Recommendation:** Generate `state` as a random, server-stored, single-use nonce (e.g., signed with `SESSION_SECRET` via HMAC, or stored server-side keyed by session with a short TTL) at `authorize` time; verify it — including expiry — on `callback`, and reject if it doesn't match. Do not derive `workspaceId` from an unverified client-supplied value.

---

### YT-003 — Multipart upload used for all video uploads; no resumable upload path exists, and the official `googleapis` client isn't used
- **Category:** Production Blocker
- **Severity:** Critical
- **Description:** `youtubeAdapter.publish()` reads the entire video file into memory with `fs.readFileSync`, hand-builds a `multipart/related` body, and POSTs it in one shot to `.../upload/youtube/v3/videos?uploadType=multipart`. There is no `uploadType=resumable` implementation anywhere in the codebase, and `backend/package.json` does not depend on Google's official `googleapis` Node client (which provides resumable upload support out of the box) — everything is hand-rolled on top of raw `axios`.
  Current Google API guidance (verified live, not from training memory) is consistent across every Google upload API family: multipart is documented and intended for small files (Google's own Drive API docs put the ceiling at 5 MB; YouTube-specific third-party integration guides — cross-checked against multiple current sources — describe resumable upload as effectively **mandatory for production video upload**, precisely because "if your internet connection drops halfway through, or your application crashes, you don't lose all the progress"). A vertical Shorts-style video at any reasonable bitrate can easily exceed a few MB, and this implementation has no chunking, no resume-on-failure, and buffers the whole file in Node process memory per upload.
- **Files:** `backend/src/providers/publishing/youtube.provider.ts` (`publish`, lines 60–131); `backend/package.json` (no `googleapis`/`google-auth-library` dependency)
- **Classes/Functions:** `youtubeAdapter.publish`
- **Production Impact:** Uploads are fragile by construction — a dropped connection or a large file forces a full re-upload from scratch (burning Google API quota units a second time against a hard ~6-uploads/day ceiling the project's own docs call out as the practical quota limit), and large files risk outright rejection or memory pressure under concurrent jobs. This is the single most direct violation of the audit brief's explicit ask to verify "latest resumable upload implementation (if implemented)" — it is not implemented at all.
- **Recommendation:** Implement the two-step resumable flow (`POST .../upload/youtube/v3/videos?uploadType=resumable` to obtain a `Location` session URI, then `PUT` the file — chunked, if you want resumability across process restarts — to that URI), or adopt the official `googleapis` client, which implements this for you and is the pattern Google's own samples use.

---

### YT-004 — Production UI ships a raw-token "mock" form that bypasses OAuth entirely, and the backend accepts it with zero verification
- **Category:** Production Blocker
- **Severity:** Critical
- **Description:** `frontend/src/routes/platform-connections/PlatformConnectionsView.tsx` renders a fully wired "Connect Account" dialog whose input labels literally say **"Access Token (Hex String Mock)"** and **"Refresh Token (Hex String Mock)"**, with a placeholder example (`5d41402abc4b2a76b9719d911017c592`). This form is not disabled, hidden behind a dev flag, or role-gated — it sits next to the real "OAuth YouTube" button and submits straight to `POST /platform-connections`. Server-side, `routes/platform-connections.router.ts` validates the payload with Zod only for shape (`z.string().min(1)`), not for authenticity — `platformConnectionService.createConnection` → `platformConnectionRepository.create` stores whatever string is typed in, encrypted, as if it were a real Google token. Nothing ever calls Google to confirm the pasted value is a valid token for the claimed scopes.
- **Files:** `frontend/src/routes/platform-connections/PlatformConnectionsView.tsx` (lines 9–17, 366–394); `backend/src/routes/platform-connections.router.ts` (`connectionCreateSchema`); `backend/src/services/platformConnection.service.ts` (`createConnection`)
- **Classes/Functions:** `PlatformConnectionsView` (form + `createMutation`), `platformConnectionController.create`, `platformConnectionService.createConnection`
- **Production Impact:** This directly contradicts `AGENTS.md`'s "Never leave placeholders / Never generate fake implementations" rule and reintroduces, at the UI layer, the exact "operator manually types a raw token" anti-pattern the repository's own prior audit (`FINAL_PRODUCTION_VERIFICATION_REPORT.md`, Issue #3) flagged as a blocker before OAuth existed. OAuth has since been built correctly (see YT-002 aside from its bug), but this scaffold form was never removed, so the product now ships **two parallel, un-reconciled ways to create a YouTube connection** — one that goes through Google's consent screen and one that doesn't. Any authenticated user (see YT-005 — no role gate at all) can hand-plant garbage tokens that will fail opaquely deep in the publishing pipeline, or worse, intentionally plant a token that isn't actually theirs.
- **Recommendation:** Remove the manual token-entry form from the production build entirely, or if a manual-override path is genuinely required for support/ops, gate it behind `requireRole([Owner])`, rename it away from "Mock," and validate the pasted token against Google's tokeninfo/userinfo endpoint before persisting it.

---

### YT-005 — No RBAC on Platform Connection endpoints; any authenticated `User` can create, edit, or delete OAuth credentials
- **Category:** Security Risk
- **Severity:** High
- **Description:** `docs/PROJECT_DECISIONS.md` (v2.3) formally approves three roles — `Owner`, `Administrator`, `User` — and `middlewares/auth.ts` exports a working `requireRole` guard. It is used on `routes/users.router.ts` but **nowhere in `routes/platform-connections.router.ts` or `routes/oauth.router.ts`** — both only apply `requireAuth`. The lowest-privilege `User` role can call `POST/PUT/DELETE /platform-connections` and `GET /oauth/youtube/authorize` freely.
- **Files:** `backend/src/routes/platform-connections.router.ts`, `backend/src/routes/oauth.router.ts`
- **Classes/Functions:** router-level middleware chain (absence of `requireRole`)
- **Production Impact:** Violates the least-privilege principle `AGENTS.md`'s own Security section requires. Any operator account, regardless of role, can disconnect the production YouTube channel, or (combined with YT-004) inject arbitrary credentials.
- **Recommendation:** Gate write operations on `/platform-connections` and the OAuth authorize/connect flow behind `requireRole([Owner, Administrator])`, consistent with how `users.router.ts` already does it.

---

### YT-006 — Refresh token exchange silently substitutes the access token when Google omits `refresh_token`
- **Category:** Functional Bug
- **Severity:** High
- **Description:** In `oauthService.handleOAuthCallback`, the YouTube branch does:
  ```ts
  const accessToken = tokenRes.data.access_token;
  const refreshToken = tokenRes.data.refresh_token || accessToken;
  ```
  If Google's authorization-code exchange ever responds without a `refresh_token` (this happens whenever a user has previously granted consent and Google doesn't re-issue one — the `prompt=consent` parameter used here mitigates but does not eliminate this), the code stores the **access token** in the `refreshTokenEnc` column, no error, no log, no warning. The bug then detonates later: `refreshConnectionTokens` / `youtubeAdapter.refreshToken` will submit that value as `refresh_token` in a `grant_type=refresh_token` request, which Google will reject with `invalid_grant`. Nothing in this flow catches the root cause; only the downstream symptom.
- **Files:** `backend/src/services/oauth.service.ts` (lines 158–159)
- **Classes/Functions:** `oauthService.handleOAuthCallback`
- **Production Impact:** A connection can silently be created in a state that looks healthy at connect-time but is unrefreshable the moment the access token expires (typically ~1 hour for Google access tokens), forcing the operator to disconnect and reconnect YouTube with no clear diagnostic pointing at the real cause.
- **Recommendation:** If `refresh_token` is absent from the token response, throw an `ExternalProviderError` explaining that Google didn't return offline access (and instruct re-consent), instead of quietly reusing the access token.

---

### YT-007 — Error-transience classification is regex/substring matching on human-readable error text, not HTTP status/reason codes
- **Category:** Maintainability Issue
- **Severity:** Medium
- **Description:** `publishingService.isTransientError` decides whether to retry by lowercasing `err.message` and checking for substrings like `'429'`, `'rate limit'`, `'timeout'`, `'503'`. `PublishResult.errorMessage` (in `publishing.interface.ts`) is a free-text string, not a structured code — so this is the *only* signal the retry loop has. Google's actual quota-exceeded response for YouTube uploads (`403`, reason `quotaExceeded` / `uploadLimitExceeded`) contains none of the matched substrings, so a quota failure is currently treated as a **permanent** failure (no retry) — which is accidentally the right behavior for that one case, but only by luck, not by design. Any transient error whose message happens not to contain one of those exact substrings (e.g., a different phrasing of a 5xx, or a Google error object where `err.response.data.error.message` doesn't include a numeric code) is silently treated as permanent.
- **Files:** `backend/src/services/publishing.service.ts` (`isTransientError`, lines 509–522); `backend/src/providers/publishing/publishing.interface.ts` (`PublishResult`)
- **Classes/Functions:** `publishingService.isTransientError`, `PublishResult`
- **Production Impact:** Unreliable retry behavior that will misclassify errors as Google's exact error wording drifts over time (it is not a documented, stable contract).
- **Recommendation:** Have `youtubeAdapter.publish` return the actual HTTP status and Google `error.errors[].reason` field in a structured `PublishResult.errorCode`, and classify transience against that in the Service layer instead of string-matching prose.

---

### YT-008 — `ENCRYPTION_KEY` and `SESSION_SECRET` are not checked against known default/dev values in production
- **Category:** Configuration Bug
- **Severity:** Medium
- **Description:** `config/env.ts`'s production `.refine()` block explicitly checks `OPERATOR_PASSWORD`, `OPERATOR_EMAIL`, and `ENCRYPTION_SALT` against their `.env.example` default values and fails startup if unchanged — but it does **not** apply the same check to `ENCRYPTION_KEY` (which is the AES-256-GCM key protecting every stored OAuth token) or `SESSION_SECRET`. Both only get a `min(32)` length check, and the shipped example value (`dev-encryption-key-with-32-characters!!`) is exactly 32+ characters, so it passes validation even though it's a publicly-committed, known value.
- **Files:** `backend/src/config/env.ts` (lines 24–35); `backend/.env.example`
- **Classes/Functions:** `envSchema.refine`
- **Production Impact:** A deploy that forgets to override `ENCRYPTION_KEY` will start up successfully in `production` mode while using a key anyone can read from this repository's `.env.example`, defeating the token-at-rest encryption entirely (the encryption implementation itself, `crypto.ts`, is otherwise solid — see Positive Findings).
- **Recommendation:** Add `ENCRYPTION_KEY` and `SESSION_SECRET` to the production `.refine()` default-value blocklist, exactly like `ENCRYPTION_SALT`/`OPERATOR_PASSWORD` already are.

---

### YT-009 — YouTube privacy status is hardcoded `public`, ignoring any channel/content-profile configuration
- **Category:** Functional Bug
- **Severity:** Medium
- **Description:** `youtube.provider.ts` sets `status.privacyStatus: 'public'` unconditionally with the comment "Default public for shorts." There is no wiring from `Channel.publishingConfiguration` (JSONB, exists in schema for exactly this kind of per-channel override) or `ContentProfile` into this value.
- **Files:** `backend/src/providers/publishing/youtube.provider.ts` (lines 82–86)
- **Classes/Functions:** `youtubeAdapter.publish`
- **Production Impact:** No way to stage content as `private`/`unlisted` before manual review, which matters for automatic (`Channel.automationMode = Automatic`) publishing where nothing else in the pipeline gates content before it goes live publicly. This is a real operational risk for a system explicitly designed to auto-publish.
- **Recommendation:** Read privacy status from `Channel.publishingConfiguration` (with `public` as the documented default) and pass it through `GeneratedContentData`/the adapter call.

---

### YT-010 — Health check uses an undocumented debug endpoint instead of a real YouTube Data API call
- **Category:** Maintainability Issue
- **Severity:** Low
- **Description:** `youtubeAdapter.checkHealth` pings `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=...`. This endpoint works today and isn't on Google's formal deprecation list, but it is not part of the documented YouTube Data API v3 surface, doesn't verify the specific `youtube.upload` scope is actually still granted (a user can revoke a specific scope on Google's Account Permissions page without fully revoking the token), and sends the access token as a URL query parameter (more likely to land in access logs / proxies than an `Authorization` header).
- **Files:** `backend/src/providers/publishing/youtube.provider.ts` (`checkHealth`, lines 143–149)
- **Classes/Functions:** `youtubeAdapter.checkHealth`
- **Production Impact:** Low — mostly a false-positive-health risk (token "valid" per tokeninfo but insufficient scope for upload) and a minor token-in-URL logging concern.
- **Recommendation:** Health-check with a cheap, scope-relevant call such as `GET /youtube/v3/channels?part=id&mine=true` using the `Authorization: Bearer` header, which both confirms the token *and* the required scope.

---

### YT-011 — `PlatformConnection` has no "last validated" timestamp or connecting-user/owner field
- **Category:** Future Enhancement
- **Severity:** Low
- **Description:** The audit brief asks whether `PlatformConnection` tracks "Last Validation" and "Ownership" at the user level. `prisma/schema.prisma`'s `PlatformConnection` model has `healthStatus` but no `lastValidatedAt`/`lastCheckedAt` column, and no FK to the `User` who performed the connection (only `workspaceId`, and `docs/PROJECT_DECISIONS.md` Section 26 confirms Workspace, not User, is the intended ownership scope for v1 — so this is arguably by design, not a bug).
- **Files:** `backend/prisma/schema.prisma` (`PlatformConnection`)
- **Production Impact:** Minor — you can infer "last validated" approximately from `updatedAt`, but that field is overloaded (also bumped by unrelated edits), so it's not a reliable audit trail.
- **Recommendation:** Add an explicit `lastValidatedAt DateTime?` column, set only by `checkHealth`/`refreshConnectionTokens`, separate from generic `updatedAt`.

---

### YT-012 — `PipelineStage` enum still contains stages `PROJECT_DECISIONS.md` (v2.3) says were removed as dead
- **Category:** Maintainability Issue
- **Severity:** Low — documentation/schema drift, not YouTube-specific, but it touches the `Publishing` stage this integration depends on
- **Description:** `docs/PROJECT_DECISIONS.md` v2.3 changelog states dead stages `GeneratingImage`, `GeneratingVideo`, `SelectingMusic`, `Published` were removed from the database schema and replaced with a cleaner 14-state machine. `docs/05-database-design.md` (Section 5.1) still lists the old, pre-v2.3 stage names verbatim in its `Job.pipelineStage` enum documentation. The actual `prisma/schema.prisma` `PipelineStage` enum has moved on (`RenderingImage`, `RenderingVideo`, `AttachingMusic`, `Completed` instead) — so the **code** matches the v2.3 decision, but **`05-database-design.md` was never updated** to match, and now contradicts both `PROJECT_DECISIONS.md` and the schema it's supposed to document.
- **Files:** `docs/05-database-design.md` (Section 5.1, `Job.pipelineStage` block) vs. `backend/prisma/schema.prisma` (`enum PipelineStage`)
- **Production Impact:** None functionally (the schema is correct) — but it's exactly the kind of doc drift `AGENTS.md`'s "Documentation remains consistent" completion-checklist item exists to prevent, and it will actively mislead the next engineer or agent who reads `05-database-design.md` as source of truth per `AGENTS.md`'s stated doc-priority order.
- **Recommendation:** Update `docs/05-database-design.md` Section 5.1 to match the current schema.

---

## Critical Production Blockers
1. **YT-001** — Scheduled Token Refresh job is fake; never calls Google.
2. **YT-002** — Unauthenticated, unsigned-state OAuth callback allows arbitrary connection injection.
3. **YT-003** — No resumable upload; entire-file-in-memory multipart upload only.
4. **YT-004** — Production UI ships a "mock" raw-token entry form that bypasses OAuth and is accepted server-side with no verification.

## High Priority Issues
5. **YT-005** — No RBAC on platform-connection/OAuth routes.
6. **YT-006** — Access token silently substituted for missing refresh token.

## Medium Priority Issues
7. **YT-007** — Retry/transience classification via string-matching on error prose, not status codes.
8. **YT-008** — `ENCRYPTION_KEY`/`SESSION_SECRET` not checked against known defaults in production.
9. **YT-009** — Privacy status hardcoded `public`.

## Low Priority Issues
10. **YT-010** — Health check uses an undocumented debug endpoint, token passed as query param.
11. **YT-011** — No `lastValidatedAt` column on `PlatformConnection`.
12. **YT-012** — `05-database-design.md` pipeline-stage documentation drifted from the schema.

---

## Positive Findings
Credit where it's due — this is not a uniformly bad codebase:
- **Provider abstraction is genuinely clean.** `publishing.interface.ts` + `providers/publishing/index.ts`'s factory function is exactly the pattern `AGENTS.md` asks for: no platform-specific logic leaks into `publishing.service.ts`, and adding a fourth platform would mean adding one file, not touching the service layer.
- **Token encryption at rest is correctly implemented.** `crypto.ts` uses AES-256-GCM with a random 12-byte IV per encryption, a 16-byte auth tag, and an `scrypt`-derived key computed once at startup (not per-call) — no reinvented-crypto red flags here.
- **Frontend never receives real tokens.** `platformConnection.controller.ts`'s `mapConnectionResponse` always masks `accessTokenHex`/`refreshTokenHex` to `'********'` before sending to the client, and the repository's `update()` explicitly no-ops re-encryption if it receives that placeholder back — a genuinely thought-through guard against accidentally overwriting real tokens with the masked display value.
- **On-demand token refresh (as opposed to the scheduled job, YT-001) works correctly.** `publishingService.ensureConnectionHealth` / `refreshConnectionTokens` checks expiry, pings the provider, and refreshes-and-persists before every publish attempt — this is the thing that saves the pipeline from YT-001 in practice.
- **Publish retry logic has real backoff.** Up to 3 retries with `2000ms * attempt` backoff, distinguishing transient vs. permanent failures (mechanism itself is fragile, see YT-007, but the *structure* is correct and matches documented best practice of exponential-ish backoff + bounded retries).
- **Structured, typed errors and Pino redaction are actually used**, not just declared in `AGENTS.md` — `errors/custom-errors.ts` typed errors and `logger.ts`'s `redact.paths` (with `remove: true`) for cookies/authorization headers/tokens are both real, working code, not aspirational documentation.
- **The redirect URI construction is consistent.** The `redirect_uri` built in `oauth.service.ts` (`${APP_BASE_URL}/api/v1/oauth/${platform}/callback`) matches exactly where `app.ts`/`v1.router.ts`/`oauth.router.ts` actually mount the callback route — no silent mismatch bug there.
- **Production env-var enforcement exists and is real** (`config/env.ts`'s `.refine()`), just incomplete (YT-008) — most projects don't bother with this at all.
- **A prior self-audit already exists in-repo** (`FINAL_PRODUCTION_VERIFICATION_REPORT.md`) and its OAuth-related findings (#3, #4 — "no OAuth flow exists," "no external account identifier") have since been genuinely fixed: a real `externalAccountId`/`displayName`-populating OAuth flow now exists. That's real, verifiable progress — it just wasn't finished (YT-004 shows the old mock path was left running in parallel instead of being deleted).

---

## Deployment Checklist
- [ ] Fix YT-001 (real scheduled token refresh) before relying on the Token Refresh job type for anything.
- [ ] Fix YT-002 (sign/verify OAuth `state`, or otherwise the callback route is exploitable by anyone on the internet, not just logged-in operators).
- [ ] Fix YT-003 (resumable upload) before uploading anything but trivially small test clips.
- [ ] Remove or role-gate YT-004 (mock token form) before allowing non-Owner accounts near this screen.
- [ ] Apply YT-005 (RBAC) to `/platform-connections` and `/oauth` routes.
- [ ] Confirm `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are the real production OAuth client credentials, not test/dev ones (the `env.ts` presence check passes either way).

## Configuration Checklist
- [ ] `ENCRYPTION_KEY` is a real, unique, high-entropy secret — not the `.env.example` default (currently unenforced, YT-008).
- [ ] `SESSION_SECRET` is a real, unique secret — not the `.env.example` default (currently unenforced, YT-008).
- [ ] `APP_BASE_URL` is the real public HTTPS domain (Google will reject the redirect_uri otherwise, and `APP_BASE_URL` defaults to `http://localhost:4000` if unset — no production check on this one either).
- [ ] `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` set (already enforced at startup — this part is solid).
- [ ] The Google Cloud OAuth consent screen is verified/published (unaudited here — outside repo scope, but required for `youtube.upload` scope to work for non-test users).

## OAuth Checklist
- [x] Authorization Code Flow — implemented correctly.
- [x] Offline access (`access_type=offline`) — present.
- [x] `prompt=consent` to force refresh-token issuance — present.
- [ ] State parameter validated as a CSRF token — **not implemented (YT-002)**.
- [ ] Callback route authenticated or otherwise trust-verified — **not implemented (YT-002)**.
- [ ] Missing-refresh-token case handled distinctly from success — **not implemented (YT-006)**.
- [x] Redirect URI consistent between authorize/callback/mount — verified consistent.
- [x] Tokens encrypted at rest — verified (AES-256-GCM).
- [x] Tokens never returned to frontend in plaintext — verified.

## Publishing Checklist
- [x] Provider abstraction / no business logic leakage — verified clean.
- [x] Retry with backoff on transient failure — implemented, mechanism is fragile (YT-007).
- [ ] Resumable upload for reliability on real video files — **not implemented (YT-003)**.
- [ ] Privacy status configurable per channel/content — **hardcoded (YT-009)**.
- [x] Publishing failure recorded per platform independently (`PublishingRecord`) — verified via schema/repository.
- [x] Publish success/failure emits domain events — verified.

---

## Final Verdict

**Can this YouTube integration be deployed to production?**

## NO

Blocking issues, in order of what will actually break first:

1. **YT-004 / YT-002** — The connection layer accepts credentials from two places, one of which requires no verification whatsoever and the other of which can be reached by an unauthenticated caller. Fix the authorization boundary before anything else.
2. **YT-001** — The system's only proactive token-health mechanism is fake. It reports connections as healthy without checking them.
3. **YT-003** — The upload mechanism itself is not built for anything but the smallest test files and has no recovery story for network failure, despite Google's own guidance treating resumable upload as the production-required approach for video.
4. **YT-005 / YT-006** — Authorization and a real (if narrow) token-handling bug that will eventually strand a connection in an unrefreshable state with a misleading error.

None of these are hard to fix individually — the underlying architecture (provider interface, encryption, retry/backoff, structured errors, env validation) is well above average and shows real engineering discipline in several places. But as shipped today, the YouTube integration has an open, unauthenticated write path into its own credential store, a health-reporting mechanism that lies, and an upload implementation that Google's own documentation says isn't fit for production video traffic. That combination is a "do not deploy" regardless of how solid the rest of the pipeline is.
