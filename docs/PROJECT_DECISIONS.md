# PROJECT_DECISIONS.md

**Status:** FROZEN — FINAL
**Version:** 2.3
**Last revised:** 2026-07-18

This document is the constitution of the project. Every future document, diagram, schema, and line of code must conform to the decisions recorded here. No future document may contradict this file. Any change to a decision listed here requires explicit, written approval from the project owner before it takes effect — no exceptions, no silent drift.

---

## Revision Log

- **v1.0** — Initial freeze: project identity, content rules, publishing volume, AI providers, validation, media generation, languages, music, channels, automation modes, scheduling, job pipeline, multi-tenancy, storage, deployment, testing, principles.
- **v1.1** — Introduced Content Profiles; re-scoped Channels; added Prompt Library & versioning, Template versioning, Asset Library, Platform Connections, Dashboard module freeze, Module Ownership, structured AI response format, local-first/no-Kubernetes deployment freeze. Softened E2E testing exclusion.
- **v2.0** — Introduced Workspace as the top-level scoping entity (standardizing prior "tenant/workspace" language); introduced Content Types (replacing the free-text Category field on Content Profile); introduced Job Types (re-scoping the existing job state machine to one job type among several); introduced Feature Flags, System Configuration, Domain Events, Notifications, explicit Platform Limits ownership, API Versioning, and dedicated Coding Principles / Development Philosophy statements. Four conflicts identified and resolved during this revision — see inline "v2.0 conflict resolution" notes at Sections 2, 11, 12, 20/22.
- **v2.1** — Froze Prompt/Template version pinning: Content Profiles must always reference a specific, pinned version and never "latest"; resolved the corresponding open item. Introduced the mandatory `docs/00-glossary.md` requirement governing all future documentation. Final consistency audit performed — no contradictions, duplicate concepts, or terminology drift found at that time.
- **v2.2 (final)** — Consistency audit ahead of documentation generation surfaced two defects in v2.1: (1) Section 18 listed "Generate Content," "Generate Image," "Generate Video," and "Publish" as four independent Job Types while simultaneously describing Section 19's state machine as belonging to one single, unnamed job — an internal contradiction, since four independently-queued jobs cannot also be the discrete internal states of one job's lifecycle; (2) Section 18's narrative text miscounted Section 19's state diagram as having 12 states when it has 13. Both corrected. **Decision (approved by project owner): Option C.** The system uses a single BullMQ Job Type, the **Content Pipeline Job**, which progresses through the 13 internal stages defined in Section 19. Generate Content / Generate Image / Generate Video / Publish are internal pipeline stages, not independent Job Types. Cleanup, Archive, Retry Publish remain independent Job Types; **Token Refresh** and **Health Check** are added as new independent Job Types. Documentation generation order reconfirmed unchanged: `docs/00-glossary.md` remains the first documentation file, per Section 35, generated before `01-vision-and-scope.md` and every other document. Final consistency audit performed post-correction — no remaining contradictions, duplicate concepts, or terminology drift found.
- **v2.3 (audit remediation)** — Resolved pipeline state count discrepancies: updated Section 19's state machine to 14 states (incorporating the `Running` state and clean names matching code) and removed dead stages (`GeneratingImage`, `GeneratingVideo`, `SelectingMusic`, `Published`) from the database schema. Documented single hardcoded React layout as the primary v1 rendering path (Section 7.1/13.1), utilizing `TemplateVersion` tracking for future extensibility. Formally approved multi-user roles (`Owner`, `Administrator`, `User`) and authorization middleware scope adjustments (Section 1). Registered Facebook Page publishing as a fully integrated platform connection channel (Section 24). Registered Node.js native test runner (`node:test`) and `tsx` execution as the validated tech stack choice (Section 31).

---

## 1. Project Identity

- **Type:** Content generation and publishing automation platform. Not an AI video editor, not a social media management suite.
- **Initial users:** One (the owner), within one Workspace (Section 26). No second user, editor, or assistant account for the first 3–6 months.
- **Long-term intent:** SaaS-ready. Foundations must support multiple Workspaces, but billing, organizations, and subscription features are explicitly **out of scope** for v1.
- **Cost posture:** Operational cost as close to zero as reasonably possible without violating engineering standards.

---

## 2. Development Philosophy (v2.0 addition)

This project values, in this order of priority when tradeoffs arise:

1. Simplicity
2. Maintainability
3. Modularity
4. Predictability
5. Developer Experience
6. Operational Cost

...over premature optimization. This philosophy is the lens through which every ambiguous future decision should be evaluated — when two technical options are otherwise comparable, the one that scores higher on this list wins. Section 25 (Core Principles) operationalizes this philosophy into concrete engineering rules; this section is the "why," that section is the "how."

---

## 3. Content Rules

- Business and motivational quotes must **never** be attributed to a real, named person unless the attribution is verifiably correct.
- If attribution cannot be confirmed, the system generates original, unattributed content instead.
- The platform must never fabricate a quote and assign it to a real person.

---

## 4. Publishing Volume

- Target: **2–4 published videos/day** across all channels combined, initially.
- **Known external constraint:** YouTube Data API v3's default quota makes ~6 uploads/day the practical ceiling before a quota increase request to Google is required.

---

## 5. AI Providers

- **Primary provider:** Gemini, selected for lowest operational cost.
- **Failure handling:** Retry on failure; if retries are exhausted, mark **Failed** — no automatic fallback to a different provider.
- **Provider architecture:** All AI calls go through a provider adapter interface. Only the Gemini adapter is implemented in v1.
- **Provider selection scope:** Global for v1; per-profile provider configuration is a planned future capability.

### 5.1 AI Response Format
All AI provider adapters must return **structured JSON**, validated against a defined schema — never free-form text parsed after the fact. Exact schema fields are deferred to the AI integration spec; the JSON-in/JSON-out contract is frozen here.

---

## 6. Content Validation

Validation for v1 consists of exactly these checks, applied globally to every job regardless of Content Profile:

- Empty output check
- Length validation
- Formatting validation
- Platform-specific limits (see Section 22, Platform Limits)
- Basic profanity filtering
- Exact duplicate detection (normalized-hash)

**Explicitly rejected for v1:** semantic similarity detection, embeddings, vector databases.

### 6.1 Duplicate detection normalization
Content is normalized before hashing (lowercase, strip punctuation, collapse whitespace); the normalized hash is compared and stored. This remains exact-match logic, not semantic similarity.

### 6.2 Relationship to Content Profile "Validation Rules"
Global validation always runs, unconditionally, for every job. Profile-level validation rules are additive, profile-specific constraints layered on top and can only tighten, never loosen or bypass, a global check.

- Regeneration on duplicate: automatic regeneration until unique content is produced or a retry limit is reached (retry limit value lives in System Configuration — Section 21). On exhaustion, job is marked **Failed** at the validation stage.

---

## 7. Media Generation & Rendering Pipeline

```
Generate text
  ↓
Render text onto a black background, white typography
  ↓
Optional branding/logo/watermark
  ↓
Generate PNG
  ↓
Convert PNG into a short vertical video
  ↓
Apply lightweight animation only
  ↓
Attach music
  ↓
Done
```

### 7.1 Rendering pipeline — FROZEN

```
React Template
  ↓
Playwright (headless Chromium render)
  ↓
PNG
  ↓
FFmpeg
  ↓
Final Video
```

React templates are chosen over manual SVG/Sharp text rendering because browser engines correctly handle RTL and complex-script shaping (Urdu Nastaliq, Hindi Devanagari) out of the box. Render concurrency remains bounded (v1 target: 1–2 concurrent render jobs; exact value lives in System Configuration).

---

## 8. Languages

- v1 priority: **English, Hindi, Urdu.**
- Language is a **Content Profile** attribute.
- Nastaliq (Urdu) and Devanagari-complete (Hindi) fonts must be sourced and licensed before any Urdu/Hindi profile goes live.

---

## 9. Music & Asset Management

### 9.1 Music
- Sourced only from a local library. No platform music APIs.
- Every track's metadata: Mood, Language, Genre, Duration, License, Enabled/Disabled.
- Selection is rule-based, configurable per Content Profile.
- Tracks without confirmed licensing must not be selectable.

### 9.2 Asset Library
Assets are first-class entities: Backgrounds, Fonts, Music, Logos, Watermarks, Animations, Icons, future types. Every asset type carries a metadata record plus Enabled/Disabled, and is referenced (never duplicated) by Content Profiles.

---

## 10. Content Types (v2.0 addition — resolves Conflict 2 with Section 11's Category field)

**Content Type** is a reusable, first-class entity representing what kind of content is being generated — e.g., Shayari, Motivational Quote, Business Quote, Festival Wish, Poetry, and future AI-generated types.

- **v2.0 conflict resolution:** Content Profile's previously free-text `Category` field (v1.1) is replaced by a reference to a Content Type entity. A loose string field cannot guarantee the pipeline stays content-type-agnostic; a referenced entity can.
- The publishing pipeline, job workers, and rendering pipeline must never branch on a hardcoded content type name — Content Type is configuration data consumed by a Content Profile, never a code-level conditional.

---

## 11. Content Profiles (v2.0 — Category field superseded by Content Type reference)

A Content Profile owns:

- Prompt (referenced from the Prompt Library — Section 12) — **references a specific, pinned Prompt Version. Never "latest."**
- Prompt Variables
- Language
- **Content Type** (reference — Section 10; supersedes the v1.1 free-text Category field)
- Tone
- Writing Style
- Image Template (referenced — Section 13) — **references a specific, pinned Template Version. Never "latest."**
- Branding Rules
- Watermark Rules
- Caption Strategy
- Hashtag Strategy
- Music Selection Rules
- Rendering Configuration
- Validation Rules (additive constraints only — Section 6.2)

**Relationship to Channels:** A Channel references exactly one Content Profile. Multiple channels may reference the same profile; profile updates propagate to every referencing channel on next run. No per-channel override or fork of a profile in v1.

---

## 12. Prompt Library & Versioning

Prompts are reusable, first-class resources referenced by Content Profiles — never duplicated across profiles. Every prompt supports Version, Created Date, Modified Date, Status, Notes, and Rollback to any previous version.

### 12.1 Version pinning — FROZEN (v2.1; resolves the previously open item)
Updating a Prompt creates a **new version**; existing versions are never mutated in place. A Content Profile **must always reference a specific Prompt Version** — it must never automatically track "latest." When a Prompt is updated, every Content Profile currently pinned to an older version keeps using that exact version until someone explicitly repoints it to the new one. "Rollback" at the Prompt Library level (marking an older version as current) governs only what new profiles are offered by default going forward — it has no effect on already-pinned profiles, which never move on their own. This guarantees deterministic behavior, reproducibility, rollback capability at the profile level, auditing, and predictable deployments.

---

## 13. Template Versioning

Image templates (React templates feeding Section 7.1) are versioned: Template Version, Created Date, Status, Rollback. Channels reference a template version indirectly, via their Content Profile's Image Template field.

### 13.1 Version pinning — FROZEN (v2.1; resolves the previously open item)
Updating a Template creates a **new version**; existing versions are never mutated in place. A Content Profile **must always reference a specific Template Version** — never "latest." Existing profiles continue using their currently pinned Template Version until explicitly updated to a new one. Rollback at the Template Library level affects only what new profiles are offered by default; it never silently moves an already-pinned profile. Same rationale as Section 12.1: determinism, reproducibility, auditability, predictable deployments.

---

## 14. Channels

A Channel owns:
- Name/identity
- Content Profile reference (Section 11)
- Platform Connection reference(s) (Section 15)
- Schedule
- Automation Mode (Section 16)
- Publishing Configuration (posting-order/connection-targeting parameters that aren't content-behavior)

Channels remain fully independent of one another, even when sharing a Content Profile. Every Channel belongs to exactly one Workspace (Section 26).

---

## 15. Platform Connections

A Platform Connection stores: Platform, Access Token, Refresh Token, Expiry, Permissions/scopes, Health Status, and **Owner (Workspace)** — standardized terminology, see Section 26.

Channels reference one or more Platform Connections; they do not own authentication state directly.

---

## 16. Automation Modes

- **Manual:** Generate → Preview → Publish.
- **Automatic:** Generate → Publish, no human checkpoint.
- **Hybrid:** Generate automatically → hold for approval → publish after approval.

Mode is a per-channel setting. **Distinction from Feature Flags (Section 20):** Automation Mode selects *which enabled behavior* a specific channel uses; the "Enable Approval Mode" feature flag controls whether the Hybrid capability exists in the system at all. A flag gates the capability system-wide; the mode selects it per channel.

---

## 17. Scheduling

- **BullMQ only.** node-cron is explicitly rejected.
- Handles scheduling, delayed jobs, retries, backoff, repeatable jobs.
- Schedule state lives in Redis, surviving process restarts.

---

## 18. Job Types (v2.0 addition; corrected v2.2 — resolves Conflict 3 with Section 19's state machine)

Job Type classifies what a queued unit of work does. v1 recognizes exactly two categories of Job Type.

### 18.1 Content Pipeline Job (single Job Type, internally staged)

The full generate-through-publish workflow — text generation, validation, image generation, video generation, music selection, caption generation, hashtag generation, queuing, and publishing — is implemented as **one BullMQ Job Type**: the **Content Pipeline Job**. It does not fan out into separate Generate Content / Generate Image / Generate Video / Publish jobs. Its progression is governed entirely by the 13-state machine defined in Section 19; each transition happens inside the lifecycle of the same underlying job record, not across independently queued jobs.

**v2.2 correction (Option C, approved by project owner):** Prior revisions listed "Generate Content," "Generate Image," "Generate Video," and "Publish" as four separate Job Types alongside the Section 19 state machine, while Section 19's own conflict-resolution note described that state machine as belonging to a single, unnamed "Content Publishing Job." This was an internal contradiction — four independently-queued job types cannot simultaneously be the discrete internal states of one job's lifecycle. Resolved as follows: those four items were never independent Job Types. They are internal pipeline stages of the single Content Pipeline Job and are removed from the Job Type list.

**Rationale:** A single staged job minimizes orchestration complexity. No saga/coordinator layer is required to hand work between independently queued jobs; no risk of an orphaned partial pipeline if one stage's queue backs up independently of another; BullMQ's native job-state and progress-reporting facilities are sufficient to track progress through Section 19's 13 states. This is the simplest design satisfying Section 33 Principle 6 (no job or pipeline stage fails silently) without introducing distributed coordination the project does not yet need — consistent with Section 2's philosophy ranking (Simplicity, Maintainability, Modularity ahead of premature scalability).

**Trade-off, explicitly acknowledged:** A single long-lived job cannot be independently retried, rate-limited, or horizontally scaled per stage. Video rendering (CPU-bound, Playwright + FFmpeg) cannot be scaled independently of caption generation (I/O-bound, waiting on an external AI provider) if both live inside one job's execution. At v1's volume target (Section 4: 2–4 published videos/day), this is an acceptable trade-off, not an oversight.

**Future path (already anticipated, not yet decided):** If per-stage independent scaling is later justified, pipeline stages may be decomposed into independent Job Types without changing the higher-level architecture: Workers still consume BullMQ per Section 25, Domain Events per Section 23 already fire at each meaningful transition, and no schema redesign is required — only new Job Type definitions and a router replacing in-job stage transitions with job-to-job handoffs. This decomposition is **not authorized now**; it requires a future, explicitly approved revision to this document before implementation.

### 18.2 Independent Job Types

The following are independent, separately queued and separately retried BullMQ Job Types, each with its own simpler state machine (defined at the job-type spec stage; none require Section 19's 13 states):

- **Cleanup**
- **Archive**
- **Retry Publish** — a standalone re-attempt of the Publishing stage, invoked outside the main Content Pipeline Job. Distinct from a Content Pipeline Job's own internal retry of its Publishing state, which happens inside that job's lifecycle and does not use this Job Type.
- **Token Refresh** (v2.2 addition) — refreshes a Platform Connection's Access/Refresh Token ahead of, or upon, expiry (Section 15).
- **Health Check** (v2.2 addition) — periodic verification of Platform Connection health status and AI Provider adapter availability.
- Future maintenance jobs.

All Job Types — the single Content Pipeline Job and every independent maintenance job — share the same Worker/Queue infrastructure (Section 17, BullMQ) and the same failure-recording discipline (Stage, Reason, Retry Count, Timestamp).

---

## 19. Job Pipeline & State Machine (scoped to the Content Pipeline Job Type — see Section 18.1)

```
Draft → Queued → Running → GeneratingContent → Validating → RenderingImage →
AttachingMusic → RenderingVideo → GeneratingCaption → GeneratingHashtags →
Publishing → Completed
            ↘ Failed
            ↘ Archived
```

**This state machine defines exactly 14 states:** Draft, Queued, Running, GeneratingContent, Validating, RenderingImage, AttachingMusic, RenderingVideo, GeneratingCaption, GeneratingHashtags, Publishing, Completed, Failed, Archived. (v2.3 correction: updated from 13 to 14 states to align with running state machine and codebase implementation).

On any failure: **Stage**, **Reason**, **Retry count**, **Timestamp** are recorded. No job fails silently.

---

## 20. Feature Flags (v2.0 addition)

The architecture supports feature toggles without code changes. Examples: Enable AI Provider, Enable Platform, Enable Approval Mode, Enable Auto Publish, Enable Experimental Features.

Feature Flags are workspace-scoped configuration data (stored alongside System Configuration, Section 21), read by services at runtime — never compiled-in conditionals. See Section 16 for the distinction between a flag (system-wide capability gate) and a per-channel mode/setting (behavior selection among enabled capabilities).

---

## 21. System Configuration (v2.0 addition)

A System Configuration entity holds values that must never be hardcoded constants. Examples: Default AI Provider, Retry Limits (generation, duplicate-regeneration, publish), Global Prompt Variables, Default Video Duration, Rendering Settings (including render concurrency), Default Fonts, Timezone, Storage Provider selection.

This formally resolves several items previously deferred as "open items" in prior versions of this document (retry-limit values, render concurrency values) — their exact values are still deferred to implementation, but their **architectural home** is now fixed: they live in System Configuration, not scattered constants in code.

---

## 22. Platform Limits (v2.0 addition)

Every publishing adapter (Section 24, Providers row) owns its own validation rules — the publishing pipeline itself never hardcodes platform-specific rules. Examples per adapter: maximum caption length, supported media types, aspect ratio, video duration limits, thumbnail rules, hashtag rules. Adding or changing a platform's rules means editing that platform's adapter only — never the pipeline that calls it.

---

## 23. Domain Events (v2.0 addition)

Beyond application/debug logs, the system emits domain events representing meaningful things that happened, for history and future automation — not for debugging. Examples: ContentGenerated, ImageGenerated, VideoGenerated, PublishStarted, PublishSucceeded, PublishFailed, PromptUpdated, ProfileUpdated, ChannelCreated.

**Relationship to the Job state machine (Section 19):** the job's `status` field represents current state; Domain Events represent an immutable history of what happened and when. A job transitioning to Failed **emits** a corresponding event (e.g., PublishFailed) — the event log is not a second, independent place that separately detects failures.

---

## 24. Notifications (v2.0 addition — resolves Conflict 4 with Domain Events)

An in-app notification system is introduced now, even with one user, so the architecture doesn't require a redesign later. Examples: Job Failed, Publishing Failed, Token Expiring, Retry Exhausted, Approval Required.

**v2.0 conflict resolution:** Notifications are strictly downstream **consumers** of Domain Events (Section 23) — a notification is triggered by an event being emitted, never by an independent detection mechanism polling for the same condition. This keeps failure/state-change detection in exactly one place. Future channels (email, Slack, Discord) are added as new notification-delivery adapters subscribing to the same event stream — no redesign required.

---

## 25. Module Ownership

| Layer | Responsibility | Must NOT contain |
|---|---|---|
| **Controllers** | HTTP handling only | Business logic, direct DB access |
| **Services** | Business logic only | HTTP concerns, direct SQL/ORM outside repositories |
| **Repositories** | Database access only | Business logic, validation rules |
| **Workers** | Queue/job processing only, for any Job Type (Section 18) | Business logic beyond job-orchestration |
| **Providers** | External integrations only (AI, publishing platforms — including their own Platform Limits, Section 22 — storage) | Business logic, direct DB access |
| **Templates** | Rendering only | Data fetching, business logic |
| **Utilities** | Pure helper functions only | State, DB access, external calls |

---

## 26. Workspaces (v2.0 — supersedes v1.0/v1.1 "Multi-Tenancy," resolves Conflict 1 and standardizes terminology)

**Workspace** is the single canonical top-level scoping entity, replacing the earlier hedge-term "tenant/workspace." Every entity in the system belongs to a Workspace: Channels, Content Profiles, Content Types, Prompts, Templates, Assets, Jobs, Platform Connections, Feature Flags, and System Configuration are all Workspace-scoped.

**v2.0 conflict resolution — hierarchy vs. reuse:** The dependency/reading order below is **not** a strict ownership/containment tree — it describes typical reference direction, not parent-child database structure:

```
Workspace
  → Channels
  → Content Profiles
  → Jobs
  → Publishing
  → Assets
  → Platform Connections
```

This cannot be a literal containment tree because Content Profiles are already frozen (Section 11) as many-to-one with Channels (multiple channels reference one profile), and Assets are referenced, not owned, by profiles. The correct model is: **Workspace is a flat scoping boundary; everything else is a reference graph within it.** Only one Workspace exists in v1, but every table/entity carries a Workspace identifier from day one, so no retrofit is needed later.

- Billing, organization management, and subscription logic remain **out of scope** for v1 — only schema-level Workspace scoping is built now.

---

## 27. Storage

- v1 default: local disk storage, wherever practical, behind a storage provider abstraction (local disk is the only implemented provider initially).
- Migration to Cloudflare R2 or S3 requires no application-level rewrites — only a new provider behind the existing interface.
- Storage Provider selection itself lives in System Configuration (Section 21).

---

## 28. Deployment — Local-First Strategy

```
Development:        Docker Compose (local machine)
        ↓
Initial Production:  Docker Compose (same containers, VPS host)
        ↓
Future Scaling:      Container orchestration — IF AND WHEN JUSTIFIED
```

Kubernetes (or any orchestration platform) is explicitly excluded at this stage. No serverless/edge-function architecture anywhere in this pipeline — FFmpeg, Playwright, and BullMQ workers all require persistent, long-running processes.

---

## 29. API Versioning (v2.0 addition)

Every public API endpoint is versioned from the start: `/api/v1/...`. Future versions coexist with prior versions rather than replacing them — a breaking change ships as `/api/v2/...` alongside the still-running `/api/v1/...`, with an explicit deprecation policy defined later, not silently retired.

---

## 30. Dashboard Modules — FROZEN (carried from v1.1; not modified this round)

1. Dashboard (overview)
2. Channels
3. Content Profiles
4. Jobs
5. Queue
6. Publishing History
7. Templates
8. Assets
9. Platform Connections
10. Logs
11. Settings

**Note (v2.0):** New entities introduced this round (Workspace, Content Types, Feature Flags, System Configuration, Notifications) are not yet reflected in this list. This is deliberate — you asked that dashboard modules not be reorganized this round. It is logged as an open item (Section 34) for the next dashboard-focused revision, not decided here.

---

## 31. Coding Principles (v2.0 addition — engineering-level rules, distinct from Section 2's philosophy and Section 33's Core Principles)

- Prefer composition over inheritance.
- Avoid singleton services.
- Avoid circular dependencies.
- Every module has a single responsibility.
- Every service is independently testable.
- Every provider is replaceable (adapter interfaces, no leaked implementation details upward).
- Configuration is never hardcoded — it lives in System Configuration (Section 21) or Feature Flags (Section 20).

---

## 32. Testing

- **Unit tests** for pure logic: validation rules, duplicate-hash normalization, music-selection rule engine, state-machine transitions.
- **Integration tests** for pipeline stages touching external systems, using mocked/stubbed adapters, not live API calls in CI.
- **E2E testing is optional for v1 and may be introduced later based on project maturity.**
- Test coverage is expected on the job pipeline and state machine specifically.

---

## 33. Core Principles

1. Operational cost stays as close to zero as reasonably possible.
2. Paid services are used only when they provide clearly significant value over free/local alternatives.
3. Local processing is preferred over external services wherever practical.
4. Architecture stays modular; every external integration sits behind an adapter interface; every module respects the ownership boundaries in the Module Ownership table (Section 25).
5. The system is designed for future SaaS conversion, but SaaS complexity is not implemented until actually needed.
6. No job or pipeline stage fails silently — every failure is stateful, attributed to a stage, and inspectable.
7. Reusable content behavior lives in Content Profiles, Content Types, Prompts, and Templates — never duplicated per channel.
8. Coding-level rules (Section 31) and this list together operationalize the Development Philosophy (Section 2).

---

## 34. Open Items Carried Forward (not decisions — flagged for future resolution)

- Confirm Meta Developer app registration and Instagram Content Publishing API access status before building the Instagram publishing adapter.
- Confirm YouTube Data API quota is sufficient for real volume before scaling past ~4-6 uploads/day combined.
- Confirm licensing status of every asset (music, fonts, backgrounds, logos) in the Asset Library before any channel goes live publicly.
- Define the exact structured JSON schema for AI provider responses (Section 5.1).
- Define concrete values for System Configuration entries (retry limits, render concurrency, default video duration, etc.) — architectural home is fixed (Section 21), values are not.
- Define the state machines for the independent Job Types (Cleanup, Archive, standalone Retry Publish, Token Refresh, Health Check) — Section 18.2 establishes they exist and are simpler; exact states are deferred.
- Define the Domain Event schema/payload structure (Section 23).
- Define the Feature Flag storage/evaluation mechanism (DB-backed vs. config file) — Section 20 establishes it's runtime-evaluated, not compile-time.
- Revisit Dashboard Modules (Section 30) to decide whether Workspace, Content Types, Feature Flags, System Configuration, or Notifications warrant their own module or fold into existing ones — explicitly deferred, not decided in v2.0.
- Evaluate, at a future justified scale, whether the Content Pipeline Job (Section 18.1) should be decomposed into independent per-stage Job Types — explicitly not authorized now; requires a future approved revision before implementation.

---

## 35. Documentation Process — Glossary Requirement (v2.1 addition)

Before any further documentation is generated, **`docs/00-glossary.md`** must exist. The Glossary defines every important domain term used across this project's documentation, including but not limited to: Workspace, Channel, Content Profile, Content Type, Prompt, Prompt Version, Template, Template Version, Asset, Platform Connection, Job, Job Type, Provider, Publishing Adapter, Feature Flag, System Configuration, Domain Event, Notification.

Rules governing the Glossary:

- Every future document must reference the Glossary's definitions rather than restating or paraphrasing them.
- No future document may redefine a term already defined in the Glossary — one definition per term, one place it lives.
- New terminology must be added to the Glossary **before** it is used in any other document. A term appearing in a spec without first appearing in the Glossary is a process violation, not a minor oversight.
- `docs/00-glossary.md` is the first documentation file to be generated — before any architecture, database, API, or module-level spec.

---

**End of PROJECT_DECISIONS.md v2.2 — approved by project owner. Frozen. No open contradictions or terminology drift as of this revision.**
