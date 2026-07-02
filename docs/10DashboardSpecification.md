# Document 10: Dashboard Specification
## AI-Powered Content Automation Platform — Dashboard (Home) Screen Deep-Dive

**Document Status:** Approved for Implementation Planning
**Version:** 1.0
**Depends On:** Document 02 (PRD §4.1, §4.11, FR-13), Document 06 (API Specification), Document 09 (UI/UX Specification §6.1, §4)
**Scope Note:** This document covers **only** the Dashboard/home route in operational, implementation-ready detail — exact metrics, refresh behavior, and action semantics. It does not re-specify layout regions (Document 09 §6.1 already does that) or other dashboard sections (already covered across Documents 02 and 09).
**Owner:** Founding Engineering Team

---

## 1. Executive Summary

Document 09 §6.1 established *what regions* the Dashboard route contains. This document establishes *exactly what data populates them, how fresh it is, and what happens when the owner interacts with it* — the level of detail an engineer actually needs to build the screen without guessing. It also resolves two things left genuinely undefined across the entire prior document set: how dashboard data is fetched efficiently, and what "pause the pipeline" (Document 02 FR-13) actually does.

---

## 2. Objectives

| # | Objective |
|---|-----------|
| DBO-1 | Define a single, efficient data-fetching contract for the Dashboard, closing the gap Document 06 left open |
| DBO-2 | Give every metric shown on the Dashboard a precise definition — no ambiguous terms like "recent" or "today" left to implementation guesswork |
| DBO-3 | Define "Pause pipeline" and "Resume" with exact mechanical behavior, since Document 02 FR-13 stated the feature but never its semantics |
| DBO-4 | Specify graceful degradation when the Dashboard's own health checks fail — the irony of an unreliable reliability screen is a real risk worth designing against explicitly |

---

## 3. Scope

Covers: Dashboard data contract, metric definitions, refresh/caching behavior, Quick Action semantics, degraded-state handling.

Does not cover: visual layout (Document 09 §6.1), design tokens (Document 08), other dashboard sections.

---

## 4. Data Contract (Resolves DBO-1 — The Critical Fix)

### 4.1 The Problem

Document 06 defined per-resource endpoints (`content-items`, `publishing-jobs`, `platform-accounts`, `logs`, health checks) but no Dashboard-specific endpoint. A literal implementation of Document 09 §6.1's regions would require the frontend to independently query: content item counts by outcome, queue depth, platform account list, recent `ContentStateEvent`s, and two separate health endpoints — five to six round trips on every single load of the screen the owner sees most often.

### 4.2 Resolution — New Endpoint (Amends Document 06)

**`GET /api/v1/dashboard/summary`** — a single, purpose-built aggregate endpoint, added to Document 06's resource list. Returns, in one payload: today's succeeded/failed/queued counts, next scheduled generation time, denormalized platform status list (reads `PlatformAccount.status`, Document 05 §5.2 — cached, not live-checked), the 10 most recent `ContentStateEvent`s formatted for the activity feed, and the onboarding checklist completion state (Document 09 §4.2).

**Explicitly excluded from this endpoint:** the live platform reachability check (Document 06 §6.10 `GET /health/platforms`) and system health (`GET /health/system`) remain separate, on-demand calls — consistent with Document 06's own existing distinction between cached status and live-checked status. Folding a live network check into the primary dashboard load would reintroduce the exact latency problem this endpoint exists to solve.

**Frontend consumption:** one TanStack Query key (`['dashboard', 'summary']`) backs the entire screen except the two live health checks, which are separate queries with their own loading states — so a slow platform health check never blocks the rest of the screen from rendering (directly satisfies Document 02's NFR that the dashboard shouldn't wait on live platform calls).

---

## 5. Metric Definitions (Resolves DBO-2)

| Metric | Precise Definition |
|---|---|
| "Jobs succeeded today" / "Jobs failed today" | Count of `PublishAttempt` rows (Document 05 §5.10) with `outcome: success`/`failure`, `attempted_at` within the current calendar day **in the owner's configured timezone** (see Open Questions OQ-22 — timezone must be an explicit setting, not assumed) |
| "Currently queued" | Count of `PublishingJob` rows with `current_status: queued` (Document 05 §5.9) — does not include `publishing` (in-flight) as "queued," these are shown as a distinct state if surfaced at all |
| "Next scheduled generation time" | The soonest upcoming trigger across all enabled `ScheduleConfig` rows (Document 05 §5.12), computed server-side from the cron expression — never computed client-side from a raw cron string |
| "Recent activity" | The 10 most recent `ContentStateEvent` rows (Document 05 §5.8) across all content items, **not** filtered to failures only — successes are part of "recent activity" too, since an all-failures feed would misrepresent a healthy system as constantly failing |
| Platform status badge | Directly reflects `PlatformAccount.status` (`connected`/`expiring_soon`/`expired`/`error`) — this is the cached value (§4.2), refreshed whenever a live health check (§4.2 exclusion) is manually run or a scheduled background recheck occurs (frequency defined in Document 03's operational config, not repeated here) |

---

## 6. Quick Actions — Precise Semantics

### 6.1 "Generate Now" (Document 09 §7.3 — cross-referenced, unchanged)

No change from Document 09's flow specification. Included here only for completeness of the Quick Actions region.

### 6.2 "Pause Pipeline" / "Resume" (Resolves DBO-3 — The Second Critical Fix)

Document 02 FR-13 states this capability exists and defines nothing about what it does. Left undefined, "pause" could plausibly mean: stop new generation only, stop all queue processing entirely, or stop publishing specifically while still generating. Those are three very different systems. Resolved here:

**"Pause Pipeline" means: the Scheduler's repeatable job trigger (Document 04 AD-1) is disabled.** Concretely:

| Continues Unaffected | Stops |
|---|---|
| Already-queued jobs at any stage continue to completion (generation, validation, media, publish, verify) | No new `generate-content` jobs are enqueued by the schedule |
| Manual "Generate now" (§6.1) still works — pausing the *schedule* does not disable *manual* triggering, these are deliberately independent per Document 04 §6.3's shared trigger mechanism | — |
| Already-approved items still publish on their configured delay | — |

**Rationale:** a full stop-everything pause would leave content mid-pipeline in an ambiguous state (Document 02's state machine has no "paused" state for individual items — introducing one would be a meaningfully larger change than what FR-13 actually calls for). Stopping only the *trigger for new work* while letting in-flight work complete is both simpler to implement correctly and more predictable for the owner — "pause" stops new things from starting, it doesn't freeze things already in motion.

**Resume** simply re-enables the scheduler trigger; it does not require the owner to "catch up" on missed scheduled runs — a missed run is simply skipped, the next run fires at its next natural scheduled time.

**UI representation:** the Quick Action button reflects current state (shows "Resume" when paused, "Pause Pipeline" when active) and is backed by `PATCH /api/v1/schedule-configs` applied to all schedules at once (a bulk convenience over Document 06 §6.8's per-schedule endpoint — implementation detail, not a new architectural concept).

---

## 7. Degraded-State Handling (Resolves DBO-4)

| Failure | Dashboard Behavior |
|---|---|
| `/dashboard/summary` itself fails or times out | Full-screen error state with retry action — this is the one case where a broken Dashboard genuinely can't render partial data, since it's the single source for most of the screen (§4.2) |
| Live platform health check fails/times out (separate query, §4.2) | The platform health strip shows its last-known cached status (from the summary payload) with a small "last verified: [time]" note and a manual recheck action — never blocks or blanks the rest of the screen |
| System health check fails/times out | Same pattern as platform health — cached/last-known state shown, live check is additive, not blocking |

This directly implements Document 02 §14's "degrade gracefully" production consideration, made concrete for the one screen where degrading gracefully matters most, since it's the screen the owner checks specifically *to find out if something's wrong* — a fragile Dashboard is the worst possible place for fragility to live.

---

## 8. Architecture Decisions

| ID | Decision | Rationale |
|---|---|---|
| DB-AD-1 | Single `/dashboard/summary` aggregate endpoint, added to Document 06 | Eliminates a 5–6 call waterfall on the most frequently loaded screen; directly serves the existing Document 02 responsiveness NFR |
| DB-AD-2 | Live health checks remain separate from the summary endpoint | Preserves Document 06's existing cached-vs-live distinction; prevents a slow network check from blocking the whole screen |
| DB-AD-3 | "Pause" stops the scheduler trigger only, in-flight work always completes | Simpler, more predictable mental model; avoids introducing a new per-item "paused" state not present anywhere in Document 05's state machine |
| DB-AD-4 | "Today" boundary uses an explicit owner-configured timezone, not server or browser timezone assumed implicitly | Prevents a metric (jobs succeeded/failed "today") from silently changing value depending on which machine computes it |

---

## 9. Tradeoffs

| Tradeoff | Gain | Cost | Verdict |
|---|---|---|---|
| Dedicated aggregate endpoint vs. reusing existing list endpoints with small limits | Single round trip, purpose-built payload shape | One more endpoint to maintain, some overlap in underlying queries with existing resource endpoints | Accept — the performance and simplicity gain for the most-visited screen outweighs the maintenance of one additional, narrowly-scoped endpoint |
| Scheduler-only pause vs. a full pipeline freeze | Simple, predictable, no new state machine states | An owner who genuinely wants to halt *everything mid-flight* (e.g., discovered a serious content issue) doesn't get that from this button | Accept for v1 — flagged explicitly in Open Questions (OQ-23) rather than silently deciding the harder case doesn't matter |

---

## 10. Assumptions

- **DBA-1:** The owner is a single person in a single timezone — the timezone setting (OQ-22) is a single global value, not per-content-type or per-platform.
- **DBA-2:** A 5–6 call waterfall was a real, not theoretical, risk — reasonable given Document 09 §6.1 independently lists that many distinct data sources for one screen with no aggregation mechanism previously defined.

---

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| `/dashboard/summary` becomes a dumping ground as new widgets get added over time ("just add it to the summary endpoint") | Medium | Recommend a scoping rule: only data genuinely needed for the initial Dashboard render belongs in this endpoint; anything requiring its own filtering/pagination (i.e., anything that's really its own screen's data) stays as a separate call |
| Owner discovers "Pause" doesn't stop an in-flight publish they specifically wanted stopped | Low-Medium | Directly flagged in Open Questions (OQ-23) rather than assumed acceptable — worth a real decision, not a default |

---

## 12. Future Expansion

- `/dashboard/summary` extends to include future Analytics widgets (Document 01 Future Expansion) as additional fields, not a new endpoint, as long as the scoping rule in §11 is respected
- A per-platform pause (distinct from the global pause defined here) is a natural extension if the owner's usage patterns show a need for it — not built preemptively, since Document 02 FR-13 only ever described a single pipeline-wide control

---

## 13. Open Questions

| ID | Question | Recommendation |
|---|---|---|
| OQ-22 | Where does the owner's timezone setting live — a new field in `Settings` (Document 05 §5.13), or inferred from the server's deployment region? | Recommend an explicit `Settings` field, defaulting to the server's timezone at first run but editable — matches Document 08 §11's principle of not hiding meaningful decisions behind silent assumptions |
| OQ-23 | Should a more aggressive "Emergency Stop" (cancel in-flight jobs too, not just future ones) exist alongside the softer "Pause" defined here? | Recommend deferring to a genuine incident before building it — an emergency-stop control designed speculatively, without a real incident shaping its exact requirements (e.g., does it cancel `publishing`-in-progress jobs mid-API-call? what happens to a half-completed publish?), is more likely to be built wrong than useful |

---

## 14. Industry Best Practices Applied

- **Backend-for-frontend (BFF) style aggregate endpoint for a dashboard screen** — standard pattern specifically for high-traffic, multi-source summary views, avoiding request waterfalls
- **Explicit timezone handling for date-boundary metrics** — standard practice; "today" is one of the most common silent-bug sources in dashboards built without this being made explicit
- **Separating cached/denormalized status from live verification** — standard pattern (seen in most monitoring/ops tools) for keeping a primary view fast while still offering real-time verification on demand

---

## 15. Production Considerations

- The `/dashboard/summary` endpoint's query performance should be validated against Document 05 §7's indexes specifically — this endpoint's whole purpose is speed, so it must not become the one slow call that undermines the entire objective
- "Today" boundary computation must correctly handle daylight saving time transitions, not just a fixed UTC offset — a naive fixed-offset implementation will produce a wrong boundary twice a year

---

## 16. Recommendations

1. Amend Document 06 to formally include `GET /api/v1/dashboard/summary` — this document defines it, but the API Specification is the canonical source for endpoint inventory and should reflect it too, to avoid this endpoint existing only in a document someone might not think to check.
2. Resolve OQ-22 before implementation — timezone ambiguity is a small decision now and a confusing, hard-to-retrofit bug later.
3. Leave OQ-23 (Emergency Stop) genuinely open rather than deciding it speculatively — this is one of the few cases in this entire document set where "wait for real usage data" is the right call, not a deferral of laziness.

---

**End of Document 10 — Dashboard Specification**