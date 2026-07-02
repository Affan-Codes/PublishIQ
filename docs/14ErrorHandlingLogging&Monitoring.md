# Document 14: Error Handling, Logging & Monitoring
## AI-Powered Content Automation Platform

**Document Status:** Approved for Implementation Planning
**Version:** 1.0
**Depends On:** Document 03 (TRS §5.5–5.6), Document 04 (§6), Document 05 (§5.8, §5.10), Document 06 (§5.1), Document 12 (§7)
**Amends:** Document 03 (formalizes the error taxonomy only stated as a principle), Document 06 (enumerates the error codes its envelope always referenced but never defined), Document 04 (defines correlation ID propagation mechanics)
**Owner:** Founding Engineering Team

---

## 1. Executive Summary

Three prior documents each built part of an error-handling system — retryable/terminal classification (Document 03), an error envelope shape (Document 06), platform-specific error categories (Document 12) — without ever being unified into one taxonomy. This document is that unification, plus two things no document addressed at all: how a `correlation_id` actually gets created and threaded through an eight-stage asynchronous pipeline, and how alerting avoids becoming noise the owner learns to ignore.

---

## 2. Objectives

| # | Objective |
|---|-----------|
| EO-1 | Unify Documents 03, 06, and 12's independently-invented error vocabularies into one canonical taxonomy |
| EO-2 | Define exactly how `correlation_id` is generated and propagated across the queue-per-stage pipeline (Document 04 §6.1) |
| EO-3 | Define alert deduplication/throttling, since repeated failures under Document 03 §5.6's current design would email the owner once per failure with no ceiling |
| EO-4 | Make an explicit, scoped decision on metrics/observability tooling for v1 rather than leaving it implicitly "whatever gets built" |

---

## 3. Scope

Covers: canonical error code taxonomy, correlation ID generation/propagation, structured log format, alert deduplication, metrics/observability scope decision for v1.

Does not cover: general logging principles already correctly established in Document 03 §5.5–5.6 (restated only where a concrete mechanism was missing), security-relevant events (Document 13 §9's `SecurityEvent`, a distinct concern).

---

## 4. Canonical Error Taxonomy (Resolves EO-1 — The Critical Fix)

### 4.1 Structure

Every error in the system, regardless of origin (pipeline stage, API request, platform adapter, AI provider), is classified along two independent axes — this is what Documents 03/06/12 were each partially doing without a shared structure:

| Axis | Values | Set By |
|---|---|---|
| **Retry disposition** | `retryable`, `terminal` | Document 03 §5.5's original classification — unchanged, now the first axis of a two-axis system rather than the only axis |
| **Error domain** | `validation`, `auth`, `rate_limit`, `quota`, `content_policy`, `network`, `internal` | New — captures *what kind* of thing went wrong, independent of whether it's retryable |

**Why two axes instead of one flat code list?** Because Document 12 §7 already showed the same domain (e.g., `rate_limit`) has different retry implications depending on context (a transient rate limit is retryable-soon; a daily quota exhaustion is retryable-much-later) — collapsing domain and retry disposition into a single flat enum was exactly what caused Documents 03/06/12 to drift into incompatible partial systems in the first place.

### 4.2 Canonical Error Codes (Resolves Document 06 §5.1's Never-Enumerated Codes)

A representative, non-exhaustive registry — the actual list is a living document maintained in the shared schema package (Document 07 §7), but its *structure* is fixed here:

| Code | Domain | Retry | Origin | Example |
|---|---|---|---|---|
| `VALIDATION_FAILED` | `validation` | terminal | API | Request body fails schema validation |
| `STATE_CONFLICT` | `validation` | terminal | API | Illegal state transition (Document 06 §6.1.1's `409`) |
| `AUTH_INVALID_SESSION` | `auth` | terminal | API | Session expired/invalid |
| `PLATFORM_AUTH_REVOKED` | `auth` | terminal | Platform adapter | Token invalidated (Document 12 §7) |
| `PLATFORM_RATE_LIMITED` | `rate_limit` | retryable (short backoff) | Platform adapter | Graph API rate limit hit |
| `PLATFORM_QUOTA_EXHAUSTED` | `quota` | retryable (long backoff, next window) | Platform adapter | YouTube daily quota (Document 12 §6.3) |
| `AI_COST_CEILING_REACHED` | `quota` | retryable (paused until reset) | AI Generation module | Document 03 §5.4's cost ceiling |
| `CONTENT_POLICY_REJECTED` | `content_policy` | **terminal, never auto-retried** | Platform adapter / Moderation (Document 11 §6) | PI-AD-3's explicit rule |
| `NETWORK_TIMEOUT` | `network` | retryable (standard backoff) | Any external call | Generic transient failure |
| `INTERNAL_ERROR` | `internal` | terminal (surfaced for manual investigation) | Any | Unclassified/unexpected — deliberately not silently retried, since an unclassified error retried blindly is how Document 03 §5.5's "no silent catches" rule gets violated in spirit even while technically logging something |

**This table is the single source of truth Document 06's error envelope, Document 07's frontend error-to-message lookup, and Document 12's platform error handling all reference** — none of those documents need to be rewritten, they simply now point at one real registry instead of three each assuming their own was complete.

---

## 5. Correlation ID Generation & Propagation (Resolves EO-2)

### 5.1 The Gap

`ContentStateEvent.correlation_id` and `PublishAttempt.correlation_id` (Document 05 §5.8, §5.10) both assume a correlation ID exists and is consistently attached. No document ever specified where it comes from or how it survives being passed through eight separate BullMQ queues (Document 04 §6.1), especially given Document 04 AD-5 deliberately minimizes job payloads to just the content item ID — which raises a real question: is correlation ID re-derived at each stage, or explicitly carried forward?

### 5.2 Resolution

**A correlation ID is generated exactly once, at pipeline entry** (either the Scheduler's repeatable job firing, Document 04 AD-1, or a manual "Generate now" request, Document 09 §7.3) and stored as a field on the `ContentItem` row itself at creation (not just passed job-to-job) — this is the one piece of context genuinely worth the minor redundancy of a database read, given Document 04 AD-5 already established every stage re-reads current state from the database rather than trusting in-flight payloads.

**Consequence:** every subsequent pipeline stage's worker, on picking up a job for a given `content_item_id`, reads the correlation ID directly from that row — it does not need to be separately threaded through each queue's job payload at all. This is a cleaner resolution than payload-threading: it can't drift out of sync across retries (Document 04 §6.1's retry model already re-reads state fresh), and it's automatically available to every stage without each queue's producer needing to remember to forward it.

**Exception — publishing:** since a `ContentItem` can have multiple `PublishingJob`s (one per platform, Document 05 §6), each `PublishAttempt` uses the parent `ContentItem`'s correlation ID plus its own `publishing_job_id` (already present per Document 05 §5.10) to distinguish which platform's attempt a given log line belongs to — the correlation ID ties everything back to *one generation run*, the job/attempt IDs disambiguate *which platform's leg* of that run within it.

---

## 6. Structured Log Format (Extends Document 03 §5.6)

Every log line, regardless of stage or module, includes at minimum:

| Field | Purpose |
|---|---|
| `timestamp` | Standard ISO 8601 |
| `level` | `debug`/`info`/`warn`/`error` — `error` reserved specifically for `terminal`-classified errors (§4.1) or genuinely unexpected conditions, not routine `retryable` failures, which log at `warn` — this distinction matters because it's what makes log-level-based alerting (§7) meaningful rather than noisy |
| `correlation_id` | Per §5.2, present on every pipeline-related log line |
| `content_item_id` | When applicable |
| `error_code` | Per §4.2's registry, when the log line represents an error |
| `module` | Which module (Document 04 §5.2) emitted the line — aids debugging without needing to infer from message text |
| `message` | Human-readable detail |

---

## 7. Alert Deduplication & Throttling (Resolves EO-3)

Document 03 §5.6 defined three alert triggers but not their behavior under repetition. Resolution:

| Rule | Detail |
|---|---|
| Deduplication window | Identical alert conditions (same `error_code` + same underlying entity, e.g., the same `PlatformAccount`) within a configurable window (default: 1 hour) are collapsed into a single notification, not repeated per occurrence |
| Escalation, not repetition | If a deduplicated condition persists beyond the window, a follow-up alert is sent — but explicitly labeled as a continuation ("still failing, first seen at [time]"), not a fresh, context-free alert |
| Severity-based channel | `terminal`, `content_policy`-domain, and auth-domain errors alert immediately (per Document 03 §5.6's existing channel); `retryable` errors only alert if they exceed Document 03 §5.5's configured max-retry count without resolving — a single transient network blip retried successfully should never reach the owner's inbox |

This directly prevents the realistic failure mode Document 03 §5.6 left open: a platform outage causing repeated publish failures would, without this, generate one email per failed attempt across every queued item — exactly the kind of alert fatigue that trains an owner to stop reading alerts, defeating the entire purpose of having them.

---

## 8. Metrics & Observability Scope Decision (Resolves EO-4)

**Explicit decision, not left ambiguous:** v1 does **not** stand up a dedicated metrics/observability stack (e.g., Prometheus + Grafana). Existing pieces already cover the real v1 need:

| Need | Covered By |
|---|---|
| Queue depth, stalled jobs, worker throughput | Bull Board (Document 04 §15) |
| System-level health (DB/Redis/worker liveness) | `/health` endpoint (Document 03 §5.6) + Dashboard System Health widget (Document 10 §4.2) |
| Pipeline-level history/success-failure trends | `ContentStateEvent` and `PublishAttempt` tables (Document 05 §5.8, §5.10) — already the foundation flagged for future analytics (Document 05 §13) |
| Debug-level detail | External structured log store (Document 03 §5.6) |

**Rationale:** a dedicated metrics stack is genuine value at meaningful scale or multi-tenant operation — for a single owner at Document 01 A4's stated low volume, it's infrastructure to maintain with no corresponding operational need yet. This is a direct application of Document 01's "avoid premature optimization" principle, made into an explicit decision rather than an implicit omission someone might later mistake for an oversight.

**Revisit trigger (not a vague "someday"):** if/when the system moves toward multi-tenant SaaS (Document 01 Future Goal) or queue depth/failure investigation via Bull Board alone becomes genuinely insufficient in practice, that's the concrete signal to add dedicated metrics tooling — not a calendar date or arbitrary volume guess.

---

## 9. Architecture Decisions

| ID | Decision | Rationale |
|---|---|---|
| ERR-AD-1 | Two-axis error taxonomy (retry disposition × domain), one canonical registry | Resolves three documents' independently-drifted partial systems into one source of truth |
| ERR-AD-2 | Correlation ID stored on `ContentItem` at creation, read fresh by each stage rather than threaded through job payloads | Simpler, can't drift under retries, consistent with Document 04 AD-5's existing re-read-from-database philosophy |
| ERR-AD-3 | Alert deduplication with escalating continuation notices, severity-gated immediacy | Prevents alert fatigue from undermining Document 03 §5.6's alerting requirement in practice |
| ERR-AD-4 | No dedicated metrics stack for v1, explicit revisit trigger defined | Avoids premature infrastructure while making the decision traceable and reversible on a real signal, not silently skipped |

---

## 10. Tradeoffs

| Tradeoff | Gain | Cost | Verdict |
|---|---|---|---|
| Correlation ID on `ContentItem` vs. threaded through every job payload | Simpler, retry-safe, no payload bloat | One extra field read per stage (already reading the row anyway per AD-5) | Accept — negligible cost given the read was already happening |
| Deduplication/escalation alerting vs. simple per-occurrence alerts | Prevents alert fatigue, keeps alerts meaningful | Slightly more implementation complexity (tracking dedup windows, escalation state) | Accept — an ignored alert system provides zero value regardless of how technically correct its trigger conditions are |
| No dedicated metrics stack for v1 | No added infrastructure/maintenance burden | Deeper trend analysis (e.g., "success rate by platform over 90 days") requires manual querying of `PublishAttempt` rather than a dashboard | Accept — this is directly the kind of premature optimization Document 01 warned against; the data isn't lost (it's in Postgres), just not pre-visualized |

---

## 11. Assumptions

- **EA-1:** The error code registry (§4.2) will grow over time as new platforms/providers are added (Document 01 Future Expansion) — it's designed as a living, extensible list, not a fixed final set.
- **EA-2:** A 1-hour default deduplication window (§7) is a reasonable starting point; like Document 11's similarity thresholds, this is expected to need real-world tuning, not treated as precisely correct on day one.

---

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Error taxonomy (§4) implemented inconsistently across modules — some code paths use ad hoc error strings instead of the registry | Medium-High — reintroduces exactly the drift this document exists to fix | Recommend the shared schema package (Document 07 §7) include the error code enum as a shared type, making ad hoc strings a type error, not just a convention violation |
| Alert deduplication (§7) accidentally suppresses a genuinely new, distinct problem because it superficially matches a dedup key | Low-Medium | Dedup keys are scoped narrowly (exact `error_code` + exact entity), not broadly by category — reduces false-collapse risk |
| "No metrics stack" decision (§8) is later treated as permanent rather than the explicitly reversible, triggered decision it actually is | Low | The revisit trigger is stated concretely in §8 specifically to prevent this — worth restating in Document 01's Future Expansion section too, so it isn't only found here |

---

## 13. Future Expansion

- The error code registry (§4.2) is the natural foundation for a future public API's documented error responses (Document 06 Future Expansion) — already structured for external consumption
- `ContentStateEvent`/`PublishAttempt` data (§8) becomes the direct data source for the future Analytics dashboard section (Document 01, Document 05 §13) — no new instrumentation needed, just new visualization on data already being captured
- Dedicated metrics stack (§8) added on the defined trigger, not preemptively

---

## 14. Open Questions

| ID | Question | Recommendation |
|---|---|---|
| OQ-30 | Should the correlation ID (§5.2) be a UUID generated application-side, or leverage BullMQ's own job ID in some way? | Recommend an independently-generated UUID stored on `ContentItem` — coupling it to BullMQ's job ID would tie a business-meaningful identifier to an infrastructure implementation detail that could change, violating the same abstraction discipline applied everywhere else in this document set (storage references, platform adapters, etc.) |
| OQ-31 | Should the 1-hour deduplication window (§7) be globally configured or per-error-domain? | Recommend global for v1 with a single `Settings` value — per-domain tuning is real future refinement, not worth the added configuration surface before real alert-volume data exists to justify it |

---

## 15. Industry Best Practices Applied

- **Two-dimensional error classification (type × retryability)** — standard practice in mature distributed/queue-based systems, avoiding the common anti-pattern of a single flat error enum that different parts of a system interpret inconsistently
- **Correlation IDs generated once at the transaction's true origin** — standard distributed-tracing practice, here adapted to a single-process queue system rather than true microservices, but the principle (one ID per logical operation, readable everywhere) is the same
- **Alert deduplication/escalation over raw per-event alerting** — standard SRE/on-call practice specifically to preserve alert signal quality
- **Explicit, triggered infrastructure decisions over silent omission** — treating "we're not building X yet" as a stated, reversible decision rather than an implicit gap is itself a best practice this entire document set has now applied repeatedly (Document 03's staging environment, this document's metrics stack)

---

## 16. Production Considerations

- The error code registry (§4.2) should be enforced in CI (Document 03's existing CI gate) via the shared-type mechanism noted in §12's risk mitigation — a registry that's just documentation, not enforced by the type system, will drift the same way the pre-unification version did
- Alert deduplication state (§7) needs its own cleanup/expiry — a dedup window tracker that never expires stale entries is a small but real memory/storage leak over long uptime

---

## 17. Recommendations

1. Treat §4's error taxonomy as a required amendment to Document 06 (the error envelope needs the actual registry it always assumed existed) and a required update to Document 07's shared schema package — this is where drift gets structurally prevented, not just documented.
2. Resolve OQ-30 in favor of an independent correlation UUID — consistent with every other abstraction-boundary decision made across this document set.
3. With this document, error handling, logging, and monitoring are now specified end-to-end and reconciled across the three documents that previously handled pieces of it independently. This is a genuinely good stopping point for new documents — the case for the Cross-Document Consistency Audit is now as strong as it's going to get without actually doing it.

---

**End of Document 14 — Error Handling, Logging & Monitoring**