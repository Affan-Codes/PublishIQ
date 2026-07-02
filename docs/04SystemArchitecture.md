# Document 04: System Architecture
## AI-Powered Content Automation Platform

**Document Status:** Approved for Implementation Planning
**Version:** 1.0
**Depends On:** Document 01 (Vision & Scope), Document 02 (PRD), Document 03 (TRS)
**Owner:** Founding Engineering Team

---

## 1. Executive Summary

This document defines the system's component boundaries, how those components communicate, how the pipeline actually executes as running processes (not just as a conceptual workflow diagram), and how the architecture stays SaaS-ready without being over-built for a single user.

The central architectural decision is: **a modular monolith, not microservices, for v1** — one deployable backend codebase with hard internal module boundaries (enforced by convention and code review, not network calls), split into an API process and one or more worker processes sharing the same codebase. This satisfies "SaaS-ready without major rewrites" (the boundaries are already correct) without paying the operational cost of distributed services for a single-user tool (the non-goal the brief explicitly warned against over-engineering toward).

---

## 2. Objectives

| # | Objective |
|---|-----------|
| AO-1 | Define exactly which processes run, what each one does, and how they communicate |
| AO-2 | Make module boundaries strict enough that extracting a module into its own service later (SaaS scale) is a deployment change, not a rewrite |
| AO-3 | Resolve the scheduler-vs-queue ambiguity left open in Document 02 (OQ-3) with one concrete mechanism |
| AO-4 | Give "verify publication" (Document 01 workflow step) an actual architectural home, since it must run *after* a delay following publish, not inline with it |
| AO-5 | Keep platform and AI-provider isolation real at the architecture level, not just asserted |

---

## 3. Scope

Covers: process/deployment topology, module/layer boundaries, component responsibilities, inter-component communication, job/queue architecture, adapter architecture for platforms and AI providers, and how the frontend talks to the backend.

Does not cover: database table design (Document 05), specific API routes/payloads (Document 06), UI component design (Document 07).

---

## 4. Process Topology

The system runs as **three logical process types**, all from the same codebase (modular monolith), independently deployable as separate containers per Document 03 §5.2:

| Process | Responsibility | Scaling Path |
|---|---|---|
| **API Server** (Express) | Serves the internal REST API to the dashboard frontend; handles auth, reads, and write requests that enqueue jobs. Does **not** execute pipeline logic itself. | Horizontally scalable behind a load balancer once multi-tenant — stateless by design from v1 |
| **Worker Process** (BullMQ consumer) | Executes every pipeline stage (generate, validate, media, caption, hashtags, publish, verify) as jobs pulled from Redis-backed queues | Horizontally scalable by running more worker instances — no code change required, this is exactly why the queue-based design was chosen in Document 01 |
| **Scheduler Process** | A single lightweight process (or a BullMQ repeatable job pattern run inside the worker — see Architecture Decision AD-1) that enqueues "generate content" jobs on a configured schedule | Not a scaling concern at v1; revisit only if multi-tenant scheduling volume requires it |

**Why not fold Scheduler into the API server?** Because the API server is meant to be stateless and horizontally scalable; a scheduler that fires on a timer must run exactly once regardless of how many API instances exist. Keeping it separate (or using BullMQ's built-in repeatable-job locking, per AD-1) avoids duplicate-trigger bugs the moment the API server is scaled to 2+ instances.

---

## 5. Component Architecture

### 5.1 Layered Module Structure (Conceptual — Not a Folder Structure)

Following Clean Architecture principles per Document 01's stated principles, each module in the backend has four internal layers. This is described here as a *responsibility boundary*, not a directory layout — Document 08 (if produced) or the implementation itself decides literal folder names.

| Layer | Responsibility | Depends On |
|---|---|---|
| **Domain** | Core entities and business rules (Content Item, Publishing Job, Platform Account) and the state machine defined in Document 02 §6 | Nothing — no framework, no I/O |
| **Application** | Use cases / orchestration (e.g., "generate content for type X," "publish content item Y") | Domain only |
| **Infrastructure** | Concrete implementations: Prisma repositories, BullMQ job producers/consumers, AI provider SDK calls, platform API SDK calls, storage backend calls | Application interfaces (implements them) |
| **Interface** | Express routes, request/response DTOs, dashboard-facing contracts | Application only |

**This is the mechanism that makes AO-2 real.** Application-layer code depends on *interfaces* (e.g., `AIProvider`, `PlatformPublisher`, `StorageBackend`) that Infrastructure implements — never the reverse. This is what makes "add a new platform" or "add a new AI provider" a matter of writing one new Infrastructure implementation, touching zero Application or Domain code.

### 5.2 Core Modules

| Module | Owns | Exposes To Other Modules |
|---|---|---|
| **Content** | Content items, state machine transitions, validation rules | `ContentService` (create, transition state, query) |
| **AI Generation** | Prompt templates, provider selection, generation calls | `AIProvider` interface + concrete adapters (per provider) |
| **Media** | Template compositing, media file generation | `MediaGenerator` interface |
| **Publishing** | Platform adapters, publish + verify logic | `PlatformPublisher` interface + concrete adapters (per platform) |
| **Storage** | Abstracted file storage | `StorageBackend` interface (local disk impl for v1) |
| **Scheduling** | Schedule config, triggers generation jobs | Internal only — talks to Content/AI Generation via job enqueue, not direct calls |
| **Platform Accounts** | OAuth tokens, connection status, health checks | `PlatformAccountService` |
| **Observability** | Structured logging, correlation IDs, alerting | Cross-cutting — used by all modules, owned by none |

### 5.3 Adapter Architecture (Platform & AI Provider Isolation)

This directly implements Document 01's "publishing engine remains unchanged regardless of platform" requirement and Document 03's provider abstraction requirement.

- **`PlatformPublisher` interface**: every platform adapter (Facebook, Instagram, YouTube Shorts, and future ones) implements `publish(content) → PublishResult` and `verify(publishResult) → VerificationResult`. The Publishing module's orchestration logic calls only this interface — it has zero knowledge of Graph API vs. YouTube Data API specifics.
- **`AIProvider` interface**: every AI provider adapter implements `generate(prompt, config) → GenerationResult`. The AI Generation module's orchestration logic never references a specific provider's SDK directly.
- **Adapter registration**: adapters are registered in a small, explicit registry (config-driven, not reflection/magic-based) mapping platform/provider identifiers to their adapter implementation — keeps "which adapter handles this" traceable and debuggable, not implicit.

---

## 6. Pipeline Execution Architecture

### 6.1 Queue Design

Each pipeline stage from Document 01's workflow maps to its own BullMQ queue, **not one monolithic "process content" job** — this is what makes every stage independently retryable (Document 01 O2, FR-11) a real architectural property instead of an aspiration:

```
generate-content-queue → validate-content-queue → generate-media-queue
   → generate-caption-queue → queue-for-publish-queue → publish-queue
   → verify-publish-queue → archive-queue
```

Each queue's job, on success, enqueues the next stage's job with a reference to the persisted content item ID — **never the full payload re-passed forward**. This means a stage always re-reads current state from the database rather than trusting possibly-stale in-flight data, which is what actually guarantees "no stage requires regenerating previous work."

### 6.2 The Delay & Verification Problem (Resolved — Was Unaddressed in the Raw Brief)

Document 01's workflow lists "wait configured delay" then "publish" then "verify publication" as sequential steps, but a naive implementation would either block a worker thread for the delay (wasteful, doesn't survive a worker restart) or verify immediately after publish (too soon — platforms can take time to fully process a post).

**Resolution:** BullMQ's native **delayed jobs** feature is used for both delays:
- The `publish` job is enqueued with a `delay` option equal to the configured publish delay (Document 02 §4.9) — the job simply doesn't become available to a worker until that time elapses, no blocked threads, survives restarts because delay state lives in Redis.
- The `verify` job is enqueued with its own short delay (e.g., 60–120 seconds, configurable) *after* a successful publish, giving the platform time to fully process the post before verification checks for it.

This is a concrete resolution to Document 02's OQ-4 (distinguishing "unknown state" from "confirmed failure") as well: verification failure within the expected window is `retryable` (platform may still be processing); verification failure after N retries is `terminal` and surfaced to the dashboard per Document 03 §5.5's error classification.

### 6.3 Scheduler Mechanism (Resolves Document 02 OQ-3)

**Architecture Decision AD-1:** the Scheduler does not run its own cron process separate from the queue system. It uses **BullMQ's repeatable jobs** feature to enqueue `generate-content` jobs on a cron-like schedule, configured per content type (Document 02 §4.9). This means:
- Only one mechanism (BullMQ/Redis) is responsible for "when things happen" — not a cron process *and* a queue system as two uncoordinated sources of truth
- Manual "Generate now" (Document 02 §4.1) simply enqueues the same job type immediately, outside the schedule — the pipeline code downstream cannot tell the difference and doesn't need to

---

## 7. Frontend-Backend Communication

- Dashboard (React/Vite SPA) communicates with the API Server exclusively via the versioned REST API (`/api/v1/...`, per Document 01 §3.3)
- TanStack Query handles server-state caching/refetching on the frontend — satisfies Document 02's "cached + on-demand refresh" requirement (§4.11) without the frontend needing its own polling logic reinvented per view
- Zustand handles local/UI-only state (e.g., which dashboard filters are active) — kept strictly separate from server state, which TanStack Query owns exclusively, to avoid the common anti-pattern of two competing sources of truth for the same data
- No WebSocket/real-time channel in v1 (Document 02 PA-2) — explicitly deferred to Future Expansion

---

## 8. Architecture Decisions

| ID | Decision | Rationale |
|---|---|---|
| AD-1 | Scheduler uses BullMQ repeatable jobs, not a separate cron process | Single source of truth for "when things happen"; avoids duplicate-trigger risk when API/worker processes scale |
| AD-2 | Modular monolith (one codebase, multiple deployable processes), not microservices, for v1 | Microservices for a single-user tool is the over-engineering Document 01's Non-Goals implicitly warn against; module boundaries (§5.1) already make future extraction possible without a rewrite |
| AD-3 | Pipeline stages are separate BullMQ queues, not one combined job | Direct requirement from Document 01 O2/FR-11 — independent retryability is not optional |
| AD-4 | Publish and verify delays use BullMQ delayed jobs, not blocking waits or a separate cron | Survives worker restarts, no wasted compute holding a thread open, resolves Document 02 OQ-4 |
| AD-5 | Content item ID passed between stages, not full payload | Guarantees each stage reads current state, preventing stale-data bugs across retries |

---

## 9. Tradeoffs

| Tradeoff | Gain | Cost | Verdict |
|---|---|---|---|
| Modular monolith vs. microservices | Much simpler ops for single-user v1; still SaaS-extractable | If a module genuinely needs independent scaling before extraction is justified, the whole monolith scales together | Accept — Document 03 already established horizontal worker scaling covers the realistic v1→early-SaaS scaling need |
| BullMQ repeatable jobs vs. dedicated cron service | One less moving part, one less thing to keep in sync with job state | Slightly less mature/battle-tested than a dedicated scheduler like `node-cron` + separate coordination | Accept — BullMQ's repeatable jobs are production-proven and avoid the coordination problem entirely, which outweighs marginal maturity concerns |
| Content-item-ID-only passing between stages vs. full payload | No stale-data bugs, smaller queue payloads | One extra DB read per stage | Accept — DB reads are cheap; stale-data bugs are expensive and hard to debug |

---

## 10. Assumptions

- **AA-1:** A single worker process type can safely run all pipeline stage queues in v1 — no requirement yet for dedicated worker pools per stage (e.g., a separate worker fleet just for media generation). Revisit if one stage becomes a bottleneck.
- **AA-2:** Redis (already required for BullMQ) is an acceptable single point of coordination for both job queuing and scheduling — no separate scheduling infrastructure needed.
- **AA-3:** The API Server never executes pipeline logic directly, even for "Generate now" — it always enqueues a job and returns immediately, keeping the API Server stateless and fast regardless of pipeline duration.

---

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Module boundaries erode over time without enforcement (someone imports Infrastructure directly into Domain "just this once") | Medium-High — quietly defeats AO-2's entire purpose | Recommend lint rule / import boundary enforcement (e.g., ESLint `no-restricted-imports` per layer) as part of Document 03's CI requirements — flagged here since it wasn't explicit in Document 03 |
| Single Redis instance is a single point of failure for both queue and scheduling | Medium | Acceptable at v1 scale per Document 03 AA/TA assumptions; Redis persistence (AOF) already required (Document 03 §5.2) limits data-loss risk, not availability risk — full HA Redis is a SaaS-phase concern |
| Worker process crash mid-job | Medium | BullMQ's job lock/stall detection re-queues jobs whose worker died mid-processing — must be configured, not left at defaults, since default stall timeouts may not suit longer-running media generation jobs |

---

## 12. Future Expansion

- Any module in §5.2 can be extracted into its own deployable service by moving its Infrastructure implementation behind a network boundary — the Application-layer interface contract doesn't change, satisfying Document 01's core SaaS-readiness goal
- Dedicated worker pools per queue (e.g., separate scaling for media generation vs. publish) once volume data justifies it (revisits AA-1)
- WebSocket-based real-time dashboard updates once justified by scale (Document 02 Future Expansion)
- Multi-region deployment only becomes relevant post-SaaS-launch; nothing in this architecture blocks it, but nothing in v1 builds toward it prematurely either

---

## 13. Open Questions

| ID | Question | Recommendation |
|---|---|---|
| OQ-10 | Should the Scheduler's BullMQ repeatable job run inside the Worker process (AD-1) or as a fourth, separate lightweight process? | Recommend inside the Worker process for v1 — one less container to deploy/monitor; revisit only if worker restarts start noticeably disrupting schedule reliability |
| OQ-11 | What BullMQ stall/lock timeout is appropriate for media generation jobs specifically, given they may run longer than other stages? | Recommend measuring actual media generation duration during implementation and setting the timeout at 2–3x observed p95 duration, rather than guessing a number now |

---

## 14. Industry Best Practices Applied

- **Ports-and-adapters (hexagonal) style boundary** between Application and Infrastructure — standard pattern for exactly this "swap the implementation without touching business logic" requirement
- **Queue-per-stage over monolithic job** — standard practice in durable pipeline design (seen in ETL and workflow-orchestration systems generally) for independent retryability
- **ID-passing over payload-passing between async stages** — avoids the classic distributed-systems bug class of acting on stale data
- **Delayed jobs over blocking waits** — standard for any "wait then act" requirement in a queue-based system

---

## 15. Production Considerations

- Import boundary enforcement (Risk in §11) should be added to CI now, while the codebase is small — retrofitting architectural discipline onto an already-large codebase is far more expensive than establishing it from the first module
- BullMQ dashboard/monitoring (e.g., Bull Board) should be deployed alongside the worker for operational visibility into queue depth and stalled jobs — this feeds directly into Document 02 §4.11's System Health view

---

## 16. Recommendations

1. Add explicit import-boundary linting to Document 03's CI requirements before implementation begins — this is the one gap in this document that isn't self-enforcing by architecture alone and needs a tooling backstop.
2. Resolve OQ-10 during initial implementation, not before — it's a low-stakes decision better made with a working system to observe than debated on paper.
3. Proceed to **Document 05: Database Schema & Data Model Design** next — the module boundaries and state machine referenced throughout this document are the direct input for entity design.

---

**End of Document 04 — System Architecture**