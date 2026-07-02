# Document 02: Product Requirements Document (PRD)
## AI-Powered Content Automation Platform

**Document Status:** Approved for Architecture Phase
**Version:** 1.0
**Depends On:** Document 01 — Vision & Scope
**Owner:** Founding Engineering Team

---

## 1. Executive Summary

This PRD translates the Vision & Scope into concrete, buildable product requirements: what the single-user dashboard must do, what data must be visible where, what actions the owner can take, and what "done" looks like for each feature area.

Where Document 01 decided *what's in scope*, this document decides *what the product actually does* — feature by feature, screen by screen, state by state. Every feature below is traceable back to a Functional Requirement (FR) in Document 01.

---

## 2. Objectives

| # | Objective | Success Signal |
|---|-----------|-----------------|
| PO-1 | Give the owner a single control center — no need to touch a database or log file to understand system state | Every question ("did it post?", "why did it fail?", "what's queued?") is answerable from the dashboard |
| PO-2 | Make failure states visible and actionable, not just logged | Failed jobs show up with a retry action, not buried in a log file |
| PO-3 | Support the OQ-1 approval-gate toggle from Document 01 without redesigning any screen later | Content list view already has a state model that includes "Pending Approval" even if the toggle is off in v1 |
| PO-4 | Keep the UI honest about system limitations | No feature implies capability the backend doesn't have (e.g., no "schedule for exact time" if only delay-based scheduling exists) |

---

## 3. Scope of This Document

Covers: Dashboard, Content Library, Publishing Queue, Publishing History, Templates, Platform Management, AI Prompt Management, Logs, Scheduler, Settings, Platform Health, System Health.

Does **not** cover: visual design system, component-level UI spec, or API contracts — those belong to the UI/UX Architecture and API Design documents respectively.

---

## 4. Feature Requirements (Prioritized — This Was Missing in the Raw Brief)

The original brief listed dashboard sections as a flat, unordered list. That's not actionable. Below, every feature is tagged **P0 (v1 launch blocker)**, **P1 (v1 nice-to-have)**, or **P2 (post-v1)** — nothing ships without this triage.

### 4.1 Dashboard (Home) — P0

| Requirement | Detail |
|---|---|
| System status summary | At-a-glance: jobs succeeded today, jobs failed today, jobs currently queued, next scheduled generation time |
| Platform health strip | Per-platform (FB/IG/YouTube) status: connected / token expiring soon / token expired / API error |
| Recent activity feed | Last 10 pipeline events (generated, published, failed) with timestamps |
| Quick actions | "Generate now" (manual trigger), "Pause pipeline" |

**Traceability:** FR-12, FR-13

### 4.2 Content Library — P0

| Requirement | Detail |
|---|---|
| List view of all generated content | Filterable by content type, platform, status |
| Status model per content item | `Generated → Validating → Validated → (Pending Approval if gate is on) → Queued → Publishing → Published → Verified` or `...→ Failed` at any stage |
| Content detail view | Shows full AI output, generated media, caption, hashtags, and the complete stage history with timestamps |
| Manual edit before publish | Owner can edit caption/hashtags before a queued item is published (does not require regenerating media) — directly satisfies "no stage should require regenerating previous work" |
| Manual reject/discard | Owner can discard an item at any pre-published stage |

**Traceability:** FR-1 through FR-5, FR-14. **This is where OQ-1's approval gate lives in the UI** — the status model above already includes "Pending Approval" as a first-class state, so turning the gate on later is a config flip, not a UI redesign.

### 4.3 Publishing Queue — P0

| Requirement | Detail |
|---|---|
| List of items queued for publish, per platform | Shows scheduled publish time (generation time + configured delay) |
| Manual reorder / bump | Owner can move an item up in queue or force-publish immediately |
| Cancel from queue | Owner can pull an item before it publishes |

**Traceability:** FR-6, FR-7

### 4.4 Publishing History — P0

**This section was underspecified in the original brief — "maintain complete publishing history" is not a requirement, it's a slogan.** Concretely, history must support debugging a specific failed or successful post six months later without re-running anything:

| Requirement | Detail |
|---|---|
| Immutable record per publish attempt | Platform, content ID, attempt number, timestamp, outcome, platform-returned post ID (if successful), error detail (if failed) |
| Search/filter | By date range, platform, content type, outcome |
| Link to live post | Direct link to the published post on the platform, captured at verification time |
| Retry lineage | If an item was retried, history shows all attempts linked together, not as separate unrelated entries |

**Traceability:** FR-9, FR-10, FR-11

### 4.5 Templates — P0

| Requirement | Detail |
|---|---|
| Branded template management | Create/edit/archive visual templates used for media generation |
| Template-to-content-type mapping | Each content type has one or more eligible templates |
| Preview | Owner can preview a template with sample content before activating it |

**Traceability:** FR-3

### 4.6 Platform Management — P0

| Requirement | Detail |
|---|---|
| Connect/disconnect platform accounts | OAuth flow per platform (Facebook Page, Instagram Business, YouTube channel) |
| Token status visibility | Expiry date, last successful use, manual re-auth trigger |
| Per-platform publishing config | Enable/disable publishing to a specific platform without disconnecting it |

**Traceability:** FR-8, Document 01 Risk "OAuth token expiry causing silent publish failures"

### 4.7 AI Prompt Management — P1

| Requirement | Detail |
|---|---|
| Prompt template CRUD per content type | Owner can edit the underlying generation prompt without a code deploy |
| Provider selection per content type | Choose which AI provider generates a given content type |
| Version history of prompts | Roll back a prompt change that produced bad output |

**Traceability:** FR-1, Document 01 multi-provider requirement. Marked P1, not P0 — v1 can launch with prompts as backend config; a UI for editing them is a fast follow, not a launch blocker.

### 4.8 Logs — P0

| Requirement | Detail |
|---|---|
| Structured, filterable log view | By severity, stage, platform, content ID |
| Correlation | Every log line traceable to a specific job/content item via correlation ID |

**Traceability:** Document 01 Observability NFR

### 4.9 Scheduler — P0

| Requirement | Detail |
|---|---|
| Configure generation schedule | Recurring schedule (e.g., daily at a fixed time) per content type |
| Configure publish delay | Time between validated content and actual publish, per platform |
| Manual override | "Generate now" bypasses schedule without disabling it |

**Traceability:** FR-7, Document 01 OQ-3 (resolved: both scheduled and manual triggers supported)

### 4.10 Settings — P1

| Requirement | Detail |
|---|---|
| Approval gate toggle | On/off switch for OQ-1's human review step |
| Retention policy config | How long to keep archived content/history (Document 01 A-Data Retention) |
| Retry policy config | Max attempts, backoff interval, per stage |

### 4.11 Platform Health & System Health — P0

| Requirement | Detail |
|---|---|
| Platform health | Live check: can we currently authenticate and reach each platform's API? |
| System health | Queue depth, worker status (is the job processor actually running?), Redis connectivity, database connectivity |

**Traceability:** Document 01 Production Considerations — "degrade gracefully if one platform is down"

---

## 5. Non-Functional Requirements (Product-Level)

| Category | Requirement |
|---|---|
| Usability | Owner should never need direct database or log-file access to understand system state or resolve a failure |
| Trust | Every automated action (generation, publish, retry) must be visible and attributable — no silent background magic |
| Responsiveness | Dashboard views load without waiting on live platform API calls where possible (cached health/status, refreshed on interval or manual refresh) |
| Data Integrity | Publishing history is append-only / immutable — never edited or deleted by normal operation, only by explicit retention-policy cleanup |

---

## 6. State Model (Cross-Cutting — Missing From Original Brief)

The raw brief's workflow diagram was linear and didn't define failure or approval states. The actual state model every content item moves through:

```
Generated → Validating → Validated
   → [IF approval gate ON] → Pending Approval → Approved/Rejected
   → Queued → Publishing → Published → Verified → Archived

At any stage prior to "Verified": → Failed → (Retry → back to same stage) or (Discarded)
```

This state model is what Document 04 (Pipeline/Job Orchestration Design) will implement as an actual state machine. Flagging it here because a PRD that doesn't define failure and approval states isn't complete — it only describes the happy path.

---

## 7. Architecture Decisions (Product-Level)

| Decision | Choice | Rationale |
|---|---|---|
| Approval gate is UI-supported regardless of v1 toggle default | Build "Pending Approval" as a real state now | Cheaper to build once than retrofit a new state into an existing list/detail view later |
| History is immutable/append-only | No update/delete on history records via normal flow | Matches Document 01 Data Integrity NFR; prevents debugging data from silently disappearing |
| Platform/System Health use cached + on-demand refresh, not constant polling | Reduces unnecessary API calls to Meta/YouTube, which have rate limits | Avoids the platform APIs themselves becoming a reliability risk |

---

## 8. Tradeoffs

| Tradeoff | Gain | Cost | Verdict |
|---|---|---|---|
| Building "Pending Approval" state now vs. only when OQ-1 is resolved | No redesign later, decision from Doc 01 stays genuinely optional | Slightly more UI states to build in v1 even if unused | Accept — this is a small cost paid once vs. a rebuild paid later |
| Immutable history vs. simple editable log table | Reliable audit trail | Slightly more schema/query complexity (append vs. update) | Accept — "complete publishing history" is a stated goal; a mutable log doesn't satisfy it |
| P1-deferring AI Prompt Management UI | Faster v1 launch | Owner edits prompts via backend config file/DB in v1, not UI | Accept — functionally identical outcome, UI is a convenience layer that can wait |

---

## 9. Assumptions

- **PA-1:** The owner is technically comfortable using backend config (e.g., editing a config file or running a DB update) for P1/P2 features not yet given a UI in v1.
- **PA-2:** "Real-time" dashboard updates are not required — polling/refresh-on-interval is acceptable given single-user, low-volume usage (Document 01 A4).
- **PA-3:** OAuth re-authentication is a manual, owner-initiated action in v1 — no automated re-auth flow (that requires refresh token handling per platform, covered in Document 05 Platform Integration Design).

---

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Dashboard becomes a dumping ground of every possible feature, delaying launch | High | Strict P0/P1/P2 triage in Section 4 — only P0 ships in v1 |
| Owner loses trust in automation if failures are hard to find in the UI | High | Publishing History and Logs are both P0, not afterthoughts |
| "Pending Approval" state built but never wired to a real toggle, becoming dead UI | Low | Settings section (4.10) explicitly includes the toggle as P1, shipped close to v1 |

---

## 11. Future Expansion

- Approval gate becomes default-on with per-content-type override once volume/trust data justifies it
- AI Prompt Management moves from P1 UI to a full prompt-versioning and A/B testing system
- Platform/System Health becomes a real-time WebSocket-driven view instead of polling, once multi-tenant scale makes polling costly
- Analytics section (explicitly deferred in Document 01) layers on top of the immutable Publishing History data — no schema change needed when it's built

---

## 12. Open Questions

| ID | Question | Recommendation |
|---|---|---|
| OQ-5 | Should "force-publish immediately" from the queue (4.3) bypass the approval gate if it's on? | Recommend: no — force-publish should skip the *delay*, not the *approval*. Bypassing approval via a "quick action" defeats the point of having the gate. |
| OQ-6 | Should discarded/rejected content be permanently deleted or retained for audit ("we generated this and chose not to post it")? | Recommend retain, matching the immutable-history principle — storage cost is negligible at this volume |

---

## 13. Industry Best Practices Applied

- **State machine modeling before UI design** — prevents building screens that can't represent real system states (a common source of "the UI says one thing, the backend does another")
- **Immutable audit log pattern** for history — standard for any system where "what happened and when" must be trustworthy after the fact
- **Feature triage (P0/P1/P2) before design** — prevents scope creep disguised as thoroughness

---

## 14. Production Considerations

- Every P0 feature in Section 4 must work correctly with **zero content items** and **zero platform connections** (empty states) — a common launch-day bug is a dashboard that only works once data exists
- Platform Health checks must have their own timeout/failure handling — a slow or down Meta API must not hang the entire dashboard load

---

## 15. Recommendations

1. Build in the exact P0 order listed in Section 4 — Content Library and Publishing Queue/History form the critical path; Templates and Platform Management can be built in parallel.
2. Resolve OQ-5 and OQ-6 before Document 04 (Pipeline Design), since both affect the state machine's transition rules.
3. Proceed to **Document 03: System Architecture** next — this PRD's state model (Section 6) and feature list are the direct input for service/component boundaries.

---

**End of Document 02 — Product Requirements Document**