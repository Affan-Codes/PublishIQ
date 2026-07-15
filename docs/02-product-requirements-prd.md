# 02 — Product Requirements (PRD)

**Status:** Draft — pending approval
**Version:** 1.1 (controlled revision — additive only; see Revision Note below)
**Last revised:** 2026-07-04

**Revision Note (v1.0 → v1.1):** This revision adds Functional Requirements for Job Management, Queue Management, Generated Content Management, Prompt/Template/Asset preview capabilities, Publishing History filtering, Global Search, an expanded Dashboard Overview, and an explicit Bulk Operations decision. No existing FR from v1.0 was rewritten, reordered, or removed. Where a new item conflicts with or extends an existing FR's boundary, that is called out explicitly at the point of addition rather than silently merged. Two terminology/architecture gaps surfaced by this revision are flagged prominently in Section 20 (Assumptions Register) and must be resolved before this document is frozen.
**Owning document for:** Functional requirements, acceptance criteria, per-Dashboard-Module functional scope, user-facing behavior specifications, product-level edge cases.
**Does not own:** Technical architecture, database schema, API design, queue topology, UI visual/interaction design (owned by `04-system-architecture.md`, `05-database-schema.md` / equivalent, `06-api-specification.md`, `07-frontend-architecture.md`, as applicable); terminology definitions (owned by `00-glossary.md`); product vision, goals, non-goals, or constraints (owned by `01-vision-and-scope.md`); any frozen constitutional decision (owned by `PROJECT_DECISIONS.md`). Where this document touches those subjects, it references them rather than restating them.

---

## 1. Purpose and Traceability Rule

This document converts the Goals (`01-vision-and-scope.md`, Section 5) and the MVP capability checklist (`01-vision-and-scope.md`, Section 8) into concrete, testable Functional Requirements (FRs).

**Traceability is mandatory and bidirectional:**
- Every FR in this document cites the Goal(s) and/or MVP item(s) it satisfies.
- Every Goal and every MVP item must be covered by at least one FR (verified in Section 10, Traceability Matrix).
- An FR that cannot be traced to Section 5 or Section 8 of `01-vision-and-scope.md` is scope creep and must be rejected or escalated for an explicit revision to that document first — it is not added here quietly.
- A Non-Goal (`01-vision-and-scope.md`, Section 6) is never re-opened by an FR. Where an FR's boundary could be misread as touching a Non-Goal, this document states the boundary explicitly rather than leaving it implicit.

This document specifies **what the system must do and how the operator experiences it** — not how it is built. No schema, no endpoint shape, no library choice, no algorithm, and no performance/latency number appears here unless that number is already frozen in `PROJECT_DECISIONS.md`. Where a technical planning assumption would normally be needed to make an FR concrete (e.g., an exact notification-delivery latency), this document flags it as an **Assumption/Open Item for a later document** (Section 20, Assumptions & Open Items Register) rather than inventing a number.

*(Correction made during the v1.1 revision pass: this cross-reference previously pointed to Section 9 in error — a defect found during this revision's consistency review, not a content change.)*

---

## 2. Requirement Numbering & Format

Requirements are grouped by domain area, numbered `FR-<group>-<seq>`. Each FR includes:

- **Description** — what the operator can do, or what the system does in response to a condition.
- **Trace** — Goal(s) / MVP item(s) from `01-vision-and-scope.md` this FR satisfies.
- **Acceptance Criteria** — observable, testable conditions for "done."
- **Edge Cases** — product-level exceptions the system must handle (not technical failure modes, which belong to later documents).
- **Assumptions** — anything this FR depends on that is not yet frozen elsewhere.

Domain groups (and their Dashboard Module home — `PROJECT_DECISIONS.md`, Section 30):

| Group | Domain Area | Primary Dashboard Module(s) |
|---|---|---|
| WS | Workspace | Settings |
| CFG | Content Configuration (Content Type, Content Profile) | Content Profiles |
| PRM | Prompt Library | Templates* (see note) |
| TPL | Template Library | Templates |
| AST | Asset Library | Assets |
| CHN | Channels & Platform Connections | Channels, Platform Connections |
| AUT | Automation Mode & Scheduling | Channels |
| GEN | Content Generation & Validation | Jobs, Queue |
| REN | Rendering | Jobs, Queue |
| PUB | Publishing | Publishing History |
| MON | Job Monitoring, Notifications, Logs | Jobs, Queue, Logs |
| SYS | Feature Flags & System Configuration | Settings |
| NAV | Cross-cutting Dashboard/Navigation | Dashboard (overview) |
| GC | Generated Content Management *(new — see Section 18 note on terminology)* | Jobs *(no dedicated module frozen — see Assumption A-11)* |
| JOB | Job Management (operator-initiated actions on Jobs) | Jobs |
| QUE | Queue Management | Queue |

*\*Note:* `PROJECT_DECISIONS.md` Section 30 freezes 11 Dashboard Modules and does not list a distinct "Prompts" module; Prompt Library management is placed under the same operator workflow as Templates for this PRD's purposes. This is a **product-level placement assumption**, not a new module — see Assumption A-1 (Section 20). It is flagged, not silently decided, because Section 30 is frozen and any real module change requires the revision path Section 30's own note already anticipates.

---

## 3. Workspace (WS)

### FR-WS-01 — Single Workspace context
**Description:** The system operates within exactly one Workspace. All configuration and data the operator creates (Channels, Content Profiles, Prompts, Templates, Assets, Jobs, Platform Connections, Feature Flags, System Configuration) is implicitly scoped to that one Workspace. The operator never selects or switches a Workspace in v1.
**Trace:** Goal G7; `01-vision-and-scope.md` Section 6 (Non-Goals: no multi-tenant business logic).
**Acceptance Criteria:**
- No UI element for creating, switching, or listing Workspaces exists in v1.
- Every entity the operator creates is retrievable without ever specifying a Workspace.
**Edge Cases:** None — single-Workspace behavior is unconditional in v1.
**Assumptions:** None; fully specified by `01-vision-and-scope.md` Section 5 (G7) and Section 6.

---

## 4. Content Configuration (CFG)

### FR-CFG-01 — Manage Content Types
**Description:** The operator can view the list of available Content Types (e.g., Shayari, Motivational Quote, Business Quote, Festival Wish, Poetry) for use when creating a Content Profile.
**Trace:** MVP "Manage Content Profiles"; `00-glossary.md` Content Type.
**Acceptance Criteria:**
- Operator can see all enabled Content Types when configuring a Content Profile.
- Content Type selection is a reference, never free text.
**Edge Cases:** A Content Type with zero Content Profiles referencing it is still visible and selectable.
**Assumptions:** Whether operators can create/edit Content Types themselves in v1, versus Content Types being seed data, is an **open product question** — see Assumption A-2 (Section 20). `01-vision-and-scope.md` does not state this explicitly.

### FR-CFG-02 — Create and configure a Content Profile
**Description:** The operator can create a Content Profile by specifying: a pinned Prompt Version, Prompt Variables, Language (English, Hindi, or Urdu only), a Content Type reference, Tone, Writing Style, a pinned Template Version, Branding Rules, Watermark Rules, Caption Strategy, Hashtag Strategy, Music Selection Rules, Rendering Configuration, and additive Validation Rules.
**Trace:** Goal G1, G2; MVP "Manage Content Profiles"; `PROJECT_DECISIONS.md` Section 11.
**Acceptance Criteria:**
- A Content Profile cannot be saved without a Prompt Version, a Template Version, a Content Type, and a Language.
- Language field only accepts English, Hindi, or Urdu (`01-vision-and-scope.md` Section 6, Non-Goals).
- The Prompt Version and Template Version selectors show specific versions, never a "latest" option (`PROJECT_DECISIONS.md` Sections 12.1, 13.1).
**Edge Cases:**
- Attempting to select a disabled Asset (e.g., a disabled Music track or Font) in Branding/Music rules must be prevented or clearly flagged as invalid.
- Attempting to pin a Prompt or Template Version that has since been deleted (if deletion is ever allowed — see Assumption A-3) must be prevented.
**Assumptions:** Whether a Prompt/Template Version can ever be deleted (vs. only ever added/rolled-back-from) is not stated in `PROJECT_DECISIONS.md` and is flagged as Assumption A-3.

### FR-CFG-03 — Edit a Content Profile
**Description:** The operator can update any field of an existing Content Profile, including repointing it to a different pinned Prompt Version or Template Version.
**Trace:** `PROJECT_DECISIONS.md` Section 12.1, 13.1 ("until someone explicitly repoints it").
**Acceptance Criteria:**
- Saving an edit does not retroactively alter any already-completed Job or already-published content.
- Editing a Content Profile referenced by multiple Channels applies the change to all of them on their next run (`PROJECT_DECISIONS.md` Section 11).
**Edge Cases:** Editing a Content Profile that is currently referenced by a Channel with a Job in progress must not corrupt that in-flight Job; the in-flight Job continues using the configuration it started with. (Exact mechanism is a technical concern for a later document — this FR only freezes the observable behavior: in-flight work is not silently altered mid-run.)
**Assumptions:** None beyond the edge case above, which is a product-level guarantee, not an implementation detail.

### FR-CFG-04 — Delete / disable a Content Profile
**Description:** The operator can disable a Content Profile so it can no longer be newly referenced by a Channel.
**Trace:** MVP "Manage Content Profiles" (implied lifecycle completeness).
**Acceptance Criteria:** A disabled Content Profile cannot be selected when creating a new Channel; Channels already referencing it are flagged so the operator is aware.
**Edge Cases:** Disabling a Content Profile still referenced by an active Channel must not silently break that Channel — the operator must be warned before or at the point of disabling.
**Assumptions:** Whether "disable" is soft-delete only (no hard delete in v1) is an **open item** — flagged as Assumption A-4.

---

## 5. Prompt Library (PRM)

### FR-PRM-01 — Create and version a Prompt
**Description:** The operator can create a Prompt and later update it, with every update producing a new, immutable Prompt Version rather than mutating the existing one.
**Trace:** Goal G1; MVP "Manage a Prompt Library"; `PROJECT_DECISIONS.md` Section 12, 12.1.
**Acceptance Criteria:**
- Saving changes to a Prompt always results in a new version with a new Version number, Created Date, and inherited/updated Notes.
- Previously pinned Content Profiles are unaffected by the new version until explicitly repointed.
**Edge Cases:** Creating a new Prompt Version while a Job is actively using the currently-pinned version does not affect that Job.
**Assumptions:** None.

### FR-PRM-02 — View Prompt Version history and roll back
**Description:** The operator can view all versions of a Prompt and mark a prior version as the one offered by default to new Content Profiles ("Rollback" at the library level).
**Trace:** MVP "Manage a Prompt Library"; `PROJECT_DECISIONS.md` Section 12.1.
**Acceptance Criteria:**
- Rollback changes only the default offered to new/unpinned selections.
- Rollback never changes what an already-pinned Content Profile uses.
**Edge Cases:** Rolling back to a version, then creating a new version again, must not lose or renumber any historical version.
**Assumptions:** None.

### FR-PRM-03 — Prompt metadata and status
**Description:** The operator can view and edit a Prompt's Status and Notes.
**Trace:** `00-glossary.md` Prompt entry (Version, Created Date, Modified Date, Status, Notes).
**Acceptance Criteria:** Status and Notes are visible on both the Prompt (library-level) and each individual Version.
**Edge Cases:** None identified at product level.
**Assumptions:** The exact allowed Status values (e.g., Draft/Active/Archived) are not frozen anywhere — flagged as Assumption A-5.

### FR-PRM-04 — Test a Prompt Version before assigning it *(new)*
**Description:** The operator can generate a one-off preview output from a specific Prompt Version, with sample Prompt Variables, via the AI Provider — before that version is pinned to any Content Profile.
**Trace:** Goal G1 (verifiability of AI-generated behavior before it reaches production); MVP "Manage a Prompt Library."
**Acceptance Criteria:**
- A preview generation does not create a Job, does not appear in Job Monitoring (Section 16) or Publishing History, and produces no Domain Event.
- Preview output is never rendered, validated against global Validation checks, or eligible for publishing — it is text-only, for the operator's review.
- The same real-person-attribution safeguard (`PROJECT_DECISIONS.md` Section 3) applies to preview output exactly as it does to production generation — a preview is not a safe place to fabricate an attribution.
**Edge Cases:** Repeated preview generation against the same Prompt Version must not be counted toward or confused with the exact-duplicate detection that applies to production content (FR-GEN-02) — preview output is never compared against the production duplicate-hash store.
**Assumptions:** Whether preview generation counts against AI Provider usage/cost the same as production generation is a cost-tracking question for `03-technical-requirements.md`; this FR does not assume it's free, only that it's isolated from production data.

---

## 6. Template Library (TPL)

### FR-TPL-01 — Create and version a Template
**Description:** The operator can register a Template (a rendering layout) and update it, with every update producing a new immutable Template Version.
**Trace:** Goal G2; MVP "Manage a Template Library"; `PROJECT_DECISIONS.md` Section 13, 13.1.
**Acceptance Criteria:** Same versioning guarantees as FR-PRM-01, applied to Templates.
**Edge Cases:** Same as FR-PRM-01.
**Assumptions:** How a Template is actually authored/uploaded (code upload vs. visual builder) is explicitly a technical/UX question for a later document, not this PRD — this FR only requires that the capability to create and version one exists.

### FR-TPL-02 — View Template Version history and roll back
**Description:** Mirrors FR-PRM-02 for Templates.
**Trace:** MVP "Manage a Template Library"; `PROJECT_DECISIONS.md` Section 13.1.
**Acceptance Criteria:** Same as FR-PRM-02, applied to Templates.
**Edge Cases:** Same as FR-PRM-02.
**Assumptions:** None.

### FR-TPL-03 — Template preview
**Description:** The operator can preview how a Template renders with sample text before pinning it to a Content Profile.
**Trace:** Goal G2 (multi-script correctness is high-risk and must be verifiable before use).
**Acceptance Criteria:** Preview supports sample text in English, Hindi, and Urdu scripts.
**Edge Cases:** Preview must visibly fail or flag an error, never silently render incorrect script shaping, if a Template cannot handle a given script.
**Assumptions:** None — this directly supports Goal G2's stated risk ("hardest part of this domain to get right").

### FR-TPL-04 — Template preview test matrix *(new — extends FR-TPL-03, does not replace it)*
**Description:** In addition to previewing a Template with sample text (FR-TPL-03), the operator can specifically preview a Template against a defined matrix: each of English, Hindi, and Urdu, each with both a short sample text and a long sample text, to validate layout behavior (truncation, overflow, line-wrapping, RTL/LTR mixing) before the Template is pinned to any Content Profile.
**Trace:** Goal G2; same rationale as FR-TPL-03 — this FR makes the "verifiable before use" requirement concrete rather than leaving text length unspecified.
**Acceptance Criteria:**
- The preview interface offers, at minimum, six preview combinations (3 languages × short/long) without requiring the operator to hand-type sample text for each run.
- A layout failure (text overflow, clipped watermark, broken script shaping) in any one combination is visibly flagged as a failure of that specific combination, not summarized away.
**Edge Cases:** A Template that passes short-text preview but fails long-text preview (e.g., overflow) must not be blocked from being saved — Templates are still a library resource independent of any one Content Profile — but the failure must be visible so the operator doesn't pin it to a profile expecting long text.
**Assumptions:** The exact definition of "short" vs. "long" sample text (character/word counts) is left to `03-technical-requirements.md` or the Template's own documentation; this FR only freezes that both extremes must be tested, not the exact thresholds.

---

## 7. Asset Library (AST)

### FR-AST-01 — Manage Assets
**Description:** The operator can add, view, enable/disable, and edit metadata for Assets: Backgrounds, Fonts, Music, Logos, Watermarks, Animations, Icons.
**Trace:** MVP (implied by Content Profile's Branding/Watermark/Music rules); `PROJECT_DECISIONS.md` Section 9.2.
**Acceptance Criteria:**
- Every Asset has an Enabled/Disabled state and a metadata record appropriate to its type (e.g., Music: Mood, Language, Genre, Duration, License).
- A disabled Asset cannot be newly selected by a Content Profile (see FR-CFG-02 edge case).
**Edge Cases:** Disabling an Asset already referenced by an active Content Profile must warn the operator, not silently break future renders/selections.
**Assumptions:** None.

### FR-AST-02 — Music licensing gate
**Description:** A Music track without confirmed licensing cannot be selected by any Content Profile's Music Selection Rules.
**Trace:** `PROJECT_DECISIONS.md` Section 9.1; `01-vision-and-scope.md` Section 10 (Success Criteria references licensing).
**Acceptance Criteria:** The system enforces this as a hard constraint, not an operator reminder — an unlicensed track is simply not selectable.
**Edge Cases:** A track whose license status changes from confirmed to unconfirmed after being referenced by existing profiles must stop being selected for new content going forward (existing rendered/published content is not retroactively affected).
**Assumptions:** How "confirmed licensing" is recorded (a field, a document upload, a checkbox) is a technical/data-model concern for a later document.

### FR-AST-03 — Preview an Asset *(new)*
**Description:** The operator can preview an Asset appropriate to its type before referencing it in a Content Profile: play a Music track, view a Font rendered as sample text, view a Background/Logo/Watermark image, or view an Animation.
**Trace:** MVP (implied by Content Profile's Branding/Watermark/Music rules — an operator cannot make an informed branding choice without seeing/hearing the Asset first); Goal G2 (consistency by construction depends on choosing the right Asset up front).
**Acceptance Criteria:**
- Every Asset type listed in `PROJECT_DECISIONS.md` Section 9.2 has a corresponding preview capability appropriate to that type.
- Previewing an Asset is read-only and never modifies the Asset's metadata, Enabled/Disabled state, or licensing status.
**Edge Cases:** Previewing a disabled Asset must still be possible (so the operator can confirm what they're re-enabling) even though the Asset cannot be newly selected while disabled (FR-AST-01).
**Assumptions:** None beyond what's already stated — this is preview-only, per your instruction; no new editing capability is introduced.

---

## 8. Channels & Platform Connections (CHN)

### FR-CHN-01 — Create and configure a Channel
**Description:** The operator can create a Channel by specifying a Name, exactly one Content Profile reference, one or more Platform Connection references, a Schedule, an Automation Mode, and Publishing Configuration.
**Trace:** Goal G3, G4; MVP "Manage Channels"; `PROJECT_DECISIONS.md` Section 14.
**Acceptance Criteria:**
- A Channel cannot be saved without a Content Profile, at least one Platform Connection, a Schedule, and an Automation Mode.
- Two Channels may reference the same Content Profile without any forking or override of that profile (`01-vision-and-scope.md` Section 6, Non-Goals).
**Edge Cases:** Creating a Channel targeting a Platform Connection whose Health Status is unhealthy/expired must be allowed (the Channel can be configured ahead of fixing the connection) but the operator must be clearly warned.
**Assumptions:** None.

### FR-CHN-02 — Disable a Channel
**Description:** The operator can disable a Channel, immediately halting any future scheduled generation/publishing for it without deleting its configuration or history.
**Trace:** MVP "Manage Channels."
**Acceptance Criteria:** A disabled Channel produces no new Jobs; its Publishing History remains fully visible.
**Edge Cases:** Disabling a Channel with an in-flight Job does not kill that Job — the in-flight Job runs to completion or failure; only *future* scheduled runs stop.
**Assumptions:** None.

### FR-CHN-03 — Manage Platform Connections
**Description:** The operator can add a new Platform Connection (initiating the platform's official OAuth or credential flow), view its Health Status, and remove it.
**Trace:** Goal G3; MVP "Publish to real platforms"; `PROJECT_DECISIONS.md` Section 15, 22.
**Acceptance Criteria:**
- The operator can see, per Platform Connection: Platform, Health Status, and token expiry status, without seeing raw token values.
- Removing a Platform Connection referenced by an active Channel must warn the operator before completing.
**Edge Cases:** A Platform Connection whose Access Token has expired must surface as unhealthy in the dashboard, not just fail silently on next publish attempt (this FR states the observable requirement; Token Refresh's own retry/refresh mechanics belong to a later document per `PROJECT_DECISIONS.md` Section 18.2).
**Assumptions:** None.

---

## 9. Automation Mode & Scheduling (AUT)

### FR-AUT-01 — Select Automation Mode per Channel
**Description:** The operator selects exactly one Automation Mode (Manual, Automatic, or Hybrid) per Channel, changeable at any time.
**Trace:** Goal G4; MVP "Choose an Automation Mode per Channel"; `PROJECT_DECISIONS.md` Section 16.
**Acceptance Criteria:**
- Manual: every piece of generated content requires explicit operator Preview and Publish action.
- Automatic: content generates and publishes with no human checkpoint.
- Hybrid: content generates, then holds in an approval-pending state until the operator explicitly approves, then publishes.
- Changing a Channel's mode applies to future Jobs only, never retroactively to a Job already in progress.
**Edge Cases:** Switching a Channel from Automatic to Hybrid (or vice versa) while a Job is mid-pipeline must not change that Job's behavior mid-flight.
**Assumptions:** None — fully specified by `PROJECT_DECISIONS.md` Section 16.

### FR-AUT-02 — Define a Channel Schedule
**Description:** The operator defines when a Channel generates and (depending on Automation Mode) publishes content, in a way that survives a process restart.
**Trace:** Goal G3; MVP "Schedule publishing"; `PROJECT_DECISIONS.md` Section 17.
**Acceptance Criteria:**
- A defined Schedule continues to be honored after the platform restarts, with no operator action required to "resume" it.
- The operator can view, per Channel, when its next scheduled run will occur.
**Edge Cases:** If the platform is offline at a scheduled run time, the missed run's handling (skip vs. run late) is not specified by any approved document — flagged as Assumption A-6.
**Assumptions:** See A-6 above; also, the exact scheduling UI (calendar, cron-like expression, simple interval picker) is a UX design question for `07-frontend-architecture.md`, not this PRD.

### FR-AUT-03 — Approve or reject Hybrid-mode content
**Description:** For a Hybrid-mode Channel, the operator can review generated content (text, rendered image/video, caption, hashtags) and either approve it for publishing or reject it.
**Trace:** Goal G4; `PROJECT_DECISIONS.md` Section 16.
**Acceptance Criteria:**
- Approval moves the Job forward to Publishing.
- Rejection stops the Job from publishing; the Job's outcome must be visible and attributed, not silently discarded (consistent with Goal G5).
**Edge Cases:** What happens on rejection — regenerate automatically, or require a fully new manual run — is not stated in any approved document. Flagged as Assumption A-7.
**Assumptions:** See A-7.

---

## 10. Content Generation & Validation (GEN)

### FR-GEN-01 — Generate text content via AI Provider
**Description:** For each Job, the system generates text content using the Content Profile's pinned Prompt Version, Prompt Variables, Language, Tone, and Writing Style, via the configured AI Provider.
**Trace:** Goal G1; MVP "Generate and render content"; `PROJECT_DECISIONS.md` Section 5.
**Acceptance Criteria:**
- Generated content is never attributed to a real, named person unless verifiably correct (`PROJECT_DECISIONS.md` Section 3) — this is a zero-tolerance requirement, not a best-effort one.
- If attribution cannot be confirmed, the system produces original, unattributed content instead of fabricating one.
**Edge Cases:** AI Provider failure exhausts retries → Job marked Failed at the Generating Content stage with Stage/Reason/Retry Count/Timestamp recorded (Goal G5).
**Assumptions:** None — directly specified by `PROJECT_DECISIONS.md` Section 3 and 5.

### FR-GEN-02 — Validate generated content
**Description:** Every generated piece of content passes through the full global validation suite (empty output, length, formatting, platform-specific limits, profanity, exact-duplicate detection) before proceeding, plus any additive Validation Rules from its Content Profile.
**Trace:** Goal G1; MVP "Generate and render content"; `PROJECT_DECISIONS.md` Section 6, 6.2.
**Acceptance Criteria:**
- A duplicate (exact-match, normalized-hash) triggers automatic regeneration up to a configured retry limit, then Failed.
- A profile-level Validation Rule can reject content a global check would have passed, but can never approve content a global check rejected.
**Edge Cases:** A Content Profile whose Validation Rules are internally impossible to satisfy (e.g., a length rule narrower than the shortest content the Prompt can produce) is a configuration authoring problem, not a runtime concern this FR needs to solve — the system's only obligation is that such a Job eventually reaches Failed with an attributable Reason, not that it retries forever.
**Assumptions:** None.

---

## 11. Rendering (REN)

### FR-REN-01 — Render generated text into a branded image
**Description:** Validated text is rendered using the Content Profile's pinned Template Version, correctly handling English, Hindi (Devanagari), and Urdu (Nastaliq) script shaping, with configured Branding Rules and Watermark Rules applied.
**Trace:** Goal G2; MVP "Generate and render content"; `PROJECT_DECISIONS.md` Section 7, 7.1, 8.
**Acceptance Criteria:**
- Rendered output is visually correct (proper RTL layout and character shaping for Urdu; correct conjuncts for Hindi) — verifiable by the Template preview capability (FR-TPL-03).
- Branding/Watermark elements from the Content Profile appear on every rendered piece of content from that profile, with no manual per-render step.
**Edge Cases:** A Content Profile in Urdu or Hindi referencing a Template/font combination that cannot render that script must fail the Job at the Generating Image stage with a clear Reason — never silently produce garbled/incorrect text.
**Assumptions:** None beyond the font-licensing prerequisite already stated in `PROJECT_DECISIONS.md` Section 8.

### FR-REN-02 — Convert rendered image into a short vertical video
**Description:** The rendered image is converted into a short vertical video with lightweight animation and an attached, rule-selected Music track.
**Trace:** Goal G2; MVP "Generate and render content"; `PROJECT_DECISIONS.md` Section 7, 7.1, 9.1.
**Acceptance Criteria:**
- Every published video has music attached, selected per the Content Profile's Music Selection Rules from only licensed, enabled tracks (FR-AST-02).
- Animation is "lightweight" only — no arbitrary video editing, multi-clip composition, or effects beyond what `01-vision-and-scope.md` Section 6 (Non-Goals) permits.
**Edge Cases:** No Music track matches a Content Profile's Selection Rules (e.g., an overly narrow Mood/Language filter) → Job fails at Selecting Music with an attributable Reason, rather than publishing with no music or a mismatched track.
**Assumptions:** None.

---

## 12. Publishing (PUB)

### FR-PUB-01 — Publish to configured platforms
**Description:** A completed, approved (per Automation Mode) piece of content is published to every Platform Connection referenced by its Channel, honoring each platform's own limits via that platform's Publishing Adapter.
**Trace:** Goal G3; MVP "Publish to real platforms"; `PROJECT_DECISIONS.md` Section 14, 15, 22.
**Acceptance Criteria:**
- Publishing uses only official, sanctioned platform APIs (`01-vision-and-scope.md` Section 7).
- A platform-specific limit violation (caption length, aspect ratio, duration) is caught before attempting to publish, not discovered as a platform-side rejection after the fact, wherever the platform's API allows pre-validation.
**Edge Cases:** A Channel with multiple Platform Connections where publishing succeeds on one and fails on another must record each outcome independently and attributably — a partial success is never reported as either a full success or a full failure.
**Assumptions:** None.

### FR-PUB-02 — Review Publishing History
**Description:** The operator can see a list of everything published: which Channel, which platform, when, and the outcome (success/failure).
**Trace:** MVP "Review Publishing History"; `01-vision-and-scope.md` Section 8.
**Acceptance Criteria:**
- Every publish attempt (success or failure) appears in Publishing History, not only successes.
- The operator can filter/view history per Channel.
**Edge Cases:** A Retry Publish (independent Job Type, `PROJECT_DECISIONS.md` Section 18.2) that eventually succeeds after an initial failure must show the full attempt history, not overwrite the original failed record.
**Assumptions:** Exact filtering/sorting capabilities are a UX design question for a later document; this FR only requires that the data itself is complete and retrievable.

### FR-PUB-03 — Filter Publishing History *(new — makes FR-PUB-02's deferred "filter/view per Channel" concrete)*
**Description:** The operator can filter Publishing History by Channel, Platform, Status (success/failure), Date Range, and Content Type.
**Trace:** MVP "Review Publishing History"; supersedes the vague "filter/view per Channel" acceptance criterion in FR-PUB-02 with a complete, explicit filter list — this does not contradict FR-PUB-02, it completes what it left open.
**Acceptance Criteria:**
- Each of the five filter dimensions (Channel, Platform, Status, Date Range, Content Type) can be applied independently or in combination.
- Filtering never mutates or hides the underlying record — it only changes what's displayed.
**Edge Cases:** Filtering by Content Type requires Publishing History records to retain a reference to the Content Type of the content that was published, even though Content Type lives on the Content Profile, not the Channel directly (`PROJECT_DECISIONS.md` Section 11) — a Publishing History record must capture this at time of publish so filtering still works if the Content Profile is later edited to reference a different Content Type.
**Assumptions:** Exact filter UI (dropdowns, date pickers, combined query builder) is a `07-frontend-architecture.md` concern; this FR only freezes the five filterable dimensions.

---

## 13. Job Monitoring, Notifications & Logs (MON)

### FR-MON-01 — View Job status and pipeline stage
**Description:** The operator can see every Job's current state (one of the 13 states in the Job State Machine) and, for a Failed Job, its Stage, Reason, Retry Count, and Timestamp.
**Trace:** Goal G5; MVP (implied by Dashboard Modules "Jobs" and "Queue"); `PROJECT_DECISIONS.md` Section 19.
**Acceptance Criteria:** Every Failed Job displayed in the dashboard shows all four attribution fields — none is ever blank for a Failed Job.
**Edge Cases:** None beyond the zero-tolerance requirement above.
**Assumptions:** None.

### FR-MON-02 — Receive failure and status Notifications
**Description:** The operator receives an in-app Notification whenever a Domain Event representing a failure or a state needing attention occurs (Job Failed, Publishing Failed, Token Expiring, Retry Exhausted, Approval Required).
**Trace:** Goal G5; MVP "Receive failure and status Notifications"; `PROJECT_DECISIONS.md` Section 23, 24.
**Acceptance Criteria:**
- Every Notification is traceable to the specific Domain Event that triggered it — never generated by a separate, independent check for the same condition.
- The operator can see a list of Notifications and mark them as read/acknowledged.
**Edge Cases:** None beyond the strict event-sourcing requirement already frozen in `PROJECT_DECISIONS.md` Section 24.
**Assumptions:** The acceptable delay between a Domain Event firing and a Notification appearing is **explicitly not defined here** — `01-vision-and-scope.md`'s Document Control note already assigns this to a later document (Assumption A-8, Section 20).

### FR-MON-03 — View system Logs
**Description:** The operator can view a Logs module, distinct from Publishing History and Notifications, showing lower-level application/debug output.
**Trace:** MVP "View system Logs"; `PROJECT_DECISIONS.md` Section 30.
**Acceptance Criteria:** Logs are presented as a separate Dashboard Module, never merged into Publishing History or Notifications (which are Domain-Event-driven, not raw logs).
**Edge Cases:** None at product level.
**Assumptions:** Log retention period and searchability are technical/UX concerns for later documents.

---

## 14. Feature Flags & System Configuration (SYS)

### FR-SYS-01 — View and toggle Feature Flags
**Description:** The operator can view and toggle workspace-scoped Feature Flags (e.g., Enable AI Provider, Enable Platform, Enable Approval Mode, Enable Auto Publish, Enable Experimental Features) without a code deployment.
**Trace:** MVP "Configuration over code" principle; `PROJECT_DECISIONS.md` Section 20.
**Acceptance Criteria:** Toggling a flag takes effect without restarting the application (runtime-evaluated, per Section 20).
**Edge Cases:** Disabling a flag that an active Channel currently depends on (e.g., disabling "Enable Approval Mode" while a Hybrid Channel exists) must warn the operator, not silently break that Channel's behavior.
**Assumptions:** None.

### FR-SYS-02 — View and edit System Configuration
**Description:** The operator can view and edit System Configuration values (Default AI Provider, Retry Limits, Global Prompt Variables, Default Video Duration, Rendering Settings including render concurrency, Default Fonts, Timezone, Storage Provider selection).
**Trace:** MVP "Configuration over code" principle; `PROJECT_DECISIONS.md` Section 21.
**Acceptance Criteria:** Every value listed in Section 21 is editable through this module — none is a hardcoded constant reachable only by a code change.
**Edge Cases:** Setting a Retry Limit or render concurrency value to an invalid range (e.g., zero or negative) must be rejected by the interface, not silently accepted and left to fail at runtime.
**Assumptions:** The exact valid ranges for each value are implementation details for a later document.

---

## 15. Cross-Cutting Dashboard & Navigation (NAV)

### FR-NAV-01 — Operate entirely through the Dashboard
**Description:** Every capability listed in this PRD is reachable through the frozen Dashboard Modules (`PROJECT_DECISIONS.md` Section 30) — no capability requires direct API or database access.
**Trace:** MVP "Operate all of the above through the frozen Dashboard Modules"; `01-vision-and-scope.md` Section 9.
**Acceptance Criteria:** A walkthrough of every FR in this document can be completed using only the Dashboard UI.
**Edge Cases:** None.
**Assumptions:** None.

### FR-NAV-02 — Dashboard overview
**Description:** The Dashboard (overview) module gives the operator an at-a-glance summary: active Channels, recent Job outcomes, unread Notifications, and upcoming scheduled runs.
**Trace:** MVP (implied — an "overview" module with no functional content would not satisfy Goal G5's visibility requirement).
**Acceptance Criteria:** The overview surfaces at minimum: count of Failed Jobs needing attention, count of unread Notifications, and next scheduled run per active Channel.
**Edge Cases:** None at product level.
**Assumptions:** Exact layout/widget design is a `07-frontend-architecture.md` concern; this FR only freezes the functional content requirement.

### FR-NAV-03 — Dashboard Overview content (expanded) *(new — extends FR-NAV-02's acceptance criteria, does not replace it)*
**Description:** The Dashboard Overview surfaces, as read-only summary data pulled from their owning modules: Active Channels count, Upcoming Scheduled Jobs, Failed Jobs, Jobs requiring approval (Hybrid mode pending), Recent Publishing Activity, Queue Summary (counts by queue status — see Section 17, Queue Management), Platform Connection Health, and a Notification Summary.
**Trace:** MVP (implied — same rationale as FR-NAV-02); Goal G5 (failure visibility); Goal G4 (approval-pending visibility).
**Acceptance Criteria:**
- Every item above is present on the Dashboard Overview and is a summary/count/short-list, not a full replica of its owning module's detail view.
- Each summary item links through to its owning module's full view (Channels, Jobs, Queue, Publishing History, Platform Connections, Notifications respectively) rather than duplicating that module's full functionality on the Dashboard itself.
- This FR's acceptance criteria supersede FR-NAV-02's narrower "at minimum" list — FR-NAV-02 is not wrong, it is now a subset of this fuller specification.
**Edge Cases:** A Workspace with zero Channels, zero Jobs, or zero Notifications must render an explicit empty/healthy state on every summary widget, never a blank or error-like gap.
**Assumptions:** Exact widget layout, ordering, and visual design remain a `07-frontend-architecture.md` concern, consistent with FR-NAV-02's existing assumption.

### FR-NAV-04 — Global Search *(new)*
**Description:** The operator can search, from a single search entry point, across Channels, Content Profiles, Prompt Library, Template Library, Assets, Jobs, Publishing History, and Logs.
**Trace:** MVP "Operate all of the above through the frozen Dashboard Modules" (a single-operator system with growing configuration volume needs a way to find things without manually opening each module); Goal G5 (findability supports failure diagnosis speed).
**Acceptance Criteria:**
- A single query surfaces matching results across all eight listed areas, each result labeled with which area it came from and linking to that item's location in its owning module.
- Search is read-only — it never modifies any record it returns.
**Edge Cases:** A query matching a very high volume of Log lines must not make the search feature unusable (e.g., must be capped/paginated) — the exact mechanism is deferred, but "search must remain usable under load" is a product-level requirement, not optional polish.
**Assumptions:** Search behavior itself — indexing strategy, ranking, fuzzy vs. exact match, performance characteristics — is explicitly deferred to `03-technical-requirements.md` or later, per your instruction. This FR defines only the functional capability and its scope (which eight areas are searchable).

---

## 16. Job Management (JOB)

**Relationship to Section 13 (Job Monitoring):** Section 13 (MON) is *read-only visibility*. This section is *operator-initiated action* on a Job. Both operate on the same underlying Job entity (`00-glossary.md` Job) and are presented together in the Jobs Dashboard Module (`PROJECT_DECISIONS.md` Section 30); they are split into two PRD sections only to separate "what the operator can see" from "what the operator can do."

### FR-JOB-01 — View Job Details
**Description:** The operator can open a single Job and see its full detail: Job Type, current pipeline stage (for a Content Pipeline Job, one of the 13 states — `PROJECT_DECISIONS.md` Section 19), owning Channel, owning Content Profile, timestamps for each stage transition it has passed through, and — if Failed — Stage, Reason, Retry Count, and Timestamp (FR-MON-01).
**Trace:** Goal G5; `PROJECT_DECISIONS.md` Section 19, Section 23 (stage transition history is the product-visible face of Domain Events).
**Acceptance Criteria:** Every field listed above is visible on the Job Detail view for every Job, regardless of Job Type.
**Edge Cases:** An Independent Job Type (Cleanup, Archive, Retry Publish, Token Refresh, Health Check — `PROJECT_DECISIONS.md` Section 18.2) does not have the 13-state Content Pipeline lifecycle; its Job Detail view shows its own simpler state machine, not a forced fit into the 13 states.
**Assumptions:** None.

### FR-JOB-02 — Retry a Failed Job
**Description:** The operator can trigger a retry of a Failed Job.
**Trace:** Goal G5 (visibility without recourse is only half the value); MVP (implied by Dashboard Modules "Jobs"/"Queue," Section 30).
**Acceptance Criteria:** Triggering a retry produces a new attempt whose outcome is recorded independently (per FR-PUB-02's edge case: retry history is never overwritten, only appended to).
**Edge Cases:** Retrying a Job that failed at the Publishing stage specifically is the same underlying capability as the existing **Retry Publish** Independent Job Type (`PROJECT_DECISIONS.md` Section 18.2) — this FR does not introduce a second, competing retry mechanism; retrying a Publishing-stage failure from the Jobs module invokes that same Retry Publish Job Type. Retrying a failure at any *other* stage (Generating Content, Validating, Generating Image, etc.) re-runs the Content Pipeline Job itself, not Retry Publish.
**Assumptions:** Whether a stage-specific retry (e.g., "just retry Generating Image, keep the already-generated text") is possible depends entirely on the Assumption flagged in FR-JOB-06 below — this FR only guarantees a retry capability exists, not which stages it can resume from.

### FR-JOB-03 — Cancel a Waiting Job
**Description:** The operator can cancel a Job that has not yet started executing (waiting to be picked up).
**Trace:** Goal G4 (operator control); MVP (implied by Dashboard Modules "Jobs"/"Queue").
**Acceptance Criteria:** A cancelled Job is recorded as such (not silently removed) and does not proceed to execution.
**Edge Cases:** A cancel request racing against the Job actually starting must resolve deterministically one way or the other (either the cancel succeeds and the Job never starts, or the Job has already started and the operator is told the cancel did not apply) — never an ambiguous or silent outcome.
**Assumptions:** None beyond the race-condition resolution mechanism itself, which is a technical concern for a later document; this FR only requires the outcome always be visible and unambiguous.

### FR-JOB-04 — Pause a Job *(conditional — feasibility not yet confirmed)*
**Description:** The operator can pause a Job that is currently executing, halting its progress until explicitly resumed.
**Trace:** Goal G4 (operator control over automation).
**Acceptance Criteria:** *Deferred pending feasibility confirmation — see Assumptions below.* If supported, a paused Job must not silently continue consuming AI Provider calls, render resources, or move to its next stage while paused.
**Edge Cases:** Pausing a Job mid-external-call (e.g., mid-request to the AI Provider, mid-FFmpeg encode) — what "paused" means at that instant — is a technical question, not a product one, but the product-level guarantee is: pausing must never leave a Job in an ambiguous state that is neither cleanly paused nor cleanly progressing.
**Assumptions:** **This requirement is explicitly conditional, per your own instruction ("if technically supported").** `PROJECT_DECISIONS.md` Section 18.1 architects the Content Pipeline Job as a single, long-lived BullMQ job specifically to avoid the complexity of independently coordinating pipeline stages. True mid-execution pause of a running job (as opposed to pausing a *queue* from picking up new waiting jobs, which BullMQ supports natively) is not something Section 18.1 or any other frozen decision guarantees is possible without additional architecture. **Recommendation: do not finalize this FR as a committed v1 capability until `03-technical-requirements.md` or `04-system-architecture.md` confirms it is achievable within the single-job model — otherwise this document commits to something the frozen architecture may not support, which is exactly the kind of contradiction this methodology exists to prevent.**

### FR-JOB-05 — Resume a Paused Job *(conditional — depends entirely on FR-JOB-04)*
**Description:** The operator can resume a previously paused Job from the point it was paused.
**Trace:** Goal G4.
**Acceptance Criteria:** *Deferred — identical dependency as FR-JOB-04.*
**Edge Cases:** Same as FR-JOB-04.
**Assumptions:** This FR only exists if FR-JOB-04 is confirmed feasible. If Pause is not supported, Resume is moot and both should be moved to Section 19 (Explicit Non-Coverage) in a future revision rather than left as unresolved conditionals indefinitely.

### FR-JOB-06 — Restart a Failed Job from its failed stage *(conditional — feasibility not yet confirmed)*
**Description:** The operator can restart a Failed Job so that it resumes from the stage at which it failed, rather than re-running the entire pipeline from Draft.
**Trace:** Goal G5, G6 (avoiding redundant AI Provider calls / render work is a cost consideration).
**Acceptance Criteria:** *Deferred pending feasibility confirmation — see Assumptions below.* If supported, a restarted Job must not repeat a stage that already completed successfully and whose output is still valid (e.g., must not re-call the AI Provider if Generating Content already succeeded and only Generating Image failed).
**Edge Cases:** If the Content Profile, Prompt Version, or Template Version pinned to the Job's Channel changed between the original failure and the restart, restarting "from the failed stage" using the *old* upstream output could produce inconsistent content. The system must not silently mix outputs generated under different configuration versions — either the restart uses the exact configuration versions active at the time of the original attempt, or the operator is told a full re-run from Draft is required instead.
**Assumptions:** **Same architectural caveat as FR-JOB-04.** This requires the Content Pipeline Job to persist intermediate stage outputs (generated text, rendered image, etc.) durably enough to resume from them later — a capability `PROJECT_DECISIONS.md` does not currently freeze one way or the other. **Recommendation: resolve this alongside FR-JOB-04/05 in the same technical-feasibility pass before v1 commits to it**, otherwise "restart from failed stage" may in practice mean "re-run from Draft" — which is a materially different (much simpler, but less cost-efficient) capability, and the operator-facing documentation should say which one it actually is once known.

### FR-JOB-07 — Clone a Job for rerun
**Description:** The operator can clone an existing Job (of any outcome — Failed, Published, or otherwise) to create a new Job with the same Channel, Content Profile, and input configuration, queued to run fresh from Draft.
**Trace:** Goal G4; MVP (implied — reproducing a known-good or known-bad run for testing/diagnosis).
**Acceptance Criteria:** A cloned Job always starts from Draft and runs the full pipeline — it does not reuse any prior stage output. It is a fresh Job, not a resumed one.
**Edge Cases:** **This is functionally very close to Generated Content Management's "Duplicate generated content into a new Job" (FR-GC-04, Section 18 below).** Flagging this explicitly rather than silently picking one: as written, Clone Job (this FR) starts from the Job's *input configuration* (re-run the recipe), while Duplicate Generated Content (FR-GC-04) starts from an already-produced *output* and asks whether to reuse it or regenerate. These are conceptually distinct (input-replay vs. output-reuse) but will likely look like the same button to an operator unless the UI (a later document's concern) makes the distinction obvious. Recommend confirming both are actually wanted as separate capabilities before `03-technical-requirements.md` designs two mechanisms for what might be one operator intent.
**Assumptions:** None beyond the overlap flagged above.

---

## 17. Queue Management (QUE)

**Terminology note (flagged, not silently resolved):** "Waiting," "Active," "Delayed," and queue-level "Failed" as used in this section describe the operator-visible **queue status** of a Job — a coarser, Job-Type-agnostic view distinct from the Content Pipeline Job's 13-state pipeline (`PROJECT_DECISIONS.md` Section 19), which only applies to that one Job Type. None of these four status words is currently defined in `00-glossary.md`. Per Section 35 of `PROJECT_DECISIONS.md`, new terminology must be added to the Glossary before use elsewhere — **this PRD is using them ahead of that addition, at your explicit direction, and this is logged as Assumption A-9 (Section 20) pending a glossary update.** Until resolved, treat "queue status" as a presentation-layer grouping of existing Job states, not a new frozen domain concept.

### FR-QUE-01 — View Waiting Jobs
**Description:** The operator can see all Jobs (any Job Type) currently queued and not yet started.
**Trace:** MVP (implied by Dashboard Module "Queue," `PROJECT_DECISIONS.md` Section 30); Goal G5.
**Acceptance Criteria:** The Waiting view includes Jobs across all Job Types (Content Pipeline Job and every Independent Job Type — `PROJECT_DECISIONS.md` Section 18), not only Content Pipeline Jobs.
**Edge Cases:** None beyond the cross-Job-Type scope stated above.
**Assumptions:** See terminology note above.

### FR-QUE-02 — View Active Jobs
**Description:** The operator can see all Jobs currently executing.
**Trace:** Same as FR-QUE-01.
**Acceptance Criteria:** An Active Job's entry links through to its full Job Detail (FR-JOB-01).
**Edge Cases:** None.
**Assumptions:** See terminology note above.

### FR-QUE-03 — View Delayed Jobs
**Description:** The operator can see all Jobs scheduled for future execution (e.g., a Channel's next scheduled run, or a backoff-delayed retry) but not yet due.
**Trace:** Same as FR-QUE-01; `PROJECT_DECISIONS.md` Section 17 (Scheduling).
**Acceptance Criteria:** Each Delayed Job shows its scheduled execution time.
**Edge Cases:** None.
**Assumptions:** See terminology note above.

### FR-QUE-04 — View Failed Jobs (Queue-level)
**Description:** The operator can see all Failed Jobs from the Queue module.
**Trace:** Goal G5.
**Acceptance Criteria:** This view surfaces the same Failed Jobs as the Jobs module (FR-MON-01) — it is a different entry point to the same data, not a second, independently-detected failure list (consistent with the single-source-of-truth principle already frozen for Domain Events, `PROJECT_DECISIONS.md` Section 23/24).
**Edge Cases:** None.
**Assumptions:** None.

### FR-QUE-05 — Retry from Queue
**Description:** The operator can retry a Failed Job directly from the Queue module.
**Trace:** Goal G5.
**Acceptance Criteria:** This invokes the exact same capability as FR-JOB-02 — Queue Management does not define a second, different retry mechanism.
**Edge Cases:** None beyond what's already stated in FR-JOB-02.
**Assumptions:** None.

### FR-QUE-06 — Remove a Waiting Job
**Description:** The operator can remove a Waiting Job directly from the Queue module.
**Trace:** Goal G4.
**Acceptance Criteria:** This invokes the exact same capability as FR-JOB-03 (Cancel a Waiting Job) — this is the same action exposed from a second Dashboard Module, not a distinct capability.
**Edge Cases:** Same as FR-JOB-03.
**Assumptions:** None.

### FR-QUE-07 — Filter Queue
**Description:** The operator can filter the Queue view by Job Type, queue status (Waiting/Active/Delayed/Failed), and owning Channel.
**Trace:** Goal G5 (findability under volume); MVP (implied).
**Acceptance Criteria:** Filters can be combined (e.g., "Waiting Jobs for Channel X").
**Edge Cases:** None.
**Assumptions:** None beyond the terminology note above.

### FR-QUE-08 — Queue Statistics
**Description:** The operator can see aggregate counts: number of Jobs Waiting, Active, Delayed, and Failed, at minimum broken down by Job Type.
**Trace:** Goal G5; feeds the Queue Summary shown on the Dashboard Overview (FR-NAV-03).
**Acceptance Criteria:** Statistics reflect current state at time of viewing (not a stale cached snapshot with no indication of staleness).
**Edge Cases:** None.
**Assumptions:** Refresh cadence/real-time vs. polled updates is a technical concern for a later document.

---

## 18. Generated Content Management (GC)

**Terminology and architecture flag — read before implementing any FR below.** "Generated Content" as a concept **distinct and independently addressable from a Job** does not currently appear in `00-glossary.md` or `PROJECT_DECISIONS.md`. The frozen model to date treats content generation as something that happens *inside* a Job's lifecycle (Generating Content → Generating Image → Generating Video stages, `PROJECT_DECISIONS.md` Section 19); nothing in the frozen decisions establishes that the resulting text/image/video is *also* persisted as its own first-class, independently viewable, deletable, and reusable entity outside of that Job record. Your instruction is explicit that Generated Content and Job History must be kept conceptually separate ("Jobs record execution. Generated Content represents reusable output.") — that is itself a new architectural distinction, not a restatement of anything already frozen. **This is logged as Assumption A-10 (Section 20). I am writing the FRs below at your direction, but this document cannot be considered fully consistent with `00-glossary.md` and `PROJECT_DECISIONS.md` until: (a) `00-glossary.md` gains a "Generated Content" entry, and (b) `PROJECT_DECISIONS.md` or `03-technical-requirements.md` confirms the platform actually persists generated output as a separate entity rather than as fields on the Job record.**

### FR-GC-01 — View Generated Content
**Description:** The operator can see a list of previously generated content (text, and its associated rendered image/video where the pipeline has progressed that far), independent of navigating through Job History.
**Trace:** Goal G5 (implied — reusable output should be findable on its own terms); your explicit instruction.
**Acceptance Criteria:** Generated Content is listable and filterable by Content Profile, Channel, Language, and Content Type, without requiring the operator to first find the originating Job.
**Edge Cases:** Generated Content originating from a Job that was later deleted/archived (if Job deletion is ever permitted — not currently addressed anywhere) must not disappear along with the Job record, per your instruction that the two remain independent.
**Assumptions:** See the architecture flag above (A-10). This FR assumes generated output is durably persisted as its own entity — an assumption, not a confirmed fact.

### FR-GC-02 — Preview Generated Content
**Description:** The operator can view/play the rendered image or video output of a piece of Generated Content.
**Trace:** Same as FR-GC-01.
**Acceptance Criteria:** Preview is read-only.
**Edge Cases:** None beyond FR-GC-01.
**Assumptions:** Same as FR-GC-01.

### FR-GC-03 — Open Generated Content (full detail)
**Description:** The operator can open a piece of Generated Content to see its full detail: the generated text, the Content Profile/Prompt Version/Template Version used to produce it, the originating Job's identifier, and its current publish status (unpublished, published, or failed to publish).
**Trace:** Same as FR-GC-01. **Distinction from FR-GC-02 (Preview):** Preview shows the rendered media itself; Open shows the metadata and provenance behind it.
**Acceptance Criteria:** Every field listed above is present on the detail view.
**Edge Cases:** None beyond FR-GC-01.
**Assumptions:** Same as FR-GC-01.

### FR-GC-04 — Duplicate Generated Content into a new Job
**Description:** The operator can take an existing piece of Generated Content and create a new Job that reuses it as a starting point (e.g., re-render with a different Template, or re-publish to a different Channel) rather than generating fresh text.
**Trace:** Same as FR-GC-01; Goal G6 (avoiding redundant AI Provider calls when the existing text is still wanted).
**Acceptance Criteria:** The new Job records that its text originated from a duplication, not fresh generation, for audit purposes.
**Edge Cases:** **This overlaps with FR-JOB-07 (Clone a Job for rerun) — see the flag already raised there.** Recommend resolving whether these are one capability or two before technical design begins, rather than building two mechanisms for the same operator intent.
**Assumptions:** Same architecture dependency as FR-GC-01 (A-10).

### FR-GC-05 — Delete Generated Content
**Description:** The operator can delete a piece of Generated Content that has not been published.
**Trace:** Same as FR-GC-01.
**Acceptance Criteria:** Deletion is blocked, or requires explicit extra confirmation, for Generated Content that has already been published to a live platform — deleting the local record must never be presented as equivalent to retracting a live post, since the Publishing Adapters (`PROJECT_DECISIONS.md` Section 22) have no guaranteed ability to un-publish from a third-party platform.
**Edge Cases:** Deleting Generated Content that Publishing History (FR-PUB-02) still references must not break that historical record — Publishing History retains what it needs independently, consistent with FR-PUB-03's edge case about capturing data at time of publish.
**Assumptions:** Same architecture dependency (A-10). Whether deletion is soft or hard is an open item for `03-technical-requirements.md`, consistent with the same open question already flagged for Content Profiles (A-4) and Prompt/Template Versions (A-3).

### FR-GC-06 — Regenerate Content
**Description:** The operator can request fresh regeneration of the text for a piece of Generated Content, using the same Content Profile/Prompt Version, producing a new piece of Generated Content rather than overwriting the original.
**Trace:** Same as FR-GC-01.
**Acceptance Criteria:** Regeneration never mutates or overwrites the original Generated Content record — it produces a new one, preserving history.
**Edge Cases:** Regenerating content that has already been published must not affect the already-published post — this only produces new, separate Generated Content available for a future, distinct publish action.
**Assumptions:** Same architecture dependency (A-10). Note the conceptual proximity to FR-GEN-02's automatic regeneration-on-duplicate — that mechanism is system-triggered and internal to a single Job's Validating stage; this FR is operator-triggered and produces an entirely new Generated Content record. They are not the same mechanism, and this document does not conflate them.

---

## 19. Explicit Non-Coverage (Boundary Statements)

To prevent this PRD from being read as silently expanding scope, the following are explicitly restated as **not required** by any FR above, per `01-vision-and-scope.md` Section 6:

- No FR above implies a second operator account, role, or permission system.
- No FR above implies semantic/embedding-based duplicate detection — FR-GEN-02 is exact-match only.
- No FR above implies AI provider fallback — FR-GEN-01's failure path is retry-then-fail only.
- No FR above implies general-purpose video editing — FR-REN-02 is bounded to the fixed pipeline.
- No FR above implies per-Channel Content Profile overrides — FR-CHN-01 and FR-CFG-03 are explicit that a Channel references, never forks, a profile.
- No FR above implies languages beyond English, Hindi, Urdu.
- **Bulk Operations are explicitly excluded from v1.** No FR in this document supports Bulk Enable, Bulk Disable, Bulk Retry, or Bulk Delete across multiple Channels, Content Profiles, Prompts, Templates, Assets, or Jobs at once. Every FR above operates on exactly one entity per action. This decision is made explicitly here, per your instruction not to leave it ambiguous — at v1's target volume (2–4 videos/day, `PROJECT_DECISIONS.md` Section 4) with a single operator, the number of entities needing simultaneous action is small enough that one-at-a-time operations are not a usability problem, and bulk-action UI/confirmation flows are exactly the kind of complexity Section 2's Development Philosophy (Simplicity, Maintainability ahead of convenience features) says to defer until actually justified. If this proves wrong in practice, it is a future revision to this document, not a v1 gap to quietly patch around.

---

## 20. Assumptions & Open Items Register (This Document Only)

These are gaps this PRD surfaced while translating Vision/Scope and PROJECT_DECISIONS into testable requirements. None is decided here; each requires resolution in whichever later document owns it, or an explicit product decision from you before that document is written.

| ID | Item | Where it should be resolved |
|---|---|---|
| A-1 | Prompt Library has no dedicated Dashboard Module in the frozen Section 30 list; this PRD placed it alongside Templates operationally. | Confirm now, or defer to the Section 30 revision already flagged as an open item in `PROJECT_DECISIONS.md` Section 34. |
| A-2 | Whether operators can create/edit Content Types in v1, or Content Types are fixed seed data. | `01-vision-and-scope.md` (product decision) or this PRD, pending your input. |
| A-3 | Whether a Prompt/Template Version can ever be hard-deleted. | `03-technical-requirements.md` or a revision here. |
| A-4 | Whether Content Profile "delete" is soft-delete only in v1. | `03-technical-requirements.md`. |
| A-5 | Allowed values for Prompt/Template Status field. | `03-technical-requirements.md` or `05-database-schema.md`-equivalent. |
| A-6 | Behavior when the platform is offline at a scheduled run time (skip vs. run late). | `04-system-architecture.md` (scheduling design). |
| A-7 | Behavior on Hybrid-mode rejection (auto-regenerate vs. terminal state requiring new manual run). | Product decision — recommend resolving here before `03-technical-requirements.md`. |
| A-8 | Acceptable latency between a Domain Event and its Notification appearing. | `03-technical-requirements.md` or `04-system-architecture.md`, per `01-vision-and-scope.md`'s own Document Control note. |
| A-9 | **(New, this revision)** "Waiting/Active/Delayed/Failed" queue-status terminology (Section 17) is used without a `00-glossary.md` entry, a technical Section 35 process violation as written. | `00-glossary.md` — needs an explicit addition before this document can be considered fully consistent. |
| A-10 | **(New, this revision — highest priority)** "Generated Content" is introduced as a first-class entity distinct from Job, with no basis in `00-glossary.md` or `PROJECT_DECISIONS.md`. Whether the platform actually persists generated output separately from the Job record that produced it is an unconfirmed architectural assumption. | `00-glossary.md` (term definition) and `03-technical-requirements.md`/`04-system-architecture.md` (whether it's actually buildable as described) — recommend resolving before those documents are written, not after. |
| A-11 | **(New, this revision)** Generated Content Management has no dedicated Dashboard Module in the frozen Section 30 list (same category of gap as A-1 for Prompt Library). | Same resolution path as A-1 — the Section 30 revision already flagged as an open item in `PROJECT_DECISIONS.md` Section 34. |
| A-12 | **(New, this revision)** FR-JOB-07 (Clone a Job for rerun) and FR-GC-04 (Duplicate Generated Content into a new Job) may be the same operator-facing capability described twice from two different conceptual entry points (Job vs. Generated Content). | Product decision — recommend resolving here, before `03-technical-requirements.md`, to avoid building two mechanisms for one intent. |
| A-13 | **(New, this revision)** FR-JOB-04/05 (Pause/Resume) and FR-JOB-06 (Restart from failed stage) assume the Content Pipeline Job can persist and resume from intermediate state — not guaranteed by `PROJECT_DECISIONS.md` Section 18.1's single-long-lived-job architecture. | `03-technical-requirements.md` or `04-system-architecture.md` — must be confirmed feasible before these three FRs are treated as committed v1 capabilities rather than conditional ones. |

---

## 21. Traceability Matrix

| Goal / MVP Item (`01-vision-and-scope.md`) | Covered by |
|---|---|
| G1 — Generate original text, never fabricate attribution | FR-GEN-01, FR-GEN-02 |
| G2 — Render into short vertical video, correct multi-script | FR-TPL-03, FR-REN-01, FR-REN-02 |
| G3 — Publish on schedule, 2–4 videos/day | FR-AUT-02, FR-PUB-01, FR-CHN-01 |
| G4 — Per-Channel Automation Mode control | FR-AUT-01, FR-AUT-03 |
| G5 — Every failure visible and attributable | FR-GEN-01 (edge case), FR-MON-01, FR-MON-02 |
| G6 — Near-zero operational cost | Not directly an FR — enforced by constraints this PRD does not weaken (no FR introduces a paid dependency) |
| G7 — Workspace-ready schema, no multi-tenant logic built | FR-WS-01 |
| MVP: Manage Channels | FR-CHN-01, FR-CHN-02 |
| MVP: Manage Content Profiles | FR-CFG-01 – FR-CFG-04 |
| MVP: Manage a Prompt Library | FR-PRM-01 – FR-PRM-03 |
| MVP: Manage a Template Library | FR-TPL-01 – FR-TPL-03 |
| MVP: Generate and render content | FR-GEN-01, FR-GEN-02, FR-REN-01, FR-REN-02 |
| MVP: Schedule publishing | FR-AUT-02 |
| MVP: Choose Automation Mode per Channel | FR-AUT-01 |
| MVP: Publish to real platforms | FR-PUB-01, FR-CHN-03 |
| MVP: Review Publishing History | FR-PUB-02 |
| MVP: Receive failure/status Notifications | FR-MON-02 |
| MVP: View system Logs | FR-MON-03 |
| MVP: Operate via frozen Dashboard Modules | FR-NAV-01, FR-NAV-02, FR-NAV-03, FR-NAV-04 |
| *(Not an MVP item — added this revision, traced to Goals only)* Job Management (view/retry/cancel/pause/resume/restart/clone) | FR-JOB-01 – FR-JOB-07 → G4, G5, G6 |
| *(Not an MVP item — added this revision)* Queue Management | FR-QUE-01 – FR-QUE-08 → G4, G5 |
| *(Not an MVP item — added this revision)* Generated Content Management | FR-GC-01 – FR-GC-06 → G5, G6 (pending A-10 resolution) |
| *(Not an MVP item — added this revision)* Prompt/Template/Asset testing & preview | FR-PRM-04, FR-TPL-04, FR-AST-03 → G1, G2 |
| *(Not an MVP item — added this revision)* Global Search | FR-NAV-04 → G5 |

Every Goal (G1–G7) and every MVP bullet from `01-vision-and-scope.md` Section 8 has at least one covering FR. **The five rows marked "Not an MVP item" above are traced to Goals but not to a literal MVP checklist bullet in `01-vision-and-scope.md` Section 8** — added at your explicit direction this revision. Per this document's own Section 1 rule, an FR untraceable to Section 5 or Section 8 is technically scope creep pending escalation; these are logged as such rather than silently absorbed as if they had always been in scope. Recommend a corresponding lightweight update to `01-vision-and-scope.md` Section 8 at some point to close this loop, though it does not block this document's usefulness in the meantime.

---

## 22. Relationship to Other Documents

- **`PROJECT_DECISIONS.md`** — every FR above conforms to it; none contradicts it. Where an FR needed a value PROJECT_DECISIONS defers to implementation (e.g., retry limits), this PRD does not invent one.
- **`01-vision-and-scope.md`** — source of every Goal and MVP item cited above; this PRD adds no goal, no non-goal reversal, and no new constraint.
- **`00-glossary.md`** — every capitalized term above is used exactly as defined there, **with two exceptions introduced this revision and explicitly flagged, not silently absorbed:** the queue-status vocabulary in Section 17 (Assumption A-9) and the "Generated Content" entity in Section 18 (Assumption A-10). Both require a glossary update before this document is fully compliant with `PROJECT_DECISIONS.md` Section 35.
- **`03-technical-requirements.md`** onward — own every "how," every data model, every API shape, every performance number, and resolution of the Assumptions register (Section 20) above.

---

## Document Control

**Consistency self-review performed against `PROJECT_DECISIONS.md`, `00-glossary.md`, and `01-vision-and-scope.md` (this revision, v1.1):**

- No existing v1.0 Functional Requirement was rewritten, reordered, renumbered, or removed. All additions are new FRs, new sections (16, 17, 18), or explicitly-flagged extensions to an existing FR's acceptance criteria (FR-NAV-03 extends FR-NAV-02; FR-PUB-03 completes FR-PUB-02; FR-TPL-04 extends FR-TPL-03) — none of these extensions contradicts the FR it builds on.
- One pre-existing defect from the v1.0 draft was found and corrected during this pass: Section 1's cross-reference to the Assumptions register pointed at "Section 9" (Automation Mode & Scheduling) instead of the actual Assumptions section. Corrected to point at Section 20. This is a citation fix, not a content change.
- **Two genuine terminology/architecture gaps were introduced by this revision, at your explicit direction, and are not silently resolved:**
  - **Assumption A-9:** Queue-status vocabulary (Waiting/Active/Delayed/Failed, Section 17) is new terminology used ahead of a `00-glossary.md` entry — a literal Section 35 process violation until the glossary is updated.
  - **Assumption A-10 (highest priority of this revision):** "Generated Content" is introduced as a first-class entity distinct from Job, with no basis anywhere in `00-glossary.md` or `PROJECT_DECISIONS.md`. This is the most architecturally significant addition in this revision and should not be treated as a formality — it implies the platform persists generated output independently of the Job that created it, which no frozen document currently commits to.
- **Two capability overlaps were identified and flagged rather than silently merged or silently duplicated (A-12):** Job Management's "Clone Job for rerun" (FR-JOB-07) and Generated Content Management's "Duplicate into new Job" (FR-GC-04) read as the same operator intent from two different entry points.
- **Three conditional/unconfirmed-feasibility requirements were flagged rather than committed outright (A-13):** Pause (FR-JOB-04), Resume (FR-JOB-05), and Restart-from-failed-stage (FR-JOB-06) all assume the single-long-lived Content Pipeline Job (`PROJECT_DECISIONS.md` Section 18.1) can persist and resume intermediate state — not something any frozen decision currently guarantees.
- **Five new functional areas (Job Management, Queue Management, Generated Content Management, testing/preview capabilities, Global Search) trace to Goals but not to a literal bullet in `01-vision-and-scope.md` Section 8's MVP checklist** — logged in the Traceability Matrix (Section 21) rather than silently presented as if they were always in scope.
- Bulk Operations were explicitly and permanently excluded from v1 scope (Section 19), per your instruction not to leave this ambiguous.
- No technical architecture, schema, or API detail was introduced anywhere in this revision; every place a technical decision would normally be needed is logged in Section 20 as an open item.
- Every Goal (G1–G7) and every MVP checklist item from `01-vision-and-scope.md` Section 8 remains covered by at least one FR (Section 21, Traceability Matrix); the newly added FRs extend coverage, they do not reduce it anywhere.

**Contradictions found with `PROJECT_DECISIONS.md`, `00-glossary.md`, or `01-vision-and-scope.md`:** None outright — but two items (A-9, A-10) are **pending** compliance with `PROJECT_DECISIONS.md` Section 35 (glossary-first terminology rule) rather than currently compliant. I'm not going to pretend otherwise to make this look cleaner than it is: this document is functionally complete for your review, but not yet fully consistent with the frozen document set until A-9 and A-10 are closed.

**This document remains a draft pending your approval — not yet frozen.** Before generating `03-technical-requirements.md`, I'd strongly recommend resolving, in this order of priority: **A-10** (Generated Content — architecturally significant, affects data model design), **A-13** (Pause/Resume/Restart feasibility — affects whether Section 18.1's architecture needs revisiting), **A-12** (Clone Job vs. Duplicate Generated Content overlap), then **A-9, A-1, A-11** (glossary/module gaps, lower urgency, same remediation path already flagged in `PROJECT_DECISIONS.md` Section 34), then **A-7** (Hybrid rejection behavior, carried over from v1.0). The remaining items (A-2 through A-6, A-8) can reasonably ride into the technical documents that own them.
