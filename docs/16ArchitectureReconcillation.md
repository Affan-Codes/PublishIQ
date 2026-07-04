# Document 16 — Architecture Reconciliation & Final Implementation Decisions

**Document Status:** FINAL — Highest Precedence
**Version:** 1.0
**Supersedes:** Any conflicting statement in Documents 01–15
**Owner:** Founding Engineering Team

---

# 1. Executive Summary

Documents 01–15 defined a complete architecture but were produced sequentially, one concern at a time. That process caught many issues within each document's own scope but — as flagged repeatedly across Documents 09 through 15 — reliably missed cross-document contradictions, because no single document was ever responsible for checking the whole set against itself. This document is that check, performed once, under instruction, rather than continuing to be deferred.

**Precedence rule:** if anything in this document conflicts with Documents 01–15, this document governs. Documents 01–15 remain valid for everything this document does not touch. This document does not repeat prior content and does not redesign anything not listed as a finding or amendment below.

Two additional constraints, imposed for this document specifically and binding going forward: the repository is `docs/`, `backend/`, `frontend/` as **fully separate applications** — no monorepo tooling, no shared package. This reverses Document 07 FE-AD-3 and is resolved in §12 (ADR-16-01).

---

# 2. Validation of Codex Findings

| # | Finding | Verdict | Reasoning |
|---|---|---|---|
| 1 | Folder structure is undefined | **Valid** | Correct and expected — Documents 01–15 deliberately deferred literal folder structure per this project's own original constraint ("do not generate folder structures unless specifically required"). No document ever defined it; §3 resolves it now that it's explicitly required. |
| 2 | ContentItem lifecycle is inconsistent because asynchronous generation returns a generated entity before generation completes | **Valid** | Confirmed. Document 06 §6.1 states `POST /content-items` "returns immediately with the created item in `generated` state" — before the async generation job has run. But Document 05 §5.6 defines `generated` as the state reached once `raw_ai_output` is persisted. The same state value is used to mean two different things at two different times. This is a genuine bug in the prior spec, not a misreading by Codex. Resolved in §4. |
| 3 | `owner_id` strategy is inconsistent | **Valid** | Confirmed. Document 05 §4 states "every tenant-scoped entity carries an `owner_id` field," but §5.7 (`MediaAsset`), §5.8 (`ContentStateEvent`), §5.9 (`PublishingJob`), §5.10 (`PublishAttempt`), and §5.4 (`PromptTemplate`) do not include one. The stated rule and the actual schema disagree with each other within the same document. Resolved in §5. |
| 4 | Platform enum conflicts with future extensibility | **Partially Valid** | The enum functions correctly today and Document 04's adapter pattern already isolates platform-specific *logic*. But a native Postgres enum requires a schema migration (`ALTER TYPE`) to add a value, which is a real, if minor, friction against the repeatedly-stated goal ("adding a platform is a configuration exercise, not a rewrite," Document 01). It's not broken, but it's not fully consistent with the goal either — Codex's framing overstates the severity but correctly identifies a real tension. Resolved in §6. |
| 5 | Database/API amendments from later documents were never merged into canonical specifications | **Valid** | Confirmed and already flagged repeatedly in this project's own review commentary since Document 10. `ContentEmbedding`, `correlation_id`, `SecurityEvent`, `pgvector`, video rendering, and the dashboard summary endpoint all exist only in the documents that introduced them. Resolved in §7 and §8. |
| 6 | Onboarding cannot currently be implemented because API endpoints are missing | **Valid** | Confirmed. Document 06's auth section only defines login/logout/session — it assumes the single `Owner` row already exists. No document ever defined how that row is created on a brand-new install. Document 09's onboarding checklist also assumes default content types/templates are "pre-seeded" (UI-AD-2) with no endpoint or mechanism specified to actually seed them. Resolved in §8 and §9. |
| 7 | Multi-platform publishing creates ambiguous ContentItem state | **Valid** | Confirmed, and this is the most significant finding on this list. Document 05 §5.6 defines `ContentItem.state` as a single enum including `published`/`verified`/`failed`, while §5.9 correctly models one `PublishingJob` per platform. If Facebook succeeds and Instagram fails, `ContentItem.state` cannot honestly hold one value representing both outcomes. This is a real design flaw that survived five prior "critical review" passes undetected. Resolved in §4 and §10. |
| 8 | Operational technology choices remain unspecified | **Partially Valid** | Some choices were already made explicitly (Vitest for testing — Document 03 §5.1; Prisma/PostgreSQL — Document 03 TR-3; BullMQ/Redis — Document 01, Document 04). Others genuinely were left unspecified: password hashing algorithm, session storage mechanism, concrete media/video rendering libraries, specific secret-manager mechanics. Codex's finding is correct for the unspecified subset, overstated for the subset already decided. Resolved in §11. |

---

# 3. Repository Structure

Per this document's binding constraint: two fully independent applications, no shared package, no monorepo tooling.

```
/
  docs/                          — Documents 01–16
  backend/
    package.json, tsconfig.json, .eslintrc — independent, backend-only
    prisma/
      schema.prisma               — canonical DB schema (§7)
      migrations/
    src/
      modules/                    — one directory per Document 04 §5.2 module
        content/
          domain/                 — entities, state machine rules (§4), no framework code
          application/            — use cases, depends on domain + interfaces only
          infrastructure/         — Prisma repositories, external calls; implements application interfaces
          interface/               — Express route handlers for this module
        ai-generation/
        media/
        publishing/
        storage/
        scheduling/
        platform-accounts/
        observability/
      shared/                     — BACKEND-INTERNAL ONLY, never imported by frontend
        errors/                   — AppError class, error registry (Document 15 §5)
        config/                   — Zod-validated environment config (§11)
        logging/
      api/                        — Express app assembly, middleware (auth, CSRF, rate limiting), route registration
      workers/                    — BullMQ processor entrypoints, one per queue (Document 04 §6.1)
      bootstrap/                  — owner creation, default-seeding logic (§9)
    tests/                        — colocated per Document 15 §11; this top-level folder is empty by convention, present only for cross-module integration tests
  frontend/
    package.json, tsconfig.json, .eslintrc — independent, frontend-only
    src/
      features/                   — one directory per Document 07 §4 feature (Document 02 §4's 12 sections)
        dashboard/
        content-library/
        publishing-queue/
        publishing-history/
        templates/
        platform-management/
        ai-prompt-management/
        logs/
        scheduler/
        settings/
      shared/                     — FRONTEND-INTERNAL ONLY
        ui/                       — shadcn/ui wrappers, design tokens (Document 08)
        api-client/               — typed fetch wrapper; request/response types are hand-maintained here, not imported from backend, and checked for drift via contract tests (§12 ADR-16-01) against the backend's generated OpenAPI spec (§11)
        state/                    — Zustand store definitions (Document 07 §5.2)
      routes/                     — route definitions (Document 07 §8)
```

**Major directory rationale:**
- **`modules/*/domain|application|infrastructure|interface`** — directly implements Document 04 §5.1's layered architecture and Document 15 §4's boundary-lint enforcement; the folder structure and the lint rule are the same boundary expressed two ways, which is the point — a violation is both a lint error and visibly "wrong" in the directory the file sits in.
- **`backend/src/shared`** vs **`frontend/src/shared`** — same name, deliberately not shared *code*, since no package can cross the application boundary under this document's constraint. Each is scoped entirely to its own application.
- **`api-client`** — replaces the removed shared schema package's role on the frontend side; its types are the frontend's own responsibility to keep correct, verified by contract tests rather than guaranteed by the compiler across a shared import.

---

# 4. Canonical State Machine

This supersedes Document 02 §6 and the `ContentItem.state` portion of Document 05 §5.6.

### 4.1 Resolution of Finding #2 (Async Generation)

A new initial state, `pending`, is added **before** `generated`. `POST /api/v1/content-items` returns the item in `pending` state immediately (the record exists, the job is enqueued). The generation worker transitions it to `generated` only once `raw_ai_output` is actually persisted (Document 01 FR-5) — restoring `generated`'s original, correct meaning from Document 05 §5.6, which Document 06 §6.1 had silently broken.

### 4.2 Resolution of Finding #7 (Multi-Platform Ambiguity)

`ContentItem.state` **no longer encodes per-platform publish outcome.** Its terminal states are redefined:

| State | Meaning |
|---|---|
| `pending` | Record created, generation queued (new — §4.1) |
| `generated` | AI output persisted |
| `validating` | In progress |
| `validated` | Passed validation (Document 01 FR-2, Document 11 §5–6) |
| `pending_approval` | Awaiting human review (Document 01 OQ-1, Document 11 AI-AD-3) |
| `approved` | Cleared for publishing |
| `rejected` | **Terminal** — did not clear approval |
| `queued` | Hand-off point — one `PublishingJob` created per currently-enabled, connected platform (§10) |
| `completed` | **Terminal** — every child `PublishingJob` has reached a terminal status, **regardless of whether any individual platform succeeded or failed** |
| `failed` | **Terminal** — reserved exclusively for failures *before* `queued` (generation/validation/media failures that exhausted retries per Document 03 §5.5) |
| `discarded` | **Terminal** — manual discard, any pre-`queued` state |

**`completed` means "the pipeline finished running," not "it succeeded."** Per-platform success/failure lives exclusively on `PublishingJob.current_status` (Document 05 §5.9) — this was actually correct in Document 05's original design; the bug was `ContentItem.state` trying to also describe the same thing at a coarser grain. It no longer does.

**Allowed transitions:** `pending → generated → validating → validated → [pending_approval → approved | rejected] → queued → completed`, with `failed` reachable from any state before `queued`, `discarded` reachable from any state before `queued`, and retry (Document 06 §6.1.1) re-entering the pipeline at the failed stage rather than restarting.

---

# 5. Canonical Tenant Ownership

Resolves Finding #3. Two categories, replacing the previously-inconsistent blanket rule:

**Direct `owner_id` (root entities — independently queried/listed by owner):** `Owner`, `PlatformAccount`, `ContentType`, `Template` (Content Template), `PromptTemplate` (**amendment — Document 05 §5.4 was missing this field**), `AIProviderConfig`, `ContentItem`, `ScheduleConfig`, `Settings`, `SecurityEvent` (Document 13 §9 — carries `owner_id` directly since security events are account-level, not always reachable via a content join).

**Inherited scope (child entities — always accessed through a parent, never independently listed):** `MediaAsset` (via `ContentItem`), `ContentStateEvent` (via `ContentItem`), `PublishingJob` (via `ContentItem`), `PublishAttempt` (via `PublishingJob` → `ContentItem`), `ContentEmbedding` (via `ContentItem`, Document 11 §5.2). These do **not** carry a redundant `owner_id` column.

**Canonical rule, binding for all future entities:** an entity gets direct `owner_id` if and only if it is ever queried as a list filtered by owner without necessarily joining through a parent first. Everything else inherits scope via its foreign key chain.

**Enforcement (amends Document 05 §12's flagged risk from a suggestion to a requirement):** every repository in `backend/src/modules/*/infrastructure` extends a base repository class that automatically injects the `owner_id` filter (directly, or via a join to the root entity for inherited-scope tables) — this is not optional per-query discipline, it is structural, matching Document 15 §4's "enforced by tooling, not memory" standard applied to this specific risk.

---

# 6. Platform Registry Architecture

Resolves Finding #4. **Decision: platforms become a database entity (`Platform`), replacing the native enum.**

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `key` | String, unique | e.g., `facebook`, `instagram`, `youtube_shorts` — matches Document 04 §5.3's adapter registry key exactly |
| `display_name` | String | |
| `adapter_identifier` | String | Which `PlatformPublisher` implementation handles this platform (Document 04 §5.3) |
| `requires_video` | Boolean | Structural home for the fact Document 12 §4 established informally — YouTube needs video, Facebook/Instagram don't — now queryable rather than hardcoded conditional logic scattered across the Media module |
| `active` | Boolean | Allows disabling a platform type entirely without deleting it |
| `created_at` | Timestamp | |

`PlatformAccount.platform` (Document 05 §5.2) becomes a foreign key to `Platform.id`, not an enum value.

**Why this resolves the extensibility tension:** adding a new platform becomes a single `INSERT` (seeded via migration when the team ships adapter support for it — not owner-editable, since platform *types* are an architecture-level concept, only platform *accounts* are owner data), with zero schema migration for the enum itself. This also brings `Platform` in line with a pattern the schema already used correctly elsewhere: `ContentType` (Document 05 §5.3) was already a table, not an enum, for exactly this reason — this decision simply makes `Platform` consistent with a precedent the original schema had already set for itself.

---

# 7. Canonical Database Amendments

Every schema change introduced in Documents 10–15, merged here as the authoritative addition to Document 05:

| Entity/Field | Introduced In | Change |
|---|---|---|
| `ContentEmbedding` (new table) | Document 11 §5.2 | Per-content-item embedding vector for duplicate detection |
| `pgvector` extension | Document 11 §5.2 | Required Postgres extension, not a new service |
| `ContentItem.correlation_id` | Document 14 §5.2 | New field, generated at creation, threaded through all pipeline logging |
| `SecurityEvent` (new table) | Document 13 §9 | Account-security audit trail, direct `owner_id` per §5 |
| `MediaAsset.rendered_video_reference` | Document 12 §4.2 | New nullable field — storage reference for the YouTube-targeted video variant, populated only when a platform with `requires_video: true` (§6) is targeted |
| `ContentItem.state` enum revision | This document §4 | Adds `pending`; redefines `completed`/`failed` semantics |
| `PromptTemplate.owner_id` | This document §5 | Missing field added |
| `Platform` (new table, replaces enum) | This document §6 | `PlatformAccount.platform` becomes FK |

No other schema changes are introduced by this document. All other entities from Document 05 remain unchanged.

---

# 8. Canonical API Amendments

Every API change introduced in Documents 10–15, plus the new endpoints required to resolve Finding #6, merged here as the authoritative addition to Document 06:

| Endpoint | Introduced In / Resolves | Notes |
|---|---|---|
| `GET /api/v1/dashboard/summary` | Document 10 §4.2 | Aggregate dashboard payload |
| `GET /api/v1/platforms` | This document §6 | Lists available platform *types* from the registry (distinct from `GET /platform-accounts`, which lists connected accounts) — required now that platforms are data, not a hardcoded enum the frontend already "knows" |
| `POST /api/v1/bootstrap/owner` | This document §9 (resolves Finding #6) | Creates the single `Owner` row. Gated by a deploy-time `SETUP_TOKEN` (§9, §11). Returns `403` unconditionally once any `Owner` row exists — self-disabling, not just access-controlled |
| `POST /api/v1/bootstrap/seed-defaults` | This document §9 (resolves Finding #6) | Idempotent — creates default `ContentType`, `PromptTemplate`, `Template` rows (Document 09 UI-AD-2) only if they don't already exist |
| Auth endpoints (existing, amended) | Document 13 §4.2, §6, §7 | Login response now issues a CSRF token; login endpoint is rate-limited (§6); OAuth callback validates `state` (§7) |
| All state-mutating endpoints (existing, amended) | Document 13 §4.2 | Require `Idempotency-Key` (unchanged, Document 06 §5.4) **and** a valid CSRF header — this was always intended per Document 13 but is restated here as a binding amendment to Document 06's contract, not just a principle in Document 13 |

---

# 9. Installation & Bootstrap Flow

Resolves Finding #6 completely, end to end:

1. **Deploy.** Migrations run, including the `Platform` registry seed (facebook/instagram/youtube_shorts rows, §6) and the `pgvector` extension (§7). A `SETUP_TOKEN` is generated and stored in the secret manager (Document 03 §5.2) at this stage — this is a one-time credential, not the owner's password.
2. **Owner creation.** With zero `Owner` rows in the database, `POST /api/v1/bootstrap/owner` (§8) is called — either manually via a CLI/setup script or a one-time setup page — supplying the `SETUP_TOKEN`, owner email, and password. Password is hashed per §11. The endpoint is permanently disabled (`403`) the instant an `Owner` row exists.
3. **Authentication initialization.** Owner logs in via the standard login flow (Document 06 §4), receiving a session cookie and CSRF token (Document 13 §4.2).
4. **Default seeding.** On first successful login (or via an explicit dashboard action, either is acceptable — recommend automatic to match Document 09 UI-AD-2's "reduce friction" intent), `POST /api/v1/bootstrap/seed-defaults` (§8) runs, creating the default Shayari/quotes `ContentType`s, their `PromptTemplate`s, and starter `Template`s.
5. **Onboarding checklist begins** (Document 09 §4.2), now fully implementable: steps 3–5 (content type/prompt/template) are already satisfied by step 4 above; the owner's remaining real work is steps 1, 2, and 6.
6. **Platform connection.** Owner connects at least one `PlatformAccount` via OAuth (Document 06 §6.5, Document 13 §7's `state`-validated flow).
7. **AI provider setup.** Owner configures `AIProviderConfig` with a real API key and cost ceiling (Document 03 §5.4, Document 11 §7).
8. **Schedule creation.** Owner configures a `ScheduleConfig` or explicitly opts into manual-only operation (Document 09 §4.2 step 6).
9. **Initial settings.** Approval gate toggle, retention policy, and timezone (Document 10 OQ-22) are confirmed or left at sensible defaults — defaults exist for all of these, so this step is optional, not blocking.

The system is fully operational once steps 6–8 are complete; step 9 has defaults and never blocks operation.

---

# 10. Multi-Platform Publishing Rules

Formalizes §4.2's resolution as the canonical publishing model:

- **Model:** one `ContentItem` → N `PublishingJob`s (Document 05 §5.9, unchanged) — one job per platform the content is published to.
- **Job creation trigger:** at the `queued` transition, one `PublishingJob` is created for every `PlatformAccount` that is currently both `connected` and `enabled` (Document 05 §5.2) at that exact moment. Enabling/disabling a platform afterward does not retroactively affect already-created jobs for that `ContentItem` — consistent with the "in-flight work completes" precedent already established for the Dashboard's Pause control (Document 10 §6.2).
- **Ownership of publishing state:** `PublishingJob.current_status` and its `PublishAttempt` lineage (Document 05 §5.10) are the **sole** source of truth for per-platform outcome. `ContentItem.state` never re-derives or duplicates this information (§4.2).
- **Partial success resolution:** the `ContentItem` detail API response (Document 06 §6.1) includes a **computed, non-persisted** `publishing_summary` object: `{ total, succeeded, failed, pending }`, derived live from the item's `PublishingJob`s at read time. This is deliberately not stored as a denormalized field — recomputing it on read avoids any possibility of it drifting out of sync with the actual child job states, which a cached/stored version would risk.
- **UI consequence (amends Document 09 §6.2):** the Pipeline Stage Timeline (Document 08 §7) shows the content-level pipeline up to `queued`/`completed`; per-platform outcome is shown as a separate, explicit multi-platform status row beneath it — not folded into the single timeline, since the timeline's visual model (one line, sequential stages) cannot honestly represent three platforms independently succeeding and failing at the same pipeline stage.

---

# 11. Final Operational Decisions

| Concern | Decision | Rationale |
|---|---|---|
| Password hashing | **argon2id** | Current best-practice recommendation for password hashing, well-supported in Node; chosen over bcrypt given no legacy-compatibility constraint exists for a greenfield v1 |
| Session management | `express-session`, signed `httpOnly`, `Secure`, `SameSite=Strict` cookie (Document 13 §4.2, §6) | Matches the already-decided auth model exactly; no new decision needed beyond the concrete library |
| Session storage | **Redis-backed session store** | Redis is already a required dependency (BullMQ, Document 01/04) — reusing it for sessions avoids adding a second storage mechanism (e.g., a Postgres session table) for the same operational need |
| Secret management | Platform-native secret manager (Document 03 §5.2, restated as final) | No change — already decided, restated here only because Finding #8 named it among unspecified items; it was not actually unspecified |
| Encryption | **AES-256-GCM**, envelope encryption, DEK in secret manager (Document 13 §5.2) | Authenticated encryption (GCM) over a non-authenticated mode — protects against tampering, not just disclosure |
| Logging backend | **Structured JSON to stdout**, shipped via the hosting platform's native log aggregation | No dedicated logging stack (e.g., self-hosted ELK/Loki) for v1 — same reasoning as Document 14 §8's "no dedicated metrics stack" decision, applied consistently here rather than left as a separate, differently-reasoned choice |
| Monitoring | Bull Board + Dashboard System Health widget + `/health` endpoint (Document 14 §8, restated as final) | No change — already decided |
| Alerting | Any Node-compatible transactional email API, configured via environment/secret manager | Deliberately not naming a specific vendor — this is an interchangeable operational detail, not an architectural one, and over-specifying it would be a false precision this document should avoid |
| Health checks | `/health` checks: Postgres connectivity, Redis connectivity, BullMQ worker heartbeat (Document 03 §5.6, concrete check list finalized) | Matches Document 10 §4.2's System Health widget's actual data needs exactly |
| Media renderer | **`sharp`** | Node-native, fast, well-supported image compositing library for Content Template rendering (Document 02 §4.5, Document 08) |
| Video renderer | **`fluent-ffmpeg`** wrapping system `ffmpeg` | Standard, well-supported choice for the YouTube Shorts static-to-video rendering requirement (Document 12 §4.2) |
| Configuration validation | **Zod-validated environment config, fail-fast at boot** | Consistent with this project's Zod-first philosophy (Document 07 §7's original intent, now applied without needing the removed shared package — Zod is still used independently in both applications) |
| API documentation | **OpenAPI spec generated from backend Zod schemas** (e.g., `zod-to-openapi`) | This is also the mechanism that compensates for ADR-16-01's removal of the shared type package — the backend's generated spec becomes the canonical contract the frontend's hand-maintained types are checked against via contract tests |
| Testing framework | **Vitest** (Document 03 §5.1, restated as final) | No change — already decided |

---

# 12. Architecture Decision Records

### ADR-16-01: Remove Shared Package; Use Contract Tests + Generated OpenAPI Spec
**Decision:** Reverse Document 07 FE-AD-3. Frontend and backend are fully independent applications with no shared code package.
**Reasoning:** Imposed as a binding constraint for this reconciliation. The original shared-package decision existed to prevent schema drift; that need doesn't disappear, so it's addressed differently — the backend generates an OpenAPI spec from its own Zod schemas (§11), and Document 03 §5.1's already-required contract tests verify the frontend's independently-maintained types against that spec.
**Consequences:** Real loss of compile-time cross-application type safety — a backend schema change no longer breaks a frontend build automatically; it's only caught at contract-test time (CI), not at compile time. This is a genuine trade-down, accepted only because it was an explicit external constraint, not a preference.

### ADR-16-02: Add `pending` State; Redefine `generated` Semantics
**Decision:** Insert `pending` before `generated` in `ContentItem.state` (§4.1).
**Reasoning:** Resolves Finding #2 — restores `generated`'s original correct meaning (AI output actually persisted) which Document 06's async-return behavior had silently contradicted.
**Consequences:** Frontend state-to-action lookup (Document 07 §6) needs one new state added to its mapping; no action buttons are valid in `pending`, matching its "nothing to act on yet" nature.

### ADR-16-03: `ContentItem.state` No Longer Encodes Per-Platform Publish Outcome
**Decision:** `completed` means pipeline-finished, not "succeeded"; per-platform outcome lives exclusively on `PublishingJob` (§4.2, §10).
**Reasoning:** Resolves Finding #7, the most significant defect found in this reconciliation — the original single-state design could not honestly represent partial multi-platform success.
**Consequences:** Any UI or logic that previously assumed `ContentItem.state` could equal `published`/`verified`/`failed` must be updated to read `PublishingJob` state instead (Document 09 §6.2 amended in §10 above).

### ADR-16-04: Canonical Direct-vs-Inherited `owner_id` Rule
**Decision:** Explicit two-category list (§5) replaces Document 05 §4's unenforced blanket statement.
**Reasoning:** Resolves Finding #3; removes ambiguity that had already caused the original schema to be internally inconsistent with its own stated rule.
**Consequences:** `PromptTemplate` gains a column it was missing (§7); repository base-class enforcement (§5) becomes a required implementation task, not optional discipline.

### ADR-16-05: Platform Enum → Platform Registry Table
**Decision:** `Platform` becomes a table; `PlatformAccount.platform` becomes a foreign key (§6).
**Reasoning:** Resolves Finding #4's real, if minor, tension between enum-based platforms and the project's repeated zero-migration extensibility goal; brings `Platform` in line with `ContentType`'s existing precedent.
**Consequences:** One additional join for any query needing a platform's display name; negligible cost given this system's scale (Document 01 A4).

### ADR-16-06: Setup-Token-Gated, Self-Disabling Owner Bootstrap Endpoint
**Decision:** `POST /api/v1/bootstrap/owner` (§8, §9), gated by a deploy-time token, permanently disabled once any `Owner` exists.
**Reasoning:** Resolves Finding #6 — no prior document defined how the single-owner system's first account is created at all.
**Consequences:** Deployment process (Document 03 §5.2) gains one new required step (generating and injecting `SETUP_TOKEN`); this must be documented in deployment runbooks, not just this architecture document.

### ADR-16-07: Concrete Operational Technology Selections
**Decision:** argon2id, Redis-backed sessions, AES-256-GCM, sharp, fluent-ffmpeg, Zod-validated config, generated OpenAPI docs (§11, full list).
**Reasoning:** Resolves the genuinely-unspecified subset of Finding #8; each choice deliberately reuses existing infrastructure (Redis, Zod) over introducing new dependencies, consistent with this project's repeated preference for minimal viable mechanisms throughout Documents 01–15.
**Consequences:** These are now binding technology choices — deviating from them in implementation requires a documented reason, the same standard this project has applied to every other architectural decision.

---

**This document is implementation-ready. No further architectural clarification is required before implementation begins.**

**End of Document 16 — Architecture Reconciliation & Final Implementation Decisions**