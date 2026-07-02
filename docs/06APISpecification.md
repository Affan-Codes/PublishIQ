# Document 06: API Specification
## AI-Powered Content Automation Platform

**Document Status:** Approved for Implementation Planning
**Version:** 1.0
**Depends On:** Document 01–05
**Owner:** Founding Engineering Team

---

## 1. Executive Summary

This document specifies the internal REST API (`/api/v1/...`, per Document 01 §3.3) that the dashboard frontend uses to interact with the backend. It defines resource shapes, endpoints, authentication, error handling, and — critically — how state transitions are exposed without letting the client bypass the state machine that Documents 02 and 05 spent real effort defining correctly.

This is the internal contract only. It is designed to be exposable as a public API later (Document 01 non-goal, structurally prepared for) without a breaking redesign, per the versioning and resource-oriented conventions below.

---

## 2. Objectives

| # | Objective |
|---|-----------|
| APIO-1 | Expose every dashboard capability from Document 02 as a well-defined endpoint |
| APIO-2 | Make state transitions server-validated actions, never client-settable fields |
| APIO-3 | Define one consistent error envelope and pagination scheme, used everywhere, no per-endpoint improvisation |
| APIO-4 | Support write-endpoint idempotency so client-side retries can't create duplicate side effects (extends Document 03 TR-4 to the API layer) |
| APIO-5 | Keep the contract stable enough to expose publicly later without breaking existing consumers |

---

## 3. Scope

Covers: authentication, resource endpoints, request/response shapes (described, not literal schema code), error handling, pagination, filtering, idempotency.

Does not cover: literal request/response body syntax (implementation detail), rate-limiting *values* (operational config), UI-to-endpoint wiring (Document 07).

---

## 4. Authentication & Authorization

| Aspect | Design |
|---|---|
| Mechanism | Session-based auth (HTTP-only, secure cookie) — matches Document 02 PA "single-user auth, session-based; no roles, no orgs" |
| Login | `POST /api/v1/auth/login` — credentials in body, returns session cookie |
| Logout | `POST /api/v1/auth/logout` |
| Session check | `GET /api/v1/auth/session` — used by the frontend on load to determine authenticated state |
| Authorization | v1 has exactly one owner, so authorization is binary (authenticated or not) — every resource is implicitly scoped to the authenticated owner's `owner_id` (Document 05 §4) at the Application layer, never trusted from a client-supplied field |

**Why not token-based (JWT) auth?** Session cookies are simpler and sufficient for a single-user, first-party-frontend system with no mobile/third-party API consumers in v1. Token-based auth is a natural addition when the public API (Future Expansion) is built — this decision doesn't block that.

---

## 5. Standard Conventions (Resolves APIO-3 — Missing From All Prior Documents)

### 5.1 Error Envelope

Every error response follows one shape, regardless of endpoint: an error code (machine-readable, stable across versions), a human-readable message, and optional field-level detail for validation errors. HTTP status codes are used correctly (400 for validation, 401 for unauthenticated, 403 for unauthorized, 404 for not found, 409 for state-conflict, 429 for rate-limited, 500 for unexpected) — status code plus error code together let the frontend branch on category while still having a stable machine-readable identifier that doesn't change if the message copy changes.

### 5.2 Pagination

All list endpoints use cursor-based pagination (opaque cursor token, not offset/limit) — chosen over offset pagination because `PublishAttempt` and `ContentStateEvent` (Document 05 §5.8, §5.10) are append-only, growing tables where offset pagination degrades and can skip/duplicate rows under concurrent inserts. Every list response includes the page of results plus a `next_cursor` (null when exhausted).

### 5.3 Filtering & Sorting

List endpoints accept filter query parameters matching the indexed query patterns from Document 05 §7 specifically — filters are not added ad hoc; they exist because Document 05 already indexed for them. Default sort is always by recency (`created_at`/`occurred_at` descending) unless otherwise noted.

### 5.4 Idempotency (Resolves APIO-4)

Every non-idempotent write endpoint (anything that triggers a side effect — enqueuing a job, triggering a publish, connecting a platform) accepts an optional client-supplied `Idempotency-Key` header. The API layer records keys it has processed for a short window (e.g., 24 hours) and returns the original response for a repeated key instead of re-executing the action. This closes the gap between Document 03 TR-4's job-level idempotency and what actually happens if a client's network request is retried before it gets a response.

---

## 6. Resource Endpoints

### 6.1 Content Items (Document 02 §4.2)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/content-items` | List, filterable by `content_type`, `state`, `platform`; paginated per §5.2 |
| `GET /api/v1/content-items/{id}` | Full detail, including nested `state_history` (from `ContentStateEvent`, Document 05 §5.8) and `media_asset` |
| `POST /api/v1/content-items` | Manual "Generate now" trigger — enqueues a generation job (Document 04 AD-1), returns immediately with the created item in `generated` state, does not block on generation completing |
| `PATCH /api/v1/content-items/{id}` | **Limited to non-state fields only** — `caption`, `hashtags` (Document 02 §4.2 "manual edit before publish"). Attempting to include `state` in this request is rejected with a 400 — state is never client-settable directly. See §6.1.1. |

#### 6.1.1 State Transition Actions (Resolves APIO-2 — The Critical Fix)

Each valid transition in the Document 02 §6 state machine is its own explicit endpoint. The server validates that the requested transition is legal from the item's current state (per Document 05's state enum and Document 04's Domain-layer rules) and rejects illegal transitions with `409 Conflict`, not a silent no-op or a generic validation error:

| Endpoint | Transition |
|---|---|
| `POST /api/v1/content-items/{id}/approve` | `pending_approval → approved` |
| `POST /api/v1/content-items/{id}/reject` | `pending_approval → rejected` |
| `POST /api/v1/content-items/{id}/discard` | Any pre-published state `→ discarded` |
| `POST /api/v1/content-items/{id}/retry` | `failed → ` (re-enters the pipeline stage it failed at, per Document 04 §6.1 — does not restart from `generated`) |

**Why action endpoints instead of a generic transition endpoint like `POST /content-items/{id}/transition { to: "approved" }`?** Because each transition has different authorization/validation rules and different side effects (approve enqueues the next stage; discard does not) — collapsing them into one generic endpoint with a `to` parameter would just move the state-machine-bypass risk from a `PATCH` field into a request body value. Explicit endpoints make illegal or nonsensical requests (e.g., "discard" on an already-`published` item) rejectable by routing/validation before business logic even runs.

### 6.2 Publishing Queue (Document 02 §4.3)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/publishing-jobs` | List, filterable by `status`, `platform`; sorted by `scheduled_for` |
| `POST /api/v1/publishing-jobs/{id}/force-publish` | Skips the remaining delay only (Document 02 OQ-5 resolution) — does **not** bypass the approval gate; returns `409` if the item hasn't been approved when the gate is on |
| `POST /api/v1/publishing-jobs/{id}/cancel` | Pulls the item from queue (Document 02 §4.3) — valid only from `queued` state |
| `PATCH /api/v1/publishing-jobs/{id}/reorder` | Manual queue reorder — accepts a target position; a genuine field update, not a state transition, so `PATCH` is appropriate here unlike §6.1 |

### 6.3 Publishing History (Document 02 §4.4)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/publish-attempts` | List, filterable by date range, `platform`, `content_type`, `outcome` (Document 05 §7 index-backed) |
| `GET /api/v1/publishing-jobs/{id}/attempts` | Full retry lineage for one job (Document 05 §5.10 relationship) |

No `POST`/`PATCH`/`DELETE` on this resource, ever — matches Document 05 §5.10's insert-only, application-enforced immutability. Attempts are created only as a side effect of the publish pipeline (Document 04 §6), never directly via the API.

### 6.4 Templates (Document 02 §4.5)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/templates` | List, filterable by `content_type` |
| `POST /api/v1/templates` | Create |
| `PATCH /api/v1/templates/{id}` | Edit |
| `POST /api/v1/templates/{id}/archive` | Soft-disable (action endpoint, not `DELETE` — templates used by historical content must remain resolvable, per Document 05's "reference, not raw path" design) |
| `POST /api/v1/templates/{id}/preview` | Renders a preview with sample content (Document 02 §4.5) — synchronous, since preview generation is expected to be fast unlike full media generation |

### 6.5 Platform Accounts (Document 02 §4.6)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/platform-accounts` | List with `status` (Document 05 §5.2) |
| `POST /api/v1/platform-accounts/{platform}/connect` | Initiates OAuth flow, returns a redirect URL |
| `GET /api/v1/platform-accounts/{platform}/oauth-callback` | OAuth provider redirect target — not called directly by the frontend |
| `POST /api/v1/platform-accounts/{id}/disconnect` | Revokes and removes stored credentials |
| `PATCH /api/v1/platform-accounts/{id}` | Limited to `enabled` (per-platform publish toggle, Document 02 §4.6) — same non-state-field restriction philosophy as §6.1, though platform accounts have no complex state machine so this is a lighter-weight case |

### 6.6 AI Prompt Management (Document 02 §4.7 — P1)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/prompt-templates` | List, filterable by `content_type` |
| `POST /api/v1/prompt-templates` | Creates a new version (Document 05 §5.4 — never overwrites, always versions) |
| `POST /api/v1/prompt-templates/{id}/activate` | Sets as the active version for its content type |
| `GET /api/v1/prompt-templates/{content_type_id}/history` | Version history |

### 6.7 Logs (Document 02 §4.8)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/logs` | Proxies/queries the external log store (Document 03 §5.6), filterable by `severity`, `correlation_id`, `content_item_id` — **not backed by a Postgres table**, per Document 05 §5.8's Postgres-vs-logs boundary decision; this endpoint exists in the API surface but its implementation reaches into the external log system |

### 6.8 Scheduler (Document 02 §4.9)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/schedule-configs` | List, one per content type |
| `PATCH /api/v1/schedule-configs/{id}` | Update cron expression, publish delay, enabled flag |

### 6.9 Settings (Document 02 §4.10)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/settings` | Returns all key-value settings (Document 05 §5.13) |
| `PATCH /api/v1/settings` | Bulk update — accepts a partial key-value map; validates each key against a known schema server-side (an unrecognized key is rejected, not silently stored) |

### 6.10 Platform & System Health (Document 02 §4.11)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/health/platforms` | Live-checked (not cached) per-platform reachability — explicitly separate from `platform-accounts.status` (which is denormalized/cached per Document 05 §5.2) so the dashboard can distinguish "last known status" from "checked right now" |
| `GET /api/v1/health/system` | Queue depth, worker liveness, DB/Redis connectivity — backed by the `/health` endpoint defined at the infrastructure level (Document 03 §5.6), reshaped for dashboard consumption |

### 6.11 AI Provider Config (Document 03 §5.4)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/ai-providers` | List with current spend vs. ceiling (Document 05 §5.11) |
| `PATCH /api/v1/ai-providers/{id}` | Update cost ceilings, enabled flag — API keys are write-only (accepted on update, never returned in any response body) |

---

## 7. Architecture Decisions

| ID | Decision | Rationale |
|---|---|---|
| API-AD-1 | State transitions are explicit action endpoints, never a generic `state` field on `PATCH` | Prevents the client from bypassing state machine validation — the single most important decision in this document |
| API-AD-2 | Cursor-based pagination everywhere, no offset pagination | Correctness under concurrent inserts into append-only tables (Document 05 §5.8, §5.10) |
| API-AD-3 | Session-cookie auth, not JWT, for v1 | Matches actual v1 requirements (first-party frontend, single user); doesn't block future token-based auth for a public API |
| API-AD-4 | Idempotency-Key header support on write endpoints | Closes the gap between job-level idempotency (Document 03 TR-4) and client-retry-level idempotency — these are different layers and both need the guarantee |
| API-AD-5 | Logs endpoint proxies an external store rather than querying Postgres | Consistent with Document 05's explicit decision not to store verbose logs in the transactional database |

---

## 8. Tradeoffs

| Tradeoff | Gain | Cost | Verdict |
|---|---|---|---|
| Explicit action endpoints (§6.1.1) vs. one generic transition endpoint | Bypass-proof state machine, clear per-transition validation | More endpoints to define and document | Accept — this is a correctness requirement, not a style preference |
| Cursor pagination vs. simpler offset pagination | Correct behavior on growing, concurrently-written tables | Slightly more complex cursor encoding/decoding logic | Accept — offset pagination silently returning duplicate/missing rows on an append-only audit table is a real bug, not a theoretical one |
| Idempotency-Key support vs. relying solely on job-level idempotency | Protects against duplicate side effects from client retries, not just worker retries | Extra header handling and a short-lived key-response cache | Accept — Document 03 TR-4 already established idempotency as a hard requirement; this is a direct extension of that requirement to where client requests actually originate |

---

## 9. Assumptions

- **APA-1:** The dashboard is the only consumer of this API in v1 — no mobile app, no third-party integration — so CORS is configured narrowly (frontend origin only), not permissively.
- **APA-2:** Idempotency key windows of ~24 hours are sufficient given the manual, low-frequency nature of most write actions (Document 01 A4 — low volume).
- **APA-3:** OAuth callback endpoints (§6.5) are publicly reachable (required by the OAuth flow itself) but perform no data access beyond completing the specific in-progress connection flow — not treated as part of the authenticated API surface.

---

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| A future contributor adds a convenience `PATCH /content-items/{id}` field for state "just to save time" | High — silently reintroduces the exact bug this document exists to prevent | Recommend a lint/code-review rule and this document's §6.1.1 rationale cited directly in code comments on the `ContentItem` route handler |
| Idempotency key store grows unbounded without expiry cleanup | Low-Medium | Key records must have a TTL/cleanup job — flagged here as a requirement, implementation detail for Document 03's job scheduling |
| Public API exposure later reveals internal-only assumptions (e.g., single-owner scoping) baked into endpoint behavior | Medium (future) | Versioning (`/api/v1`) and the `owner_id` scoping already being structural (Document 05 §4) means exposing this contract publicly is additive, not corrective — but a dedicated review should happen before that exposure, not assumed safe by default |

---

## 11. Future Expansion

- Public API exposure: same endpoint shapes, add token-based auth (API-AD-3 already anticipates this) and per-token rate limiting
- `PATCH /settings` schema grows as new settings are added — no endpoint redesign needed, just schema validation updates
- Webhook support (platform → system, e.g., Meta webhook for post status changes) as an alternative/supplement to polling-based verification (Document 04 §6.2) — flagged as a genuine future optimization, not required for v1's delayed-job verification approach

---

## 12. Open Questions

| ID | Question | Recommendation |
|---|---|---|
| OQ-14 | Should `force-publish` (§6.2) require re-confirmation if the item's approval status changed between queueing and the force-publish request? | Recommend yes — re-validate approval state at execution time, not just at enqueue time, to close a race-condition window; flag for Document 04 pipeline implementation detail |
| OQ-15 | Should the public API exposure (Future Expansion) reuse `/api/v1` or start at `/api/v2` given the auth model changes (session → token)? | Recommend `/api/v2` — auth mechanism is a breaking change by definition; don't stretch v1's contract to cover a fundamentally different consumer model |

---

## 13. Industry Best Practices Applied

- **Explicit action endpoints for state transitions** — standard REST maturity practice (avoids the well-known anti-pattern of exposing internal state as a freely-settable resource field)
- **Cursor-based pagination for high-write, append-only resources** — standard practice in systems with audit-log-style tables
- **Idempotency keys on mutating endpoints** — standard for any API expected to be called by a client that might retry on timeout
- **Consistent error envelope with stable machine-readable codes** — standard practice that decouples frontend error-handling logic from human-readable message text, which product/copy changes shouldn't be able to break

---

## 14. Production Considerations

- The `/api/v1/content-items/{id}/*` action endpoints must all be covered by the integration test suite (Document 03 §5.1) specifically testing **illegal transition rejection**, not just the happy path — this is the part of the system where a bug has the highest real-world consequence (a bypassed approval gate publishing unreviewed content)
- Rate limiting on the API itself (separate from the AI-provider rate limiting in Document 03 §5.4) should exist even for a single-user system, as a defense-in-depth measure against a compromised session or a runaway frontend bug looping a request

---

## 15. Recommendations

1. Treat API-AD-1 (explicit state-transition endpoints) as non-negotiable during implementation — this is the single highest-leverage correctness decision in this document, protecting work done in Documents 02, 04, and 05.
2. Resolve OQ-14 before Document 08 (Pipeline/Job Orchestration Design, if separately produced) since it affects the force-publish job's execution-time validation logic.
3. This completes the core technical documentation set (01–06). Recommend next either **Document 07: UI/UX Architecture** (translating this API and Document 02's PRD into screen-level design) or a **Non-Functional Requirements & Observability Plan** consolidating Document 03's scattered NFRs into one operational reference — your call on which is more useful next.

---

**End of Document 06 — API Specification**