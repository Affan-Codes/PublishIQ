# Document 03: Technical Requirements Specification (TRS)
## AI-Powered Content Automation Platform

**Document Status:** Approved for Architecture Phase
**Version:** 1.0
**Depends On:** Document 01 (Vision & Scope), Document 02 (PRD)
**Owner:** Founding Engineering Team

---

## 1. Executive Summary

This document specifies the concrete technical requirements the system must satisfy: runtime versions, infrastructure targets, testing obligations, security controls, and operational tooling. Document 01 said *what* the system does; Document 02 said *what the product looks like*; this document says *what technically has to be true* for the system to be called production-ready — including things the original brief named as a tech stack but never actually specified as requirements (testing, deployment target, cost/rate controls).

If Document 04 (System Architecture) is the blueprint, this document is the building code it has to comply with.

---

## 2. Objectives

| # | Objective |
|---|-----------|
| TO-1 | Define exact runtime and tooling versions so "it works on my machine" cannot happen |
| TO-2 | Specify a testing strategy proportional to the risk of unattended, real-world publishing — this did not exist in the source brief and is not optional |
| TO-3 | Define a concrete deployment target, not just a list of libraries |
| TO-4 | Put explicit ceilings on AI provider usage (rate, cost, retries) so automation cannot silently run up a bill or burn a provider relationship |
| TO-5 | Specify security controls at the level of "which secret, stored where, accessed how" — not just "security by default" as a slogan |

---

## 3. Scope

Covers: runtime/language versions, testing requirements, CI/CD requirements, deployment/infrastructure target, security & secrets management, AI provider operational limits, media processing requirements, error handling standards, and monitoring/alerting requirements.

Does not cover: database schema (Document 05), API endpoint contracts (Document 06), UI component specs (Document 07 UI/UX Architecture).

---

## 4. Functional Requirements (Technical)

| ID | Requirement |
|---|---|
| TR-1 | Backend runs on Node.js 20.x LTS (or later LTS at build time) — never a non-LTS version in production |
| TR-2 | All backend and frontend code is TypeScript in `strict: true` mode — no `any` escape hatches without an inline justification comment |
| TR-3 | Database migrations are managed exclusively through Prisma Migrate — no manual schema edits against the production database, ever |
| TR-4 | Every background job (BullMQ) must be idempotent: re-processing the same job ID with the same payload produces no duplicate side effects |
| TR-5 | Every external call to a platform API (Meta, YouTube) or AI provider must have an explicit timeout — no unbounded network calls |
| TR-6 | Every AI provider call is wrapped in a rate limiter and a per-day/per-month cost ceiling, configurable per provider |
| TR-7 | Media generation/compositing must run as an isolated, retryable pipeline stage — a media failure must not require re-running content generation (already stated in Doc 01, restated here as a hard technical constraint on job design) |
| TR-8 | All environment-specific configuration (API keys, DB URLs, platform credentials) is injected via environment variables — never hardcoded, never committed |
| TR-9 | The system must run correctly in at least two environments: local development and production — a staging environment is recommended but not mandatory for v1 given single-user scale (see Section 9 Tradeoffs) |

---

## 5. Non-Functional Requirements

### 5.1 Testing Strategy — **Missing From Original Brief, Non-Negotiable Given the Risk Profile**

The source brief specified a tech stack and never once mentioned testing. For a system that publishes to real, branded social accounts on a schedule with no human in the loop by default, that is a genuine gap, not a stylistic omission. Minimum bar for v1:

| Test Type | Requirement | Rationale |
|---|---|---|
| Unit tests | All business logic (validation, content-state transitions, AI/platform adapter interfaces) — target 70%+ coverage on core pipeline logic, not a vanity number on the whole repo | Pipeline correctness is the product; untested pipeline logic is an untested product |
| Integration tests | Every platform adapter and AI provider adapter tested against sandbox/mock endpoints (Meta and YouTube both provide test/sandbox modes) | Adapters are the highest-risk, most-likely-to-break-on-external-change code in the system |
| Contract tests | Internal API (frontend↔backend) has contract tests so a backend change that breaks the frontend fails CI, not production | Prevents silent breakage given single-owner, low-review-bandwidth reality |
| Manual QA checklist | Full pipeline dry run against sandbox platform accounts before every production deploy that touches the pipeline or adapters | Automated tests cannot fully substitute for a real dry run against real (sandbox) platform APIs |

**Tooling:** Vitest (fast, native TS/ESM support, works cleanly with Vite frontend) for unit/integration; Playwright reserved for future dashboard E2E once the UI stabilizes (P1, not v1 blocker).

### 5.2 Deployment & Infrastructure Target — **Also Missing From Original Brief**

The brief lists a tech stack but never says where it runs. That's a real requirement, not an implementation detail deferred to "later":

| Requirement | Detail |
|---|---|
| Containerization | Backend, worker (BullMQ processor), and frontend build are each containerized (Docker) — even for single-user v1, this guarantees environment parity and is a prerequisite for any future horizontal scaling |
| Deployment target | Single-VM or single-container-host deployment acceptable for v1 (e.g., a managed container platform or a VPS running Docker Compose) — must not assume serverless, since BullMQ workers require a long-running process |
| Database hosting | Managed PostgreSQL strongly recommended over self-hosted, even at v1 scale — backup/restore and version upgrades are not worth self-managing for a single owner |
| Redis hosting | Managed Redis (or Redis on the same host as v1 acceptable) — must persist across restarts (AOF or RDB enabled), since job queue state loss means lost publishing jobs |

### 5.3 Security & Secrets Management

| Requirement | Detail |
|---|---|
| Secrets storage | Environment variables injected at deploy time via the hosting platform's secret manager, or a `.env` file excluded from version control and encrypted at rest on disk | 
| Platform OAuth tokens | Encrypted at rest in the database (application-level encryption, not just relying on disk encryption) |
| Transport security | TLS/HTTPS enforced for all external traffic; internal service-to-service traffic within the same host does not require TLS in v1 (single-host deployment) |
| Dependency security | Automated dependency vulnerability scanning (e.g., `npm audit` or Dependabot) as part of CI, not a manual occasional check |
| Least privilege | Platform API credentials scoped to only the permissions required for publishing (e.g., Meta app permissions limited to `pages_manage_posts`, not broader account access) |

### 5.4 AI Provider Operational Limits — **Missing From Original Brief**

The brief specifies "provider abstraction" but never addresses what happens when a provider is called too often or too expensively. This is a real operational risk for a scheduled, automated system:

| Requirement | Detail |
|---|---|
| Rate limiting | Per-provider request rate capped in application config, independent of the provider's own rate limit, to leave headroom |
| Cost ceiling | Configurable daily/monthly spend ceiling per provider; pipeline pauses generation (not publishing of already-generated content) if exceeded, with an alert to the owner |
| Retry limits | AI generation retries capped (e.g., 3 attempts) with exponential backoff — an AI provider outage must not cause an infinite retry loop that also burns cost |
| Provider fallback | If the primary provider fails after max retries, the system may optionally fall back to a secondary configured provider — flagged as P1, not a v1 blocker (see Open Questions) |

### 5.5 Error Handling Standards

| Requirement | Detail |
|---|---|
| Error classification | Every error is classified as `retryable` or `terminal` at the point it's caught — this classification drives whether BullMQ retries automatically or surfaces to the dashboard as needing manual action |
| No silent catches | Every `catch` block either logs with full context or re-throws — an empty catch block is a defect, not a style choice |
| User-facing errors | Dashboard-surfaced errors are human-readable; raw stack traces go to logs only |

### 5.6 Monitoring & Alerting — **Underspecified in Original Brief**

"Keep detailed logs" is not a monitoring strategy. Minimum requirement:

| Requirement | Detail |
|---|---|
| Structured logging | JSON-structured logs with correlation IDs (per Document 02 Section 4.8), shippable to a log aggregator later without reformatting |
| Alerting | At minimum, the owner is notified (email or equivalent) on: pipeline-wide failure, platform token expiry within 7 days, AI cost ceiling reached |
| Health endpoint | Backend exposes a `/health` endpoint checking DB, Redis, and worker liveness, used by both the dashboard's System Health view and any future infra-level uptime monitoring |

---

## 6. Architecture Decisions (Technical-Level)

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript strict mode, frontend and backend | Type safety across the adapter boundaries (platform, AI provider) is where bugs are most expensive to find at runtime |
| Containerization from v1 | Yes, even for single-user scale | Environment parity now is cheap; discovering deployment issues for the first time during SaaS scale-up is not |
| Testing framework | Vitest over Jest | Native ESM/TS support, faster, and already aligned with the Vite frontend tooling — avoids maintaining two different test runner configs |
| Managed DB/Redis over self-hosted | Yes | Single owner has no bandwidth to be their own DBA; the cost delta is worth the reliability at any realistic v1 budget |
| Cost ceilings on AI providers | Hard requirement, not optional config | An automated system with no spend ceiling is a genuine financial risk, not a hypothetical one |

---

## 7. Tradeoffs

| Tradeoff | Gain | Cost | Verdict |
|---|---|---|---|
| Mandatory containerization at v1 | Environment parity, SaaS-ready deployment path | Extra setup complexity for a single-user tool | Accept — this is exactly the kind of decision Document 01 flagged as "never choose designs that require major rewrites for SaaS" |
| Staging environment recommended but not mandatory | Saves infrastructure cost/complexity for v1 | Some risk of a bad deploy hitting production directly | Accept for v1 given manual QA checklist (5.1) as a compensating control; **revisit as mandatory once real users beyond the owner exist** |
| 70% coverage target on core pipeline only, not whole repo | Focuses testing effort where risk is highest | Some UI/dashboard code ships with lighter test coverage | Accept — dashboard bugs are annoying; pipeline bugs post bad content to real accounts unattended |
| No provider fallback in v1 (flagged P1) | Simpler v1 AI adapter implementation | A primary-provider outage pauses generation until manually addressed | Accept for v1 — fallback logic is meaningful complexity better justified once real usage patterns exist |

---

## 8. Assumptions

- **TA-1:** The owner has budget for managed Postgres and Redis hosting (even minimal tiers) rather than requiring fully free/self-hosted infrastructure.
- **TA-2:** Sandbox/test modes are available and sufficient for Meta Graph API and YouTube Data API integration testing without requiring live posts during development.
- **TA-3:** A single deployment host is acceptable for v1 traffic/job volume — no requirement for auto-scaling infrastructure yet.
- **TA-4:** The owner will configure and periodically review AI provider cost ceilings — the system enforces the ceiling but does not guess an appropriate value.

---

## 9. Risks

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Untested pipeline logic causes bad or duplicate content to publish to real accounts | High | Medium (without 5.1's requirements) | Testing strategy in 5.1 is marked non-negotiable for exactly this reason |
| AI provider cost runs away unnoticed | Medium-High | Medium | TR-6 and 5.4 cost ceiling with alerting |
| Redis data loss (queue state) on host restart without persistence enabled | High | Low-Medium | TR/5.2 explicit requirement for AOF/RDB persistence |
| Single-host deployment becomes a single point of failure | Medium | Medium | Acceptable for v1 per scope (Document 01 A3); explicitly flagged for revisit before multi-tenant SaaS launch |
| Dependency vulnerabilities go unnoticed without automated scanning | Medium | Medium (without 5.3's requirement) | Automated scanning in CI per 5.3 |

---

## 10. Future Expansion

- Staging environment becomes mandatory once users beyond the single owner exist
- Provider fallback (5.4) implemented once real usage data justifies the added complexity
- Playwright E2E suite expands as the dashboard UI stabilizes
- Horizontal scaling of BullMQ workers once job volume exceeds single-host capacity — the containerized, queue-based design from Document 01/03 already supports this without redesign
- Log aggregation platform (e.g., centralized log search) added on top of the structured logging already required in 5.6 — no logging format change needed

---

## 11. Open Questions

| ID | Question | Recommendation |
|---|---|---|
| OQ-7 | Should AI provider fallback (secondary provider on primary failure) be pulled into v1 given how central content generation is to the product? | Recommend keeping it P1/deferred — the cost ceiling and retry-limit controls (5.4) already prevent the worst-case failure mode (runaway cost/infinite retry); fallback is a nice-to-have on top of that, not a safety requirement |
| OQ-8 | What log retention period is appropriate — indefinite (matches Document 01's content retention default) or a shorter operational window? | Recommend 90 days for detailed logs, indefinite for the immutable Publishing History records (Document 02 Section 4.4) — these are different data with different retention needs and were previously conflated |
| OQ-9 | Is a single deployment host acceptable long-term, or should Document 04 design for multi-host from the start? | Recommend single host for v1 per TA-3, but Document 04 (System Architecture) must confirm the design doesn't assume single-host in a way that blocks later horizontal scaling |

---

## 12. Industry Best Practices Applied

- **Test pyramid proportional to risk**, not uniform coverage targets — focusing rigor on pipeline/adapter logic over UI code is standard practice for automation-heavy systems
- **Explicit cost/rate ceilings on third-party API usage** — standard operational hygiene for any system making automated, scheduled calls to metered external services
- **Environment parity via containerization from day one** — well-established practice specifically to avoid "works locally, breaks in production"
- **Error classification (retryable vs. terminal) at the point of catch** — standard pattern for queue-based systems, prevents both infinite retry loops and silently swallowed permanent failures

---

## 13. Production Considerations

- CI must block merges on failing tests and failed dependency audits — a testing strategy that isn't enforced in CI is a testing strategy that will be ignored under deadline pressure
- The manual QA checklist (5.1) must be a literal checklist artifact, not a mental habit — the first time it's skipped "just this once" is the first time a bad post goes out unattended
- Cost ceiling alerts (5.4) must reach the owner outside the dashboard (e.g., email) — a system that's failing can't be trusted to reliably display its own failure on a dashboard nobody's currently looking at

---

## 14. Recommendations

1. Treat Sections 5.1 (Testing) and 5.4 (AI Cost/Rate Limits) as launch blockers, not nice-to-haves — both were absent from the original brief and both are directly tied to the risk of unattended, real-world publishing.
2. Resolve OQ-8 (log retention split) before Document 05 (Database Schema), since it affects whether logs and publishing history live in the same or separate storage/retention paths.
3. Proceed to **Document 04: System Architecture** next — this TRS's deployment target, adapter requirements, and job idempotency constraints are direct inputs to component and service boundary design.

---

**End of Document 03 — Technical Requirements Specification**