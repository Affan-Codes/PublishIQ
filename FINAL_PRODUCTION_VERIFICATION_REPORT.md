# FINAL PRODUCTION VERIFICATION REPORT — PublishIQ

**Auditor stance:** Independent verification, not the implementation team. Findings below are backed by exact file/line evidence pulled from the repository (`PublishIQ-main`) and cross-checked against `docs/PROJECT_DECISIONS.md`, `AGENTS.md`, `docs/02-product-requirements-prd.md`, and `docs/03-technical-requirements.md`.

**Scope disclaimer (read this before the score):** This is a deep, evidence-based audit of the highest-risk integration points named in the audit brief — configuration/deployment plumbing, the AI pipeline, the job/pipeline state machine, Platform Connections end-to-end, security middleware, and the database schema — traced across module boundaries, not file-by-file in isolation. It is not a line-by-line review of all 116 backend files and 26 frontend files; where I say something is fine, it's because I read it, not because I assumed it. I flag several issues below that I'm highly confident are real and reproducible (I traced the exact code path), and I'm explicit about which ones I verified end-to-end vs. spot-checked.

---

# Executive Summary

| Score Category | Score (0–100) |
|---|---|
| **Overall Production Readiness** | **34 / 100** |
| Architecture | 68 |
| Security | 48 |
| Backend | 60 |
| Frontend | (not deeply audited — see note) 55 |
| Database | 62 |
| Platform Integration | 22 |
| AI Pipeline | 15 |
| Rendering Pipeline | 65 |
| BullMQ & Scheduler | 58 |
| Deployment | 20 |
| Maintainability | 70 |
| Documentation | 72 |
| Testing Confidence | 40 (test files exist but weren't exhaustively run/audited here) |

The architecture is genuinely good — layered Controller→Service→Repository discipline is real, not cosmetic; Zod validation is present on the routes I checked; the job state machine and duplicate-regeneration loop are implemented faithfully to spec (Section 6.2, Section 19). This is not a sloppy codebase.

But it is **not deployable today**, and not because of style nitpicks. Two of the three core value propositions of this product — "generate content with AI" and "publish to real platforms" — are dead on arrival in the shipped configuration, for boring, concrete, reproducible reasons detailed below. This is the kind of thing that only shows up when you trace the *whole system* end to end, which is exactly what was asked for.

---

## Critical Production Blockers (the repo will not function as deployed)

### Issue #1 — `docker-compose.prod.yml` never forwards the secrets the app requires to run
**Category:** Configuration Bug / Production Blocker
**Severity:** Critical

**Description:** `backend/src/config/env.ts` validates and, in production, **hard-requires** `ENCRYPTION_SALT` to be explicitly set (its `.refine()` rejects the default value *or* an unset `process.env.ENCRYPTION_SALT` whenever `NODE_ENV === 'production'`). But `docker-compose.prod.yml`'s `api` and `worker` service `environment:` blocks only forward: `NODE_ENV, PORT, DATABASE_URL, REDIS_URL, SESSION_SECRET, ENCRYPTION_KEY, LOG_LEVEL, MEDIA_ROOT, QUEUE_PREFIX, OPERATOR_EMAIL, OPERATOR_PASSWORD`. `ENCRYPTION_SALT` is not in that list, and it isn't in the root `.env.example` either.

**Why It Is A Problem:** `env.ts` calls `envSchema.safeParse(process.env)` at module load and does `process.exit(1)` on failure. With `NODE_ENV=production` set by the compose file but `ENCRYPTION_SALT` never injected into the container, this validation **fails every single time**, and the `api` and `worker` containers crash-loop on boot. This isn't a hypothetical — it's the literal, current contents of the shipped compose file plus the shipped `.env.example`.

**Exact Files:** `docker-compose.prod.yml` (lines ~44–58, `api` and `worker` `environment:` blocks), `.env.example` (root), `backend/src/config/env.ts` (lines 22–35).
**Exact Classes/Functions:** `envSchema.refine(...)` in `config/env.ts`.

**Expected Behavior:** Every variable `env.ts` can require in production is forwarded by the compose file and documented in `.env.example`.
**Current Behavior:** `ENCRYPTION_SALT` is required by code, absent from the compose file's env forwarding, and absent from `.env.example`.
**Potential Production Impact:** The API and worker containers will not start. This is the single most severe finding in this report — nothing downstream matters if the process never boots.
**Recommended Fix (high-level):** Add `ENCRYPTION_SALT` to `docker-compose.prod.yml`'s `api` and `worker` environment blocks, add it to both `.env.example` files with a comment that it must be overridden in production, and add a docker-compose-level `docker compose config` or startup smoke test to CI so this class of drift is caught before merge, not after deploy.

---

### Issue #2 — AI pipeline is hardcoded to a Gemini model that is already fully shut down
**Category:** Integration Bug / Production Blocker
**Severity:** Critical

**Description:** `backend/src/providers/ai/gemini.provider.ts` line 72 calls `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`. I checked Google's current Gemini API deprecation page and release notes (as of the date of this audit): **all Gemini 1.0 and Gemini 1.5 models are already shut down and return HTTP 404 on every request.** Google is now several generations past this (2.0 shut down June 1 2026; 2.5 on a further retirement schedule; 3.x is current GA).

**Why It Is A Problem:** `PROJECT_DECISIONS.md` Section 5 names Gemini as the sole v1 AI provider, and Section 18.1/19 make `GeneratingContent` the very first stage of the one and only Job Type in the system. Every Content Pipeline Job will fail at the first real stage, 100% of the time, in production, today.

**Exact Files:** `backend/src/providers/ai/gemini.provider.ts` (line 72, and the `model: 'gemini-1.5-flash'` literal in the returned metadata at line 133).
**Exact Classes/Functions:** `geminiProvider.generate()`.

**Expected Behavior:** Calls a currently-supported Gemini model (per Section 5's "lowest operational cost" priority, a current `flash`-tier model), ideally read from `SystemConfiguration`/env rather than hardcoded, so future model retirements don't require a code change (this is the same reasoning the docs already apply to render concurrency, retry limits, etc. in Section 21 — model ID belongs there too).
**Current Behavior:** Hardcoded to a dead model ID; every generation call will fail with an HTTP error the retry-with-backoff wrapper will dutifully retry and still fail.
**Potential Production Impact:** 100% failure rate on the core product feature. Every scheduled Channel run burns a BullMQ job attempt and produces a `Failed` job with no possibility of success until the code is patched.
**Recommended Fix (high-level):** Update the model identifier to a currently-GA Gemini model, make the model ID a `SystemConfiguration` value (not a string literal) so this doesn't recur silently, and add a startup or `Health Check` Job Type (Section 18.2 already defines this job type for exactly this purpose) that actually calls the model with a trivial prompt to confirm availability, rather than only checking token validity.

---

### Issue #3 — Platform Connections have no OAuth flow at all; PRD acceptance criteria are unmet
**Category:** Documentation Drift / Functional Bug
**Severity:** Critical (blocks FR-CHN-03 as written) / High if you accept manual entry as an intentional v1 shortcut

**Description:** `docs/02-product-requirements-prd.md` FR-CHN-03 states: *"The operator can add a new Platform Connection (**initiating the platform's official OAuth or credential flow**)."* What's actually implemented (`backend/src/controllers/platformConnection.controller.ts`, `backend/src/routes/platform-connections.router.ts`, `frontend/.../PlatformConnectionsView.tsx`) is a plain CRUD form: the operator manually types a raw `accessTokenHex` and `refreshTokenHex` into two text inputs and submits them. There is no `/oauth/callback` route, no redirect-to-provider flow, no authorization-code exchange, anywhere in the repository (I grepped the whole tree for "oauth" — the only hits are inside the *token-refresh* calls to Facebook/Google's token endpoints, not an authorization flow).

**Why It Is A Problem:** Real Facebook Page tokens, Instagram Business tokens, and Google refresh tokens are not something an operator can casually "know" and type in — they're normally obtained only by walking through the provider's OAuth consent screen (Meta App Review is even required for Instagram Content Publishing scopes). Requiring the operator to source these tokens out-of-band (Graph API Explorer, etc.) every time they add a connection, and again whenever a long-lived token needs replacing, is not a viable operational model, and it's not what the frozen documentation describes.

**Exact Files:** `backend/src/controllers/platformConnection.controller.ts`, `backend/src/routes/platform-connections.router.ts`, `backend/src/services/platformConnection.service.ts`, `frontend/src/routes/platform-connections/PlatformConnectionsView.tsx`.
**Expected Behavior:** Add-Connection triggers a redirect into the provider's OAuth consent screen; a callback route exchanges the code for tokens server-side; tokens are written to `PlatformConnection` without ever passing through the browser or a text input.
**Current Behavior:** Manual paste-in form for raw tokens.
**Potential Production Impact:** Onboarding a new Facebook Page, Instagram Business Account, or YouTube Channel is a manual, error-prone, unsupported-by-the-provider workflow. This is also why Issue #4 (multi-account identity) below is unresolvable without first fixing this.
**Recommended Fix (high-level):** Build the standard OAuth authorization-code flow per platform (Meta Login for Facebook/Instagram, Google OAuth 2.0 for YouTube) behind the existing Provider abstraction, exactly as `AGENTS.md`'s Providers section and `PROJECT_DECISIONS.md` Section 33.4 already require.

---

## High Priority Issues

### Issue #4 — `PlatformConnection` has no external account identifier; "multiple Facebook Pages / Instagram accounts / YouTube channels" cannot actually be supported
**Category:** Functional Bug / Scalability Concern
**Severity:** High

**Description:** `PlatformConnection` in `prisma/schema.prisma` (lines 284–300) stores: `platform`, `accessTokenEnc`, `refreshTokenEnc`, `expiresAt`, `scopes`, `healthStatus`, `status`, `workspaceId`. There is no field for the underlying account — no Facebook Page ID, no Instagram Business Account ID, no YouTube Channel ID, and no human-readable label (page name, channel name, handle). The audit brief specifically asked whether the system supports multiple Facebook Pages, multiple Instagram Business Accounts, and multiple YouTube Channels — it does not, structurally, because nothing in the row tells you *which* Page/Account/Channel a given connection points to.

**Why It Is A Problem:** An operator who connects two Facebook Pages ends up with two `PlatformConnection` rows that are visually and functionally indistinguishable in the dashboard (the UI in `PlatformConnectionsView.tsx` only renders `platform`, health, and a masked token). There is no way to pick "publish to Page A" vs "publish to Page B" when wiring a Channel.
**Exact Files:** `backend/prisma/schema.prisma` (model `PlatformConnection`), `backend/src/providers/publishing/facebook.provider.ts`, `instagram.provider.ts`, `youtube.provider.ts`.
**Expected Behavior:** `PlatformConnection` carries an `externalAccountId` and `displayName`/`accountName` populated from the provider at connection time, with a uniqueness constraint on `(workspaceId, platform, externalAccountId)` to prevent duplicate connections to the same underlying account.
**Current Behavior:** No such field exists.
**Potential Production Impact:** Multi-account support — an explicitly named requirement in the audit brief and implied by Section 15/24 — is not actually usable in the current schema.
**Recommended Fix (high-level):** Add `externalAccountId` (unique per platform+workspace) and `displayName` columns; populate them during the OAuth callback (Issue #3) from each platform's "who am I" / list-pages endpoint.

---

### Issue #5 — Publishing adapters silently fall back to dummy OAuth client credentials instead of failing fast
**Category:** Security Risk / Configuration Bug
**Severity:** High

**Description:** `facebook.provider.ts` line 150–151, `instagram.provider.ts` line 200–201, and `youtube.provider.ts` line 154–155 all do:
```
client_id: process.env.FACEBOOK_APP_ID || 'dummy_app_id',
client_secret: process.env.FACEBOOK_APP_SECRET || 'dummy_app_secret',
```
None of `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` are part of the Zod-validated `envSchema` in `config/env.ts`, and none appear in either `.env.example` file.

**Why It Is A Problem:** `env.ts` already establishes the correct pattern elsewhere in this same file — fail loudly at startup in production if a required secret is missing or left at its default. That discipline was not applied here. Instead, a misconfigured deployment doesn't crash; it silently calls Meta's and Google's token-refresh endpoints with literal string `'dummy_app_id'`/`'dummy_client_id'`, which will fail with a confusing provider-side error instead of an actionable local one, at the worst possible time (mid-token-refresh, potentially disabling a live Channel).
**Exact Files:** `backend/src/providers/publishing/facebook.provider.ts`, `instagram.provider.ts`, `youtube.provider.ts`; `backend/src/config/env.ts`.
**Recommended Fix (high-level):** Move these four variables into `envSchema`, apply the same production `.refine()` fail-fast treatment already used for `OPERATOR_EMAIL`/`OPERATOR_PASSWORD`/`ENCRYPTION_SALT`, and remove the `|| 'dummy_...'` fallbacks entirely.

---

### Issue #6 — `GEMINI_API_KEY` is optional in the env schema, breaking the app's own fail-fast pattern
**Category:** Configuration Bug
**Severity:** High

**Description:** `env.ts` line 20: `GEMINI_API_KEY: z.string().optional()`. Given Gemini is the only AI provider in v1 (Section 5) and every Content Pipeline Job depends on it, this should be required at minimum in production, the same way `OPERATOR_EMAIL`/`OPERATOR_PASSWORD` are.
**Exact Files:** `backend/src/config/env.ts`.
**Current Behavior:** The app boots successfully with no Gemini key configured; the failure only surfaces later, per-job, as an `ExternalProviderError` inside `gemini.provider.ts`'s `generate()` (which does check `if (!apiKey)` and throws there) — functionally correct, but late and easy to miss in ops.
**Recommended Fix (high-level):** Make `GEMINI_API_KEY` required (at least conditionally, matching the existing production `.refine()` pattern).

---

### Issue #7 — Repository layer has no workspace-scoping on `getById` almost anywhere; tenant isolation lives only in the "list" methods
**Category:** Security Risk / Scalability Concern
**Severity:** High (not exploitable today with one workspace; becomes a live IDOR the moment a second workspace exists)

**Description:** I checked every `*.repository.ts` file's `getById`. With one partial exception (`publishingRecord.repository.ts`, which takes an *optional* `workspaceId` that most callers don't pass), **none** of them filter by `workspaceId`: `job.repository.ts`, `channel.repository.ts`, `contentProfile.repository.ts`, `contentType.repository.ts`, `generatedContent.repository.ts`, `platformConnection.repository.ts`, `prompt.repository.ts`, `template.repository.ts`, `asset.repository.ts`, `notification.repository.ts` all do a bare `prisma.<model>.findUnique({ where: { id } })`.

**Why It Is A Problem:** `PROJECT_DECISIONS.md` Section 26 is explicit: *"every table/entity carries a Workspace identifier from day one, so no retrofit is needed later."* The schema does carry `workspaceId` on every table. But the repository layer doesn't use it for single-record lookups, only for `list()` calls. So the schema-level groundwork for multi-tenancy exists, but the actual isolation enforcement doesn't. Today, with exactly one workspace, this is inert. The moment a second `User`/`Workspace` is created — which is this project's own explicitly stated SaaS-readiness goal (Section 1, Section 33.5) — any authenticated operator can fetch or mutate any other workspace's Job, Channel, ContentProfile, PlatformConnection, etc. by ID, because nothing checks that the ID belongs to their workspace.
**Exact Files:** All files listed above under `backend/src/repositories/`.
**Recommended Fix (high-level):** Every `getById`-style method used from a request context needs to accept and enforce `workspaceId` in its `where` clause (Prisma `findFirst({ where: { id, workspaceId } })`), consistent with the one file that already does this partially correctly. This is a mechanical, low-risk change to make now, while it's cheap, rather than after a second workspace exists.

---

### Issue #8 — Retrying a job that failed at `Publishing` re-runs the entire generation pipeline from scratch, and desynchronizes `Job` from `GeneratedContent`
**Category:** Functional Bug / Integration Bug
**Severity:** High

**Description:** In `content-pipeline.service.ts`, `runContentPipeline()` computes `resumeStageStr` from `job.failureStage` when the job previously failed, and looks up `generationStages.indexOf(resumeStageStr)` to decide where to resume (lines ~275–286). `generationStages` only contains the seven generation/render stages — it does **not** include `Publishing`. So if a job fails during `Publishing` (e.g., a transient platform API error) and BullMQ retries it, `stageIndex` is `-1`, `startIndex` stays `0`, and the guard `if (job.pipelineStage !== PipelineStage.Publishing && job.pipelineStage !== PipelineStage.Completed)` evaluates true (because `job.pipelineStage` is `Failed`, not `Publishing`), so the **entire** generation-through-rendering phase runs again: a new Gemini call, a new Playwright render, a new FFmpeg encode.

Worse: `GeneratedContent` is looked up by `jobId` (unique) and only created `if (!genContent)` — so on this retry, the pre-existing `GeneratedContent` row from the first attempt is **not updated** with the newly generated text/image/video, and its `textHash` is never refreshed either (the hash-write line is inside the same `if (!genContent)` block). The `Job` row now holds the second attempt's content; the `GeneratedContent` row — the canonical dashboard/duplicate-detection record — still holds the first attempt's.

**Why It Is A Problem:** This directly contradicts `PROJECT_DECISIONS.md` Section 18.2's explicit distinction between "a Content Pipeline Job's own internal retry of its Publishing state" (expected to just retry publishing) and the separate "Retry Publish" Job Type. It also silently burns AI-provider and compute cost on every publish-stage hiccup, and produces two different pieces of content associated with one Job record with only one of them ever hashed for duplicate detection — meaning duplicate detection quietly degrades on every retried job.
**Exact Files:** `backend/src/services/content-pipeline.service.ts` (the `resumeStageStr`/`generationStages` logic and the `if (!genContent)` block).
**Recommended Fix (high-level):** Include `Publishing` (and `Completed`) as valid resume points recognized by the resume-index calculation, and update/replace the existing `GeneratedContent` row (not just create-if-absent) whenever the job's content fields change on a re-run.

---

## Medium Priority Issues

### Issue #9 — Session tokens are stored in plaintext (not hashed) in the `Session` table
**Category:** Security Risk
**Severity:** Medium

**Description:** `Session` (`schema.prisma` lines 485–492) has no token/hash column beyond its own `id`; `authService.validateSession()` looks sessions up directly by the value taken from the signed cookie. The signed cookie mitigates casual tampering, but a raw database read (backup leak, SQL injection elsewhere, insider access) yields directly usable session identifiers with no hashing step in between.
**Recommended Fix (high-level):** Store a hash (e.g. SHA-256) of the session token server-side and look sessions up by that hash, so a database-only compromise doesn't equal instant session takeover — standard defense-in-depth for session stores.

### Issue #10 — `.env.example` files are inconsistent and under-document required variables
**Category:** Documentation Drift / Configuration Bug
**Severity:** Medium

Root `.env.example` and `backend/.env.example` don't agree with each other (`CORS_ORIGIN` and `APP_BASE_URL` only appear in one of the two; neither lists `GEMINI_API_KEY`, `FACEBOOK_APP_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`, or `ENCRYPTION_SALT` at all). Given the audit brief's explicit standard — "every environment variable must be Required, Documented, Used, Correct" — this fails on documentation for five to seven variables the app actually depends on.
**Recommended Fix (high-level):** Consolidate to one authoritative `.env.example` (or keep both in lockstep deliberately) listing every variable referenced by `env.ts` and by the publishing/AI providers directly via `process.env`.

### Issue #11 — Facebook/Instagram/YouTube API version pinning has an unverified currency risk
**Category:** Integration Bug (potential)
**Severity:** Medium

`facebook.provider.ts`/`instagram.provider.ts` call `graph.facebook.com/v19.0/...`. I did not independently re-verify the current Graph API version's support window for this audit (unlike Gemini, where I confirmed a hard 404), but Meta rotates supported Graph API versions on a roughly annual cadence and v19 predates mid-2026. Recommend a targeted check against Meta's current Graph API version-support page before shipping.
**Recommended Fix (high-level):** Move the API version string into `SystemConfiguration` or an env var rather than a literal in the provider, so a version bump doesn't require a code change, and verify current support status before go-live.

---

## Low Priority Issues

### Issue #12 — `PublishingRecord.platform` duplicates data already reachable via `platformConnection.platform`
**Category:** Maintainability Issue
**Severity:** Low
The schema comment literally flags this as a "Milestone 7 Addition" with a `@default(YouTube)` — a default on a field that should probably be derived, not stored with an arbitrary default. Low risk today, but a `@default(YouTube)` on a Platform enum column is a latent data-integrity smell: any insert path that forgets to set it explicitly will silently mislabel a Facebook or Instagram publish as YouTube.
**Recommended Fix (high-level):** Either drop the default and make the field required with no default, or backfill it from the joined `PlatformConnection.platform` and treat this column as denormalized cache with an explicit invariant check.

### Issue #13 — Package manifest pins to bleeding-edge major versions with no visible lockstep verification
**Category:** Maintainability Issue
**Severity:** Low
`backend/package.json` pins `typescript: ^6.0.3`, `@types/node: ^26.1.1`, `prisma: ^7.8.0` — all very new major versions relative to this stack's historical cadence. I did not attempt a full `npm install`/build in this audit to confirm these versions actually resolve and compile together; given the caret ranges, a fresh `npm install` today could legitimately pull different patch versions than whatever the developer's `package-lock.json` last locked. Confirm `npm ci && npm run build` succeeds in a clean container before deploying, and pin this into CI so it isn't reverified only by hand.

---

## Positive Findings (things that are genuinely well done — credit where due)

- **The Content Profile / Prompt Version / Template Version pinning discipline is real.** `ContentProfile` references `promptVersionId` and `templateVersionId` directly (not "latest"), matching the frozen decision in Sections 12.1/13.1 exactly.
- **The duplicate-detection regeneration loop is implemented faithfully to spec**, including the retry-limit lookup from `SystemConfiguration` and the exact "mark Failed at validation stage on exhaustion" behavior described in Section 6.2. This was the part of the pipeline I was most worried about going in, and it's solid.
- **Zod validation-then-replace (`req.body = schema.parseAsync(...)`)** in `request-validator.ts` is the correct pattern — it closes the mass-assignment risk that the `...req.body` spreads in several controllers would otherwise represent.
- **No stray `TODO`/`FIXME`/`HACK` comments anywhere in the codebase** — a genuinely clean sweep on that front, and AGENTS.md's "never leave TODOs" rule was actually followed.
- **Domain Events / Job failure attribution (Stage, Reason, RetryCount, Timestamp) is wired through correctly** in `content-pipeline.service.ts`'s catch block — no silent failure, consistent with Section 33 Principle 6.
- **Helmet, scoped CORS, and a dedicated stricter rate limiter on `/auth/login`** are all present in `app.ts` and correctly configured for a single-operator system.

---

## Deployment Checklist

- [ ] Fix Issue #1 — forward `ENCRYPTION_SALT` (and generally reconcile every var `env.ts` can require against both compose files).
- [ ] Fix Issue #2 — replace the Gemini model ID with a currently-supported one and verify a live call succeeds.
- [ ] Fix Issue #5/#6 — add `FACEBOOK_APP_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `GEMINI_API_KEY` to `envSchema` with production fail-fast checks; remove dummy fallbacks.
- [ ] Run `docker compose -f docker-compose.prod.yml --env-file .env config` and confirm every consumed env var resolves to a real (non-empty, non-default) value.
- [ ] Confirm `npm ci && npm run build` succeeds in a clean container for both `backend` and `frontend`.
- [ ] Decide and implement Issue #3 (OAuth) before allowing any real operator to connect a real Facebook/Instagram/YouTube account — the manual-token workflow is not a supported integration path with these providers long-term.

## Security Checklist

- [x] Helmet applied globally
- [x] CORS restricted to configured origin
- [x] Rate limiting on login + global API
- [x] Session cookie signed, httpOnly, secure-in-prod, sameSite=lax
- [x] Passwords hashed with bcrypt
- [x] Request bodies validated via Zod before reaching controllers
- [ ] Session tokens hashed at rest (Issue #9)
- [ ] Repository-layer tenant isolation on single-record lookups (Issue #7)
- [ ] OAuth client secrets required, not defaulted (Issue #5)

## Platform Integration Checklist

- [ ] OAuth authorization flow (Issue #3)
- [ ] External account identifier + display name on `PlatformConnection` (Issue #4)
- [ ] Verified current Graph API version support (Issue #11)
- [x] Per-platform adapter validation/limits behind a common interface (`publishing.interface.ts`) — architecture is correct even though the OAuth front-door is missing
- [x] Retry/backoff pattern present on the AI provider call

## Configuration Checklist

- [ ] `ENCRYPTION_SALT` documented and forwarded (Issue #1)
- [ ] `GEMINI_API_KEY`, `FACEBOOK_APP_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET` added to schema + `.env.example` (Issues #5, #6, #10)
- [x] `SESSION_SECRET`/`ENCRYPTION_KEY` length-validated
- [x] Production-only fail-fast pattern exists (just needs to be applied consistently)

## Missing Tests (based on what I saw in `backend/src/tests`, not exhaustively enumerated)

- No test observed that exercises the "retry after Publishing failure" path (would have caught Issue #8).
- No test observed that asserts a live/mocked call to the configured Gemini model ID succeeds (would have caught Issue #2 before it ever reached this audit).
- No test observed for cross-workspace access denial on any repository `getById` (would have caught Issue #7).

---

## Final Production Verdict

### Can this repository be deployed to production today?

**NO.**

**Blocking reasons:**
1. The production Docker Compose configuration, as shipped, will crash both the API and worker containers on boot because a required environment variable (`ENCRYPTION_SALT`) is never forwarded into the containers (Issue #1).
2. Even if that's patched, the AI generation stage — the first real step of the only Job Type this system has — calls a Gemini model that Google has already fully shut down; every Content Pipeline Job will fail (Issue #2).
3. Even if both of those are patched, there is no way for an operator to actually connect a real Facebook Page, Instagram Business Account, or YouTube Channel through the product itself — the OAuth flow the PRD requires doesn't exist, tokens must be sourced and pasted in manually, and the schema can't even distinguish two Pages/Channels from each other if you did (Issues #3 and #4).

Fix, in order: #1 → #2 → #6/#5 → #3 → #4 → #7 (before any second workspace exists) → #8.