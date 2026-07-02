# Document 09: UI/UX Specification
## AI-Powered Content Automation Platform — Dashboard

**Document Status:** Approved for Implementation Planning
**Version:** 1.0
**Depends On:** Document 02 (PRD), Document 06 (API Specification), Document 07 (Frontend Architecture), Document 08 (Design System)
**Owner:** Founding Engineering Team

---

## 1. Executive Summary

This document specifies screen-level layout, interaction flows, and cross-entity navigation for every dashboard section defined in Document 02, using the tokens and components defined in Document 08 and the state/data patterns defined in Document 07.

It exists to answer the question none of the prior eight documents fully answered: **what does the owner actually see and do, in what order, especially on day one with an empty system?** Described in prose and structured wireframe-equivalents (region/element tables), never literal markup or code, consistent with this project's stated constraints.

---

## 2. Objectives

| # | Objective |
|---|-----------|
| UO-1 | Define a first-run/onboarding sequence that gets a new install from empty to a running pipeline in a guided order — this did not exist anywhere in Documents 01–08 |
| UO-2 | Specify every dashboard section's layout at the region level, consistent with Document 08's layout and signature-component decisions |
| UO-3 | Define cross-entity navigation (deep links between related records) so debugging a specific failure doesn't require manually searching three separate screens |
| UO-4 | Specify the concrete interaction flow for every state-transition action defined in Document 06 §6.1.1, so "Approve" or "Retry" has a defined UI sequence, not just an API endpoint |
| UO-5 | Specify responsive behavior concretely at the tablet breakpoint, resolving Document 08 §8's "tablet required" into an actual layout adaptation |

---

## 3. Scope

Covers: onboarding flow, per-section screen layout (region/element level), key interaction flows, cross-entity navigation, responsive adaptation at the tablet breakpoint.

Does not cover: visual token values (Document 08), component code, pixel-level mockups, backend behavior (Documents 04–06).

---

## 4. Onboarding / First-Run Flow (Resolves UO-1 — The Critical Fix)

### 4.1 Why This Is Required

Document 02 §14 only specifies that empty states must not break the UI. It does not specify how the owner gets from an empty system to a working one, despite real setup dependencies: a `ScheduleConfig` needs a `ContentType`; a `ContentItem` needs an active `PromptTemplate` and a `Template` (Content Template); publishing needs a connected `PlatformAccount`. Without a guided sequence, the owner is left to reverse-engineer this dependency order from 10 separate settings screens.

### 4.2 Setup Checklist (Shown on Dashboard Route Until Complete)

A persistent, dismissible-only-when-complete checklist card on the Dashboard route (Document 07 §8), replacing the normal activity feed until the system is minimally operational:

| Step | Unlocks | Completion Signal |
|---|---|---|
| 1. Connect at least one platform account | Publishing becomes possible | `PlatformAccount` exists with `status: connected` |
| 2. Configure at least one AI provider | Generation becomes possible | `AIProviderConfig` exists with `enabled: true` and a valid key |
| 3. Create or confirm a content type | Prompt templates and content templates become assignable | At least one `ContentType` exists (Shayari and quotes pre-seeded as defaults, per Document 01's stated initial focus — the owner confirms/edits rather than creating from zero) |
| 4. Create or confirm a prompt template | Generation has instructions | At least one active `PromptTemplate` per content type |
| 5. Create or upload a Content Template | Media generation has a visual base | At least one active `Template` (Content Template, per Document 08 §1 disambiguation) |
| 6. Configure a schedule (or confirm manual-only operation) | Automated generation begins, or the owner explicitly opts into manual-only | A `ScheduleConfig` exists and is either enabled, or explicitly marked as intentionally manual-only — this is a real choice, not a skipped step, since Document 02 OQ-3 already established both modes are valid |

Each incomplete step links directly to the relevant section with the specific creation action already focused (e.g., step 1 links to Platform Management with the "Connect" flow ready to start, not just the list view).

**Decision:** steps 3–5 pre-seed sensible defaults (Shayari and motivational quotes as content types, matching Document 01's stated v1 focus) rather than forcing the owner to build from an absolute blank slate — this reduces the checklist to mostly *confirming and connecting credentials*, which is the genuinely owner-specific work, rather than *re-declaring the product's own stated scope*.

### 4.3 Post-Setup

Once all steps are complete, the checklist card is replaced by the normal Dashboard activity feed (Document 02 §4.1) permanently — it does not reappear unless a previously-satisfied dependency becomes unsatisfied again (e.g., the only connected platform is disconnected), in which case a smaller inline banner (not the full checklist) prompts reconnection.

---

## 5. Cross-Entity Navigation (Resolves UO-3)

A binding rule for every screen in this document: **any reference to a related entity is a link, never plain text.** Concretely:

| From | Links To |
|---|---|
| Publishing History row / `PublishAttempt` | The `ContentItem` that produced it, the `PlatformAccount` it was published to |
| Content Item detail's pipeline timeline (Document 08 §7) failed stage | The specific `PublishAttempt` or `ContentStateEvent` detail, and the Logs view pre-filtered by that item's `correlation_id` (Document 05 §5.8, Document 06 §6.7) |
| Publishing Queue row | The `ContentItem` detail and the `PlatformAccount` it's queued for |
| Platform Health strip warning (Document 02 §4.1) | The specific `PlatformAccount` in Platform Management |
| Content Template used by a `MediaAsset` | The Content Template's detail in the Templates section |

This directly closes a real debugging gap: without it, tracing "why did this fail" from the Dashboard's activity feed down to the actual log line requires the owner to manually cross-reference IDs across three screens — something the correlation ID system (Document 05 §5.8) was built specifically to prevent, but only if the UI actually uses it.

---

## 6. Screen Specifications

### 6.1 Dashboard (Document 02 §4.1)

| Region | Content |
|---|---|
| Top | Setup checklist (§4.2) if incomplete, otherwise system status summary (jobs succeeded/failed today, queued count, next scheduled run) |
| Left sidebar | Primary navigation (Document 07 §8's 10 routes), collapsible |
| Main, left column | Platform health strip (per-platform status, links per §5) |
| Main, right column | Recent activity feed (last 10 events, each linking to its content item per §5) |
| Bottom-right, persistent | Quick actions: "Generate now," "Pause pipeline" (Document 02 §4.1) |

### 6.2 Content Library (Document 02 §4.2)

**List view:** filterable table (content type, state, platform — per Document 05 §7 indexed filters), each row showing a compact state badge (Document 08 §5 color tokens) and links to detail.

**Detail view:** the Pipeline Stage Timeline (Document 08 §7, the signature element) as the primary visual anchor at the top, followed by tabs or stacked sections for: raw AI output, media preview (rendered in content-preview typography per Document 08 §6 — Devanagari/Nastaliq as applicable), caption/hashtags (editable per Document 06 §6.1, non-state fields only), and related `PublishingJob`s per platform (linking to Publishing Queue/History per §5).

**Action buttons** (Approve/Reject/Discard/Retry, per Document 07 §6's state-to-action lookup) appear directly beneath the pipeline timeline, only when the current state makes them valid — consistent with Document 06 API-AD-1 and Document 07 FE-AD-4: the button set is a display convenience, the server remains authoritative.

### 6.3 Publishing Queue (Document 02 §4.3)

List view sorted by `scheduled_for` (Document 05 §7 index), showing countdown-to-publish per row. Reorder is drag-handle based (a genuine field update per Document 06 §6.2's `PATCH .../reorder`, not a state transition — visually distinct interaction from the state-transition action buttons in §6.2 above, to reinforce Document 06's own distinction between the two). Force-publish and Cancel are row-level actions with confirmation dialogs, since both are consequential and either skip a safety delay or discard queued work.

### 6.4 Publishing History (Document 02 §4.4)

List view with date-range, platform, and outcome filters (Document 06 §6.3). Each row links to its `ContentItem` and shows the platform-post link directly (Document 05 §5.10 `platform_post_url`) when available — no extra click required to reach the live post, since that's one of the most common reasons the owner opens this screen.

**Retry lineage view:** accessed from a row, shows all `PublishAttempt`s for that job as a small vertical sequence (visually related to, but simpler than, the Pipeline Stage Timeline — this view is about *attempts*, not the full content lifecycle, and should not be confused with §6.2's timeline).

### 6.5 Templates — Content Templates (Document 02 §4.5, Document 08 §1 disambiguation)

Grid view (visual templates benefit from thumbnail-first browsing, unlike the data-table pattern used elsewhere) filterable by content type. Detail/edit view includes the live preview action (Document 06 §6.4 `POST .../preview`) rendered inline, using content-preview typography (Document 08 §6) so the preview accurately represents what will actually be generated.

### 6.6 Platform Management (Document 02 §4.6)

Card-per-platform layout (not a dense table — there are at most a handful of platforms, and each card needs room for status, token expiry, and connect/disconnect actions). This is the primary entry point for onboarding step 1 (§4.2).

### 6.7 AI Prompt Management (Document 02 §4.7, P1)

List view per content type, with version history (Document 06 §6.6) accessed via a row expansion rather than a separate screen — keeps the common case (viewing/editing the active version) fast, while still making history available.

### 6.8 Logs (Document 02 §4.8)

Filterable, virtualized list (given potentially large volume, per Document 03 §5.6) — filters for severity, correlation ID, and content item ID (Document 06 §6.7), the last of which is how §5's cross-navigation links land here pre-filtered.

### 6.9 Scheduler (Document 02 §4.9)

Simple form-per-content-type list: cron expression (presented as a human-readable schedule builder, not a raw cron string field, since a raw cron field would violate Document 08 §11's "name things by what the operator controls" principle) and publish delay.

### 6.10 Settings (Document 02 §4.10)

Grouped sections: Approval Gate (the OQ-1 toggle, Document 01), Retention Policy, Retry Policy, AI Provider cost ceilings (Document 06 §6.11). Each setting includes inline explanation of its effect — per Document 08 §11, settings are exactly the kind of control where vague labeling causes real operator hesitation.

### 6.11 Platform Health & System Health (Document 02 §4.11)

Integrated into the Dashboard route (Document 07 §8 decision) rather than separate screens — covered in §6.1 above, not a standalone section.

---

## 7. Key Interaction Flows

### 7.1 Approve Flow (Document 06 §6.1.1)

Owner opens Content Library detail → reviews AI output/media/caption → clicks Approve → button shows inline loading state (Document 07 §5.1: no optimistic update) → on success, pipeline timeline updates to reflect `approved` state, item transitions toward `queued` → on `409`, the specific race-condition message from Document 07 §11 is shown, not a generic error.

### 7.2 Connect Platform Flow (Document 06 §6.5)

Onboarding step 1 or direct visit to Platform Management → click Connect on a platform card → redirected to OAuth provider → returns via callback → card updates to `connected` status, and if this satisfies onboarding step 1, the setup checklist (§4.2) updates in real time when the owner returns to the Dashboard.

### 7.3 Generate Now Flow (Document 02 §4.1, §4.9)

Click "Generate now" (Dashboard quick action or Content Library) → if a content type isn't specified, a lightweight picker (only shown if more than one active content type exists) → request enqueued (Document 06 §6.1 `POST`) → owner is not blocked waiting for generation to complete; a toast confirms the job was queued, and the new item appears in Content Library's list once the `generated` event is recorded (Document 05 §5.8) — consistent with Document 07 §5.1's cache invalidation strategy.

### 7.4 Retry Failed Job Flow (Document 06 §6.1.1)

From Content Library detail's failed pipeline stage, or directly from a Publishing History row (§5 cross-navigation) → click Retry → same non-optimistic, loading-then-confirm pattern as §7.1 → item re-enters the pipeline at its failed stage (Document 04 §6.1), not from scratch, and the pipeline timeline (§6.2) visually reflects this by showing the retry as a continuation, not a restarted sequence.

---

## 8. Responsive Behavior (Resolves UO-5)

| Breakpoint | Behavior |
|---|---|
| Desktop (primary, Document 08 §8) | Full sidebar + content layout as specified above |
| Tablet (P0, required) | Sidebar collapses to an icon-only rail by default (expandable on tap), data tables adopt horizontal scroll rather than reflowing into cards — reflowing tables into cards at this breakpoint would hide columns the owner needs for filtering/scanning, which matters more here than visual tidiness |
| Mobile (P2, deferred per Document 08 §8) | Not specified in this document; when built, should prioritize the Dashboard summary and approval actions (§7.1) — the two things an owner is most likely to need away from their desk — rather than full feature parity |

---

## 9. Architecture Decisions

| ID | Decision | Rationale |
|---|---|---|
| UI-AD-1 | Dedicated onboarding checklist replaces the activity feed until setup is complete, rather than a one-time modal/tour | A dismissible tour gets dismissed and forgotten; a persistent checklist tied to actual system state (not a "seen it" flag) can't be accidentally skipped past an unmet dependency |
| UI-AD-2 | Content types, prompt templates, and content templates are pre-seeded with sensible v1 defaults rather than starting fully empty | Reduces onboarding to credential/connection work, which is the part that's genuinely owner-specific; re-declaring the product's own already-stated scope (Document 01) as a setup task would be pointless friction |
| UI-AD-3 | Every cross-entity reference is a link, enforced as a blanket rule rather than case-by-case | A case-by-case approach reliably misses cases; a blanket rule is checkable in review |
| UI-AD-4 | Tablet breakpoint uses horizontal-scroll tables over card-reflow | Preserves the filtering/scanning capability the owner actually needs at this breakpoint, prioritizing function over conventional responsive-design tidiness |

---

## 10. Tradeoffs

| Tradeoff | Gain | Cost | Verdict |
|---|---|---|---|
| Pre-seeded defaults (UI-AD-2) vs. fully blank onboarding | Faster, less frustrating setup | Owner must actively review/edit defaults rather than being forced to consciously create everything | Accept — Document 01 already declared Shayari/quotes as the initial focus; treating that as a genuine default rather than re-asking the owner to declare it is consistent, not presumptuous |
| Persistent checklist (UI-AD-1) vs. a lighter one-time onboarding tour | Can't be skipped past an actual unmet dependency | Slightly more persistent UI presence during setup | Accept — the cost of a skippable tour (owner stuck on a confusing empty screen later) is worse than a checklist that stays until genuinely done |
| Horizontal scroll over card-reflow at tablet (UI-AD-4) | Preserves real filtering/scanning utility | Slightly less "native mobile-feeling" than a fully reflowed card list | Accept — this is an operational tool where the data itself is the interface's job, not a content-browsing app where cards are the natural unit |

---

## 11. Assumptions

- **UA-1:** The owner performs initial setup once, not repeatedly — the checklist (§4.2) is designed for a single onboarding pass, not a recurring workflow.
- **UA-2:** OAuth connection flows (§7.2) complete within a single browser session — no requirement for a resumable multi-session connection flow at v1.
- **UA-3:** Virtualized list rendering (§6.8 Logs) is acceptable using a standard library approach — no custom virtualization engineering required beyond what's commonly available for React data tables.

---

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Setup checklist (§4.2) never gets built because it wasn't in the original PRD's flat feature list and looks like polish rather than a requirement | High — without it, the onboarding gap this document exists to close reopens in practice | Recommend treating §4.2 as a P0 addition to Document 02's feature list retroactively, not an optional enhancement layered on top |
| Cross-entity linking rule (UI-AD-3) gets partially implemented — some screens link, others don't, creating an inconsistent experience | Medium | Recommend a review checklist item during implementation specifically verifying every entity reference on every screen against §5's table |
| Pre-seeded defaults (UI-AD-2) are wrong for an owner who wants a genuinely different first content type than Shayari/quotes | Low | Defaults are editable/removable, not locked — this isn't a real constraint, just a starting point |

---

## 13. Future Expansion

- Onboarding checklist pattern (§4.2) extends naturally to future content types/platforms (Document 01 Future Expansion) — new dependencies simply add new checklist steps
- Cross-entity linking rule (§5) extends directly to the future Analytics section (Document 01) — analytics views should link back to source records the same way history/queue views do now
- Mobile-specific onboarding/approval flow (deferred, §8) becomes relevant once real mobile usage data exists

---

## 14. Open Questions

| ID | Question | Recommendation |
|---|---|---|
| OQ-20 | Should the setup checklist (§4.2) be re-triggerable manually by the owner (e.g., to reconfigure from scratch), or only appear automatically based on unmet dependencies? | Recommend adding a manual "Review setup" entry point in Settings (§6.10) in addition to automatic triggering — costs little, avoids the owner having to artificially break a connection just to see the checklist again |
| OQ-21 | Should Retry (§7.4) from a Publishing History row behave identically to Retry from the Content Library detail view, or does the entry point change the expected scope of what gets retried? | Recommend identical behavior regardless of entry point — the retry target is the failed pipeline stage, not the screen it was triggered from; divergent behavior based on navigation path would be a confusing, hard-to-document inconsistency |

---

## 15. Industry Best Practices Applied

- **State-driven onboarding over dismissible tours** — standard practice in tools where setup has genuine dependencies (seen in most modern SaaS admin/ops tooling) precisely because tours get dismissed regardless of actual completion
- **Sensible defaults over blank-slate setup** — reduces time-to-value, standard practice balanced against not hiding meaningful choices from the user
- **Consistent cross-linking of related records** — standard practice in any admin/operational tool where debugging a specific record is a primary use case
- **Function-preserving responsive adaptation (horizontal scroll over reflow) for data-dense operational tools** — a deliberate departure from consumer-app responsive conventions, justified by this specific product's actual usage pattern

---

## 16. Production Considerations

- The setup checklist's dependency checks (§4.2) should query the same data the rest of the dashboard already displays (`PlatformAccount.status`, `ContentType` existence, etc.) — not a separate, parallel "onboarding state" system that could drift out of sync with actual system state
- Cross-entity links (§5) must degrade gracefully if the linked record has since been deleted/archived (e.g., a `Template` that was archived per Document 06 §6.4) — showing "This template has been archived" rather than a broken link or a 404

---

## 17. Recommendations

1. Treat the onboarding checklist (§4) as a retroactive P0 addition to Document 02's feature scope — it was a genuine gap, not a nice-to-have discovered late.
2. Resolve OQ-20 in favor of adding a manual re-entry point in Settings — low cost, meaningfully better experience for an owner reconfiguring their setup.
3. This document set (01–09) now covers vision, product requirements, technical requirements, system architecture, database design, API design, frontend architecture, design system, and UI/UX specification. The two previously-recommended, still-outstanding documents are the consolidated **NFR & Observability Plan** and a **Platform Integration Design** detailing Meta/YouTube-specific adapter mechanics — both remain genuinely useful before implementation begins, at your discretion.

---

**End of Document 09 — UI/UX Specification**