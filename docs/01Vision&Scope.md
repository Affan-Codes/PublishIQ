# Document 01: Vision & Scope
## AI-Powered Content Automation Platform

**Document Status:** Approved for Architecture Phase
**Version:** 1.0
**Owner:** Founding Engineering Team

---

## 1. Executive Summary

This platform automates the end-to-end lifecycle of branded social content: AI generation, validation, media production, captioning, scheduling, publishing, and archival, across multiple social platforms.

Version 1 serves exactly one owner/operator and two content types (Hindi/Urdu Shayari, motivational quotes) across three platforms (Facebook Pages, Instagram Business, YouTube Shorts). The system is deliberately architected so that adding a tenth content type or a fifth platform later is a **configuration and adapter-implementation exercise**, not a rewrite.

The single hardest constraint on this document is holding two things simultaneously without letting either compromise the other: **build only what a single user needs**, while **never building anything that blocks a future multi-tenant SaaS**. Every scope decision below is evaluated against that tension explicitly, not left implicit.

---

## 2. Objectives

| # | Objective | Success Signal |
|---|-----------|-----------------|
| O1 | Automate content generation, publishing, and archival with zero manual posting for supported content types | Owner does not manually log into Meta/YouTube business tools to post |
| O2 | Guarantee no content is ever lost or duplicated across a pipeline failure | Every job stage is idempotent and independently retryable |
| O3 | Keep platform-specific and content-type-specific logic fully isolated from the core pipeline | Adding a platform/content type touches only its adapter, never the orchestrator |
| O4 | Produce a system an operator can trust to run unattended | Full audit trail: what was generated, why, when, where it was published, and its current status |
| O5 | Avoid architectural debt that would force a rewrite for multi-tenant SaaS | Data model, auth, and service boundaries are tenant-shaped from day one, even with tenant count = 1 |

---

## 3. Scope

### 3.1 In Scope (v1)

- AI content generation for 2 content types: Shayari (Hindi/Urdu), motivational quotes
- Multi-provider AI abstraction (minimum 2 providers wired, e.g., OpenAI + one alternative) to prove the abstraction, not just claim it
- Image/media generation and branded template compositing
- Caption and hashtag generation
- Publishing to Facebook Pages, Instagram Business, YouTube Shorts
- Configurable publishing delay / scheduling window
- Post-publish verification (confirm the platform actually shows the post, not just that the API call returned 200)
- Full publishing history and status dashboard
- Retry mechanism for every pipeline stage, with backoff and max-attempt policy
- Structured logging and basic system/platform health visibility
- Local storage abstraction with a swap-in path to S3/Cloudinary/R2
- Single-user authentication (session-based; no roles, no orgs)

### 3.2 Explicitly Out of Scope (v1)

- Billing, subscriptions, plans
- Multi-user accounts, teams, organizations, role-based access control
- Public API / developer marketplace
- Multi-tenant data isolation enforcement (schema will *support* it; v1 will not *enforce* it, since there is one tenant)
- Analytics beyond basic publish success/failure counts
- Content types beyond Shayari and quotes (architecture must support them; v1 will not implement them)
- Platforms beyond FB/IG/YouTube Shorts (same adapter pattern applies)
- Human-in-the-loop approval UI *as a gate* — see Open Question OQ-1, this is a genuine gap the original brief did not address

### 3.3 Scope Boundary Callout — Corrected From Initial Brief

The initial brief listed "public API" as both a future platform capability and a non-goal without resolving the contradiction. Resolution: **no external/public API in v1**, but the **internal frontend-to-backend API is designed as if it will later be exposed**, using proper versioning, auth headers, and resource-oriented routes — so exposing it later is a gateway/auth change, not a redesign.

---

## 4. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | System generates content via a configurable AI prompt template per content type | Must |
| FR-2 | System validates generated content (length, language, profanity/brand-safety check, duplication check against recent history) before proceeding | Must |
| FR-3 | System generates or composites media using branded templates | Must |
| FR-4 | System generates captions and hashtags tailored per platform's constraints (character limits, hashtag conventions) | Must |
| FR-5 | System persists every artifact (raw AI output, media, caption, hashtags) before queuing publication | Must |
| FR-6 | System queues a publishing job per platform per content item, independently | Must |
| FR-7 | System respects a configurable delay before publishing (not instant AI-to-live) | Must |
| FR-8 | System publishes to each configured platform via an isolated adapter | Must |
| FR-9 | System verifies the publication actually succeeded on the platform, not just that the request was accepted | Must |
| FR-10 | System records the outcome (success/failure/partial) with enough detail to debug without re-running | Must |
| FR-11 | Failed jobs are retryable from the failed stage only, never from scratch | Must |
| FR-12 | Dashboard surfaces content library, queue, history, templates, platform/system health, and logs | Must |
| FR-13 | Owner can pause/resume the entire pipeline or a single platform without code changes | Should |
| FR-14 | Owner can manually review/edit AI output before it is queued (optional gate, not forced) | Should — see OQ-1 |

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Reliability | No pipeline stage failure should cause loss of prior-stage work. Every stage's output is persisted before the next stage starts. |
| Idempotency | Re-running any job (manually or via retry) must not create duplicate posts or duplicate storage artifacts. |
| Observability | Every job transition (queued → running → succeeded/failed) is logged with timestamps, correlation IDs, and enough context to reconstruct what happened without the original process. |
| Security | Platform credentials (OAuth tokens, API keys) are encrypted at rest; never logged in plaintext; scoped per-platform. |
| Extensibility | Adding a content type or platform requires no changes to the orchestrator, job queue, or database schema — only new adapter/config additions. |
| Maintainability | Business logic, platform logic, and AI-provider logic are in separate modules with no circular dependencies. |
| Performance | Pipeline is not real-time-critical; correctness and durability are prioritized over latency. Target: a content item moves from generation to published within its configured delay window ± a few minutes, not milliseconds. |
| Data Retention | Publishing history and archived content are retained indefinitely by default (single user, low volume); retention policy is a config value, not hardcoded. |

---

## 6. Architecture Decisions (Vision-Level)

These are scope-defining decisions. Full technical architecture is covered in Document 02 (System Architecture).

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tenancy model | Design tables and services with a `tenant_id`/`owner_id` from day one, hardcoded to a single value in v1 | Retrofitting multi-tenancy into a single-tenant schema is a known source of full rewrites. Doing it now costs almost nothing; doing it later costs weeks. |
| Pipeline execution | Queue-based, stage-by-stage (BullMQ/Redis), not a single monolithic function | Enables independent retry per stage (a hard requirement, not a nicety) |
| Platform integration | Adapter pattern — one adapter per platform implementing a common publishing interface | Directly satisfies the "publishing engine remains unchanged regardless of platform" requirement |
| AI integration | Provider adapter pattern behind a single generation interface | Directly satisfies multi-provider requirement without leaking provider specifics into business logic |
| Storage | Abstracted storage interface, local filesystem implementation for v1 | Matches brief; avoids coupling business logic to a specific storage backend |
| Internal API shape | REST, resource-oriented, versioned from v1 (`/api/v1/...`) | Cheap now, prevents breaking changes when a public API becomes a real goal |

---

## 7. Tradeoffs

| Tradeoff | What We Gain | What We Give Up | Verdict |
|----------|---------------|-------------------|---------|
| Tenant-shaped schema now vs. simple single-user schema | No rewrite for SaaS later | Slightly more complexity in every query (tenant filter even when tenant count = 1) | Accept the complexity — the alternative is a full data migration later |
| Queue-based pipeline vs. simple sequential script | Independent retry, resilience, observability | More moving parts (Redis, BullMQ, job monitoring) for what is currently one user's content | Accept — this is explicitly required by the brief and is the correct call for "production-first" |
| Building 2 AI provider adapters now vs. 1 | Proves the abstraction actually works, not just exists on paper | Extra initial integration work | Accept — an abstraction validated by only one implementation is not a proven abstraction |
| No approval gate before auto-publish vs. mandatory human review | Faster to "zero manual posting" | Real brand-safety and reputational risk from fully unattended AI publishing | **Flagged as open question, not silently decided** — see OQ-1 |

---

## 8. Assumptions

All assumptions below are explicit per the brief's requirement — none are silent.

- **A1:** The single owner has valid, active developer/business accounts on Meta (Facebook/Instagram) and YouTube capable of API-based publishing (Graph API, YouTube Data API) before development starts.
- **A2:** "Motivational quotes" and "Shayari" content will be primarily text-plus-image (static graphic), not video, for v1. Reels/video content types are future scope.
- **A3:** The system runs on infrastructure the owner controls (self-hosted or single cloud account) — no assumption of multi-region or high-availability infrastructure in v1.
- **A4:** Publishing volume in v1 is low (single-digit to low-double-digit posts per day), so performance targets are generous.
- **A5:** The owner accepts a configurable delay between generation and publish, meaning nothing is instantaneous — this is treated as a feature (safety buffer), not a limitation.
- **A6:** Content validation (FR-2) is automated, not manually reviewed by default, unless OQ-1 is resolved in favor of a mandatory gate.

---

## 9. Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| AI generates culturally/religiously insensitive Shayari content given the language/domain sensitivity | High (reputational) | Medium | Automated content validation stage (FR-2) must include a language-appropriate profanity/sensitivity filter, not just an English one; recommend human spot-check early on |
| Platform API changes (Meta/YouTube frequently change Graph API versions and policies) | Medium-High | High | Adapter pattern isolates the blast radius to one adapter; version pinning and API changelog monitoring recommended |
| OAuth token expiry causing silent publish failures | Medium | High | Token refresh must be automated with alerting on failure, not discovered only when a post silently fails |
| Duplicate/near-duplicate content published due to AI repetition | Low-Medium | Medium | FR-2 duplication check against recent history window |
| Unattended publishing of a factually or tonally bad AI output | Medium-High | Medium | Directly tied to OQ-1 — this is the single biggest unresolved risk in this document |
| Schema designed for multi-tenancy but never load-tested at multi-tenant scale | Low now, High later | Low (v1), Medium (at SaaS transition) | Explicitly flagged for revisit in Document 02 with realistic SaaS-scale assumptions before public launch |

---

## 10. Future Expansion (Explicitly Non-Breaking)

The following must be addable **without** touching the core orchestrator, job schema, or publishing engine:

- New content types (stories, carousels, reels, promotional posts, blog snippets, festival wishes, educational content)
- New platforms (X, LinkedIn, Pinterest, Threads, Telegram, WhatsApp Channels)
- New AI providers
- New storage backends (S3, Cloudinary, R2)
- Multi-tenancy enforcement (turning the existing `tenant_id` column from decorative to functional)
- Billing, teams, roles, public API — all layered on top of the existing auth and data model, not requiring schema redesign

---

## 11. Open Questions

| ID | Question | Why It Matters | Recommendation |
|----|----------|------------------|-----------------|
| **OQ-1** | Should v1 include an optional human-approval gate before a piece of content is actually published, even though "zero manual posting" is a stated objective? | This was not addressed anywhere in the original brief, and it is the single biggest brand-safety gap in the design as specified. An unattended AI-to-social pipeline with no review step is a real reputational risk, not a hypothetical one. | Build the gate as an **optional, togglable** setting (FR-14, marked "Should" not "Must") — off by default satisfies "zero manual posting," on by default is safer for launch. Do not silently decide this; the owner should explicitly choose. |
| OQ-2 | What defines a "duplicate" for the duplication check in FR-2 — exact text match, semantic similarity, or same template+theme combination? | Affects both AI prompt design and validation logic | Recommend semantic similarity (embedding-based) over exact match, since AI-generated variations rarely repeat verbatim |
| OQ-3 | Who/what triggers content generation — a schedule (e.g., daily at 8am), a manual "generate now" action, or both? | Not specified in the brief; materially affects the scheduler design in Document 02 | Recommend both: scheduled generation as default, manual trigger always available from the dashboard |
| OQ-4 | What happens when a platform's publish verification (FR-9) fails but the content *was* actually posted (a false negative)? | Risk of duplicate posting on retry | Verification and retry logic must distinguish "unknown state" from "confirmed failure" — covered in detail in Document 04 (Pipeline Design) |

---

## 12. Industry Best Practices Applied

- **Adapter/Strategy pattern** for platform and AI provider integration — standard practice for systems anticipating multiple interchangeable backends
- **Outbox/staged persistence pattern** — persist before queue, queue before execute, so no stage's failure can lose prior work
- **Idempotency keys** for job execution — standard for any queue-based system where retries are expected
- **Tenant-aware schema from day one** — well-established SaaS engineering practice ("multi-tenant by default, single-tenant by configuration") to avoid the single most common rewrite trigger in tools that "become" SaaS
- **API versioning from the first endpoint** — avoids breaking changes being discovered only when a public API is eventually exposed

---

## 13. Production Considerations

- Secrets (AI API keys, platform OAuth tokens) must never live in source control or plaintext config — environment-based secret management from day one, even for a single user
- Every publish action must be logged with enough detail to answer "what got posted, where, and why" six months later without guessing
- The system must degrade gracefully: if one platform's API is down, other platforms' publishing continues unaffected
- Retry policies need explicit caps (max attempts, backoff schedule) — infinite silent retries are a production incident waiting to happen

---

## 14. Recommendations

1. **Resolve OQ-1 before Document 04 (Pipeline Design)** — it materially changes the pipeline's state machine (adds an "awaiting approval" state).
2. Proceed to **Document 02: System Architecture** next, since several decisions here (tenant-shaped schema, adapter pattern, queue-based pipeline) need full technical specification before database or API design can be finalized.
3. Treat the 2-provider AI abstraction and 3-platform adapter set as the **minimum viable proof** of the abstraction claims in this document — do not accept "abstracted" as true until at least 2 real implementations exist behind each interface.

---

**End of Document 01 — Vision & Scope**