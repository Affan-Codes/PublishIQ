# 03 — Technical Requirements

**Status:** Draft — pending approval
**Version:** 1.0
**Last revised:** 2026-07-04
**Owning document for:** Concrete technology choices, language/runtime/framework selection, non-functional requirements (performance, reliability, security posture), and resolution of technical Assumptions/Open Items raised by earlier documents.
**Does not own:** Product goals/scope (`01-vision-and-scope.md`), functional behavior (`02-product-requirements-prd.md`), component/module topology (`04-system-architecture.md`), schema (`05-database-design.md`), internal backend code organization (`06-backend-architecture.md`), UI structure (`07-frontend-architecture.md`), or any frozen constitutional decision (`PROJECT_DECISIONS.md`). Where this document touches those subjects, it references rather than restates them.

---

## 1. Purpose and Authority

This document converts the *what* (`01-vision-and-scope.md`, `02-product-requirements-prd.md`) into the *with what* — the concrete technology stack and non-functional bar every later document builds against. It does not re-decide anything already frozen in `PROJECT_DECISIONS.md`; where a frozen decision already fixes a technology (BullMQ, React/Playwright/FFmpeg, Docker Compose, local-first), this document states it once for completeness and links back rather than re-litigating it.

This document also has a second job the PRD explicitly deferred to it: **resolving the technical Assumptions register** (`02-product-requirements-prd.md`, Section 20) where resolution is a technology/feasibility question rather than a product question. Each resolution below states the decision, the reasoning, and which PRD FRs it changes the status of. Product-only assumptions (A-2, A-7) are **not** resolved here — they are explicitly out of this document's authority and remain open for you.

---

## 2. Technology Stack

| Concern | Choice | Rationale |
|---|---|---|
| Language (backend) | **TypeScript**, Node.js LTS | Single language across backend, workers, and rendering templates (React). One toolchain, one type system, lower cognitive load for a one-person-maintained system — directly serves Section 2's Simplicity/DX ordering. |
| Web framework | **Express** | Not Fastify, not NestJS. Express is the most widely documented, lowest-ceremony option; NestJS's DI/decorator machinery is exactly the "unnecessary abstraction" Section 25/31 warns against for a system this size. |
| ORM / DB access | **Prisma** | Type-safe queries, first-class migrations, and it enforces the Repository boundary (Section 25) naturally — Prisma Client is only ever imported inside Repository files. |
| Database | **PostgreSQL** | Relational integrity matters here (Channels→Profiles→Prompts/Templates reference graph, Section 26 of `PROJECT_DECISIONS.md`); JSONB columns cover the few genuinely semi-structured fields (stage history, hashtags) without going full-NoSQL. |
| Queue / scheduling | **BullMQ on Redis** | Frozen, `PROJECT_DECISIONS.md` Section 17. Not re-decided here. |
| Rendering | **Playwright (headless Chromium) → PNG → FFmpeg → video** | Frozen, `PROJECT_DECISIONS.md` Section 7.1. Not re-decided here. |
| Frontend | **React + TypeScript, Vite** | React is already mandatory for the rendering Templates (Section 7.1); reusing it for the Dashboard avoids a second frontend paradigm. Vite over CRA/webpack for build speed and near-zero config, consistent with DX priority. |
| Validation | **Zod** | Runtime schema validation at every controller boundary and for AI Provider structured-JSON responses (Section 5.1 of `PROJECT_DECISIONS.md`) — one library for both jobs, no duplicated validation logic. |
| Logging | **Pino** | Structured JSON logs, low overhead, standard choice for Node services; feeds the Logs Dashboard Module (Section 30). |
| Containerization | **Docker Compose only** | Frozen, `PROJECT_DECISIONS.md` Section 28. Not re-decided here. |
| Auth (v1) | **Session-based, single operator, password + hashed credential (bcrypt), HTTP-only cookie session** | v1 has exactly one operator (`01-vision-and-scope.md` Section 6). A full JWT/refresh-token/RBAC system is complexity with no current beneficiary — session auth is simpler, sufficient, and trivially replaceable when multi-user (Future Vision, Section 14) is actually built. |
| API style | **REST, `/api/v1/...`** | Frozen, `PROJECT_DECISIONS.md` Section 29. |
| Testing | **Vitest** (unit + integration), **Supertest** (HTTP layer) | Matches Section 32's unit/integration split; Vitest chosen over Jest for TS-native speed, no material behavior difference otherwise. |

**Explicitly rejected, and why (so a later document doesn't quietly reintroduce these):**
- **GraphQL** — no requirement anywhere calls for client-driven query shaping; REST is simpler and sufficient.
- **Microservices** — one Workspace, one operator, low volume (2–4 videos/day). A monolith (api + worker as two processes from one codebase) satisfies every current requirement; splitting services now would violate Section 2's philosophy ordering outright.
- **Kubernetes, serverless** — frozen exclusions, `PROJECT_DECISIONS.md` Section 28.
- **NoSQL primary store** — the domain is relational by nature (Section 26's reference graph); introducing a document store would duplicate integrity logic Postgres gives for free.

---

## 3. Non-Functional Requirements

### 3.1 Performance
- Render concurrency: 1–2 concurrent render jobs (`PROJECT_DECISIONS.md` Section 7.1), value lives in System Configuration (Section 21). This document does not raise or lower that number.
- Dashboard list views (Jobs, Queue, Publishing History) must paginate server-side once row counts exceed ~200 — no unbounded client-side table loads.
- Global Search (FR-NAV-04) must return results within a few seconds even against the Logs area; if a naive `LIKE` query against the Log table cannot hold that bar at realistic log volume, a Postgres `tsvector` full-text index is the escalation path — not a new search service.

### 3.2 Reliability
- Every BullMQ queue is configured with exponential backoff and a bounded max-attempts value sourced from System Configuration (Retry Limits, `PROJECT_DECISIONS.md` Section 21) — never an unbounded retry loop.
- Domain Events (`PROJECT_DECISIONS.md` Section 23) are written inside the same database transaction as the state change that produced them, so an event is never lost to a mid-write crash and never fires for a state change that didn't actually commit.
- Docker Compose services restart on failure (`restart: unless-stopped`); Postgres and Redis data are on named volumes so a container recreate never loses state.

### 3.3 Security
- Secrets (DB credentials, Redis URL, AI Provider API key, OAuth client secrets for Publishing Adapters) live in environment variables injected via Docker Compose `.env`, never committed, never returned by any API response.
- Platform Connection Access/Refresh Tokens (`PROJECT_DECISIONS.md` Section 15) are encrypted at rest (application-level AES-GCM, key from environment, not the DB) — the Health-Status/expiry fields the dashboard shows (FR-CHN-03) are plaintext metadata, the tokens themselves never are.
- All inbound HTTP traffic goes through `helmet` (standard header hardening) and CORS restricted to the Dashboard's own origin — no public open CORS policy, since this is a single-operator system with no legitimate third-party browser client.
- Rate limiting on the API (basic IP-based) is a cheap, standard safeguard against credential-stuffing on the single login endpoint — not a scalability feature.

### 3.4 Observability
- Pino structured logs to stdout in every container; the Logs Dashboard Module (Section 30) reads from a dedicated `logs` table populated by a lightweight log-drain (see `04-system-architecture.md`), not by tailing container stdout directly — this keeps the Logs module queryable through the same Repository pattern as everything else, rather than a special-cased log viewer.
- Log retention: 30 days by default, value lives in System Configuration alongside everything else Section 21 already covers.

---

## 4. Resolution of Technical Assumptions (from `02-product-requirements-prd.md`, Section 20)

Each item below is a **decision**, made under this document's authority. Where a decision changes an FR's status (e.g., from "conditional" to "in scope" or "out of scope"), that is stated explicitly so `02-product-requirements-prd.md` can be corrected in its next revision rather than left silently stale.

### A-3 — Can a Prompt/Template Version ever be hard-deleted?
**Decision: No.** Prompt Versions and Template Versions are append-only and immutable (already frozen by `PROJECT_DECISIONS.md` Sections 12.1/13.1); allowing hard delete would let an already-pinned Content Profile point at nothing, silently breaking a Job at runtime. Only a library-level "Status" (e.g., Deprecated) is settable — never a delete.

### A-4 — Is Content Profile delete soft-delete only?
**Decision: Yes, soft-delete only** (an `enabled: boolean` / `status` column). Same reasoning as A-3: a Channel holds a hard foreign-key reference to a Content Profile; hard deletion would either cascade-break Channels or require null-handling logic everywhere a Profile is read. Soft-delete plus the existing FR-CFG-04 warning-before-disable behavior fully satisfies the PRD without that complexity.

### A-5 — Allowed Status values for Prompt/Template
**Decision:** `Draft`, `Active`, `Deprecated`. Three values, no more: `Draft` (not yet offered as default), `Active` (offered as default / current rollback target), `Deprecated` (still usable by profiles already pinned to it, never offered to new ones). This is the minimum set that satisfies Section 12.1/13.1's rollback semantics without inventing workflow states nothing has asked for.

### A-6 — Missed scheduled run while the platform was offline
**Decision: Skip, never backfill.** A missed run silently backfilling could double up or unpredictably reorder a Channel's cadence, which conflicts with Predictability (`01-vision-and-scope.md` Section 4). On restart, BullMQ's repeatable-job scheduler resumes from "next occurrence after now" — the missed slot is simply skipped, and (per FR-MON-02) this is not currently a Notification-worthy event on its own. If missed-run visibility is wanted later, that is a new FR, not an implicit behavior of this decision.

### A-8 — Domain Event → Notification latency
**Decision: Near-real-time, target < 5 seconds, delivered via Server-Sent Events (SSE)**, not polling and not WebSockets. Notifications are one-directional (server → dashboard); SSE gets the same effectively-real-time result as WebSockets with a fraction of the implementation and connection-management complexity — the right call given Section 2's cost/complexity ordering and a single connected client (one operator, one browser tab, typically).

### A-9 — Queue-status vocabulary (Waiting/Active/Delayed/Failed) has no glossary entry
**Decision: These are not new domain concepts; they are BullMQ's native job states, surfaced verbatim.** No new business meaning is being introduced — "Waiting" means exactly what BullMQ means by it. **Recommendation, not a decision this document can make unilaterally:** `00-glossary.md` should still gain a one-line clarifying note under **Job** stating that queue status is BullMQ's native lifecycle state and is distinct from the Content Pipeline Job's 13-state pipeline (Section 19). This closes the literal Section 35 process gap the PRD flagged without inventing a new concept.

### A-10 — "Generated Content" as an entity distinct from Job (highest priority per PRD)
**Decision: A `GeneratedContent` row is persisted, in a one-to-one relationship with the Content Pipeline Job that produced it, created once the Job reaches `Generating Content` successfully and updated as later stages (image, video) complete.** It is **not** a second parallel pipeline concept and does **not** change Section 18.1's single-job architecture — the Job still does all the work; `GeneratedContent` is simply *where the Job's output lives* so it can be listed, previewed, and deleted (FR-GC-01–06) without every read needing to load the full Job execution record (stage history, retry counts, failure attribution — none of which a "browse my generated content" screen needs). Deleting a `GeneratedContent` row never deletes the Job row that produced it, and vice versa — satisfying the PRD's explicit "Jobs record execution, Generated Content represents reusable output" instruction concretely. Full schema in `05-database-design.md`, Section 4. **Recommendation to close the glossary gap:** `00-glossary.md` should gain a `Generated Content` entry under Group 7 (Jobs, Queueing & State) once this decision is approved.

### A-12 — Clone Job (FR-JOB-07) vs. Duplicate Generated Content (FR-GC-04)
**Decision: One capability, not two.** A single "Create Job" operation accepts an optional `sourceGeneratedContentId`. When absent, the Job starts at `Draft` and runs Generating Content normally (this is what FR-JOB-07 described). When present, the Job starts at `Draft`, and its `Generating Content` stage is skipped by copying the source `GeneratedContent`'s text forward instead of calling the AI Provider (this is what FR-GC-04 described). Same endpoint, same Job Type, one optional parameter — not two mechanisms. `02-product-requirements-prd.md` should be revised to merge FR-JOB-07 and FR-GC-04 into one FR on its next pass; until then, treat them as aliases of this single capability.

### A-13 — Pause/Resume (FR-JOB-04/05) and Restart-from-failed-stage (FR-JOB-06) feasibility
**Decision, split in two:**
- **Pause/Resume: not supported in v1. FR-JOB-04 and FR-JOB-05 are rejected, not deferred.** True mid-execution pause of a running BullMQ job requires checkpointing arbitrary in-flight work (an in-progress AI Provider HTTP call, an in-progress FFmpeg encode) — there is no clean, safe pause point inside those operations without building a custom checkpoint/resume protocol per stage. That is exactly the distributed-coordination complexity Section 18.1 was written to avoid, and at 2–4 videos/day there is no operational scenario where pausing a single in-flight job (as opposed to disabling the Channel so no *new* jobs start — already supported, FR-CHN-02) delivers value proportionate to that cost. **Recommend `02-product-requirements-prd.md` move FR-JOB-04/05 to Section 19 (Explicit Non-Coverage) on its next revision.**
- **Restart-from-failed-stage: supported, cheaply, as a consequence of A-10.** Because the Job record already persists intermediate outputs after each successful stage (generated text, rendered image URL, rendered video URL — see `05-database-design.md`), a restart simply re-enters the pipeline at the failed stage using whatever outputs already exist, skipping stages that already succeeded. The edge case already identified in FR-JOB-06 (pinned config changed since the original attempt) is enforced by comparing the Job's stored `contentProfileVersionSnapshot` against the Channel's current Content Profile pin at restart time; a mismatch forces a full re-run from `Draft` rather than mixing outputs from two configurations. **FR-JOB-06 is confirmed feasible and should move from "conditional" to committed in the PRD's next revision.**

### A-11 / A-1 — Dashboard Module placement for Prompt Library and Generated Content
Not resolved here — this is a Dashboard/Section 30 question, and Section 30 is explicitly frozen pending its own future revision (`PROJECT_DECISIONS.md` Section 34). This document does not reopen a frozen section. `07-frontend-architecture.md` will place these views under the existing Templates and Jobs modules respectively, exactly as the PRD already provisionally did, without treating that placement as a Section 30 amendment.

---

## 5. Environment & Configuration Strategy

- Three environments: `development` (Docker Compose on the operator's machine), `production` (same Compose file, VPS host — per `PROJECT_DECISIONS.md` Section 28's local-first strategy). No separate `staging` in v1 — one operator, low volume, does not justify a third environment's maintenance cost.
- Configuration precedence: environment variables (secrets, ports, connection strings — things that differ per deployment and must never be in the DB) vs. System Configuration table (`PROJECT_DECISIONS.md` Section 21 — things that are operational knobs the operator tunes at runtime). A value never lives in both places.
- System Configuration is cached in-process with a short TTL (see `06-backend-architecture.md`) so hot paths (e.g., render concurrency) don't hit the database on every job pickup.

---

## 6. Open Items Explicitly Not Resolved Here

- A-2 (Content Type authoring in v1) and A-7 (Hybrid-mode rejection behavior) are **product** questions, not technical ones, and remain open pending your decision — this document has no authority to decide them and does not attempt to.
- Exact retry-limit values, render concurrency values, and default video duration remain deferred to System Configuration's seed defaults, to be set in `06-backend-architecture.md`'s configuration seed script — the architectural home is fixed (Section 21), the values are an implementation detail, not a technical-requirements decision.

---

**No contradictions with `PROJECT_DECISIONS.md`, `00-glossary.md`, `01-vision-and-scope.md`, or `02-product-requirements-prd.md` were introduced.** Every resolution above operates strictly within technology/feasibility authority; product-scope questions were left open rather than decided by inference.

**This document remains a draft pending your approval.** `04-system-architecture.md` is written assuming the decisions in Section 4 above are accepted; if any is rejected, that document needs a corresponding revision before it can be considered consistent.
