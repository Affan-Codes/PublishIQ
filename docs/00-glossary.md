# 00 — Glossary

**Status:** Approved
**Version:** 1.0
**Last revised:** 2026-07-04
**Owning document:** This file. No other document may redefine a term listed here (PROJECT_DECISIONS.md, Section 35).

---

## Purpose and Scope

This glossary is the single source of truth for domain terminology across every document in this project. It exists because PROJECT_DECISIONS.md, Section 35, requires it to be generated before any other documentation, and requires every other document to reference these definitions rather than restate or paraphrase them.

This file does **not** repeat architectural rationale, trade-offs, or decision history already recorded in PROJECT_DECISIONS.md — each entry below links back to the section that owns the underlying decision. Where a term's full behavior is more nuanced than a short definition can convey, that nuance lives in PROJECT_DECISIONS.md or a later document, and this glossary points to it rather than duplicating it.

**Rule for all future documents:** if a document needs a new term not listed here, that term must be added to this file first, in a reviewed and approved update, before it appears anywhere else. A term appearing in a spec without first appearing here is a process violation (PROJECT_DECISIONS.md, Section 35), not a minor oversight.

Entries are grouped by domain area for readability, then listed alphabetically within each group. A term used across multiple groups appears once, in the group it most fundamentally belongs to, with cross-references from related entries.

---

## 1. Scoping & Organization

### Workspace
The single canonical top-level scoping entity in the system. Every other entity in the platform — Channels, Content Profiles, Content Types, Prompts, Templates, Assets, Jobs, Platform Connections, Feature Flags, and System Configuration — belongs to exactly one Workspace. A Workspace is a flat scoping boundary, not a containment hierarchy: entities within a Workspace reference each other in a graph, not a strict parent-child tree. Only one Workspace exists in v1; the platform is architected so that a second Workspace requires no schema retrofit.
*Defined in: PROJECT_DECISIONS.md, Section 26.*

---

## 2. Content Configuration

### Content Type
A reusable, first-class entity representing what *kind* of content is being generated — for example, Shayari, Motivational Quote, Business Quote, Festival Wish, or Poetry. A Content Type is configuration data referenced by a Content Profile. It is never a hardcoded conditional inside pipeline, worker, or rendering code — the platform must remain content-type-agnostic at the code level.
*Defined in: PROJECT_DECISIONS.md, Section 10.*

### Content Profile
A first-class entity that owns the complete configuration for a specific kind of generated content: its pinned Prompt Version, Prompt Variables, Language, Content Type reference, Tone, Writing Style, pinned Image Template Version, Branding Rules, Watermark Rules, Caption Strategy, Hashtag Strategy, Music Selection Rules, Rendering Configuration, and additive Validation Rules. A Content Profile is referenced by one or more Channels; it is never duplicated or forked per Channel.
*Defined in: PROJECT_DECISIONS.md, Section 11.*

### Validation Rule
A profile-level constraint layered on top of the platform's global validation checks (Section 3 of this glossary group, "Global Validation"). Validation Rules can only tighten what global validation already enforces — they can never loosen or bypass a global check.
*Defined in: PROJECT_DECISIONS.md, Section 6.2, Section 11.*

---

## 3. Prompts & Templates

### Prompt
A reusable, first-class resource that defines the instructions sent to an AI Provider to generate content. Prompts are referenced by Content Profiles, never duplicated across them. A Prompt carries Version, Created Date, Modified Date, Status, and Notes, and supports Rollback to any previous version at the library level.
*Defined in: PROJECT_DECISIONS.md, Section 12.*

### Prompt Version
An immutable snapshot of a Prompt at a point in time. Updating a Prompt always creates a new Prompt Version; existing versions are never mutated in place. A Content Profile always references one specific, pinned Prompt Version — never "latest." A Prompt Version keeps being used by every Content Profile pinned to it until a person explicitly repoints that profile to a different version.
*Defined in: PROJECT_DECISIONS.md, Section 12.1.*

### Template
A React component (rendered via the pipeline described under "Rendering Pipeline" below) that defines the visual layout used to turn generated text into an image. Templates are versioned resources referenced indirectly by Channels, through their Content Profile's Image Template field.
*Defined in: PROJECT_DECISIONS.md, Section 13.*

### Template Version
An immutable snapshot of a Template at a point in time. Updating a Template always creates a new Template Version; existing versions are never mutated in place. A Content Profile always references one specific, pinned Template Version — never "latest." Rollback at the Template Library level changes only what new profiles are offered by default; it never silently moves an already-pinned profile.
*Defined in: PROJECT_DECISIONS.md, Section 13.1.*

---

## 4. Assets

### Asset
A first-class entity representing any reusable media resource consumed by the rendering or music-selection process: Backgrounds, Fonts, Music, Logos, Watermarks, Animations, Icons, or a future asset type. Every Asset carries a metadata record and an Enabled/Disabled state, and is referenced — never duplicated — by Content Profiles.
*Defined in: PROJECT_DECISIONS.md, Section 9.2.*

---

## 5. Channels, Platforms & Publishing

### Channel
A first-class entity representing one destination and configuration for publishing. A Channel owns a Name/identity, a reference to exactly one Content Profile, one or more Platform Connection references, a Schedule, an Automation Mode, and Publishing Configuration. Channels are fully independent of one another even when two Channels share the same Content Profile. Every Channel belongs to exactly one Workspace.
*Defined in: PROJECT_DECISIONS.md, Section 14.*

### Platform Connection
An entity storing the credentials and status needed to publish to an external platform: Platform, Access Token, Refresh Token, Expiry, Permissions/scopes, Health Status, and the owning Workspace. A Channel references one or more Platform Connections; a Channel does not own authentication state directly.
*Defined in: PROJECT_DECISIONS.md, Section 15.*

### Automation Mode
A per-Channel setting selecting how that Channel moves from content generation to publication. Three modes exist: **Manual** (Generate → Preview → Publish), **Automatic** (Generate → Publish, no human checkpoint), and **Hybrid** (Generate → hold for approval → Publish after approval). An Automation Mode selects which already-enabled behavior a Channel uses; it is distinct from a Feature Flag, which controls whether a capability exists in the system at all.
*Defined in: PROJECT_DECISIONS.md, Section 16.*

### Publishing Adapter
The Provider-layer component responsible for integrating with one specific external publishing platform. Each Publishing Adapter owns its own Platform Limits (maximum caption length, supported media types, aspect ratio, video duration limits, thumbnail rules, hashtag rules). The publishing pipeline itself never hardcodes platform-specific rules; changing a platform's rules means editing only that platform's adapter.
*Defined in: PROJECT_DECISIONS.md, Section 22, Section 25.*

---

## 6. AI & Rendering

### Provider
A Provider is the adapter-layer abstraction for any external integration the platform depends on — an AI Provider (e.g., Gemini) or a Publishing Adapter (see above) are both Providers. All calls to an external AI system go through a Provider adapter interface; only the Gemini adapter is implemented in v1. Providers are replaceable without leaking implementation details upward into Services.
*Defined in: PROJECT_DECISIONS.md, Section 5, Section 25, Section 31.*

### Rendering Pipeline
The fixed sequence that turns generated text into a final video file: a React Template is rendered by headless Chromium via Playwright into a PNG, then FFmpeg converts that PNG into a short vertical video with lightweight animation and attached music. This sequence is frozen and does not vary by Content Type.
*Defined in: PROJECT_DECISIONS.md, Section 7, Section 7.1.*

### Storage Provider
The abstraction layer behind which the platform's file storage backend sits. Local disk is the only implemented Storage Provider in v1; migration to Cloudflare R2 or S3 requires only a new provider behind the existing interface, no application-level rewrite. Storage Provider selection is a System Configuration value.
*Defined in: PROJECT_DECISIONS.md, Section 21, Section 27.*

---

## 7. Jobs, Queueing & State

### Job
A single queued unit of work processed by a Worker through BullMQ. Every Job belongs to exactly one Job Type and to exactly one Workspace. On any failure, a Job's Stage, Reason, Retry Count, and Timestamp are recorded — no Job fails silently.
*Defined in: PROJECT_DECISIONS.md, Section 17, Section 18, Section 19.*

### Job Type
The classification of what kind of work a Job performs. v1 recognizes exactly two categories: the single **Content Pipeline Job** (see below), and a set of **Independent Job Types** (Cleanup, Archive, Retry Publish, Token Refresh, Health Check, and future maintenance jobs). All Job Types share the same Worker/Queue infrastructure and the same failure-recording discipline.
*Defined in: PROJECT_DECISIONS.md, Section 18.*

### Content Pipeline Job
The single BullMQ Job Type that carries out the full generate-through-publish workflow as one job record, progressing through the 13-state machine defined under "Job State Machine" below. It does not fan out into separate jobs for content generation, image generation, video generation, or publishing — those are internal stages of this one Job Type, not independent Job Types.
*Defined in: PROJECT_DECISIONS.md, Section 18.1.*

### Independent Job Type
Any Job Type other than the Content Pipeline Job: Cleanup, Archive, Retry Publish, Token Refresh, Health Check, or a future maintenance job. Each Independent Job Type is separately queued, separately retried, and governed by its own simpler state machine — none require the Content Pipeline Job's 13 states.
- **Retry Publish** — a standalone re-attempt of the Publishing stage, invoked outside the main Content Pipeline Job. Distinct from a Content Pipeline Job's own internal retry of its Publishing state.
- **Token Refresh** — refreshes a Platform Connection's Access/Refresh Token ahead of, or upon, expiry.
- **Health Check** — periodic verification of Platform Connection health status and AI Provider adapter availability.
- **Cleanup** and **Archive** — routine housekeeping jobs, exact states deferred to their own job-type specs.
*Defined in: PROJECT_DECISIONS.md, Section 18.2.*

### Job State Machine
The 13-state lifecycle scoped exclusively to the Content Pipeline Job Type: Draft, Generating Content, Validating, Generating Image, Generating Video, Selecting Music, Generating Caption, Generating Hashtags, Queued, Publishing, Published, Failed, Archived. Independent Job Types do not use this state machine.
*Defined in: PROJECT_DECISIONS.md, Section 19.*

---

## 8. Configuration, Events & Notifications

### Feature Flag
A workspace-scoped, runtime-evaluated configuration value that gates whether a capability exists in the system at all — for example, Enable AI Provider, Enable Platform, Enable Approval Mode, Enable Auto Publish, Enable Experimental Features. A Feature Flag is never a compiled-in conditional. Contrast with Automation Mode, which selects among capabilities a Feature Flag has already enabled.
*Defined in: PROJECT_DECISIONS.md, Section 20.*

### System Configuration
A workspace-scoped entity holding values that must never exist as hardcoded constants in code — for example, Default AI Provider, Retry Limits, Global Prompt Variables, Default Video Duration, Rendering Settings including render concurrency, Default Fonts, Timezone, and Storage Provider selection. The architectural home for these values is fixed by this entity even where specific values are still deferred to implementation.
*Defined in: PROJECT_DECISIONS.md, Section 21.*

### Domain Event
An immutable record of a meaningful thing that happened in the system, kept for history and future automation — distinct from application/debug logs. Examples: ContentGenerated, ImageGenerated, VideoGenerated, PublishStarted, PublishSucceeded, PublishFailed, PromptUpdated, ProfileUpdated, ChannelCreated. A Job's `status` field represents its current state; Domain Events represent the immutable history of transitions that produced that state. A Job transitioning to Failed emits a corresponding event — the event log never independently re-detects a condition the state machine already detected.
*Defined in: PROJECT_DECISIONS.md, Section 23.*

### Notification
An in-app (and, in the future, email/Slack/Discord) message triggered strictly as a downstream consumer of a Domain Event — for example, Job Failed, Publishing Failed, Token Expiring, Retry Exhausted, Approval Required. A Notification is never produced by an independent detection mechanism polling for the same condition a Domain Event already represents.
*Defined in: PROJECT_DECISIONS.md, Section 24.*

---

## 9. Module Ownership Layers

These terms name the seven architectural layers every piece of backend code belongs to exactly one of. Full responsibility boundaries are defined in PROJECT_DECISIONS.md, Section 25; this glossary entry exists only so later documents can reference the layer names consistently.

- **Controller** — HTTP handling only.
- **Service** — business logic only.
- **Repository** — database access only.
- **Worker** — queue/job processing only, for any Job Type.
- **Provider** — external integrations only (see "Provider" above).
- **Template** — rendering only (see "Rendering Pipeline" above).
- **Utility** — pure helper functions only.

*Defined in: PROJECT_DECISIONS.md, Section 25.*

---

## Change Control

This glossary follows the same amendment discipline as PROJECT_DECISIONS.md: no term's definition may be silently changed. Adding a new term or revising an existing definition requires an explicit, approved update to this file, logged with a version bump, before that term or revised meaning may be used anywhere else in the documentation set.
