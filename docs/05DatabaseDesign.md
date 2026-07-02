# Document 05: Database Schema & Data Model Design
## AI-Powered Content Automation Platform

**Document Status:** Approved for Implementation Planning
**Version:** 1.0
**Depends On:** Document 01 (Vision & Scope), Document 02 (PRD), Document 03 (TRS), Document 04 (System Architecture)
**Owner:** Founding Engineering Team

---

## 1. Executive Summary

This document defines the entities, relationships, and constraints for the PostgreSQL data model, implemented via Prisma per Document 03 TR-3. It resolves three things the prior documents described functionally but never modeled structurally: how tenant-shaped-but-single-tenant data actually looks in a schema, how "immutable publishing history with retry lineage" (Document 02 §4.4) is enforced by structure rather than convention, and where the line sits between database-stored pipeline state and externally-shipped debug logs (Document 03 §5.6).

No SQL or Prisma syntax is included here by design — this is the conceptual data model. Literal schema syntax is an implementation task, not an architecture decision.

---

## 2. Objectives

| # | Objective |
|---|-----------|
| DO-1 | Model every entity with a tenant boundary from day one (Document 01 AD "tenant-shaped schema"), enforced structurally, not by convention |
| DO-2 | Make "immutable publishing history" a structural guarantee — a table design that cannot be silently mutated by normal application code, not just a documented rule |
| DO-3 | Support the full content-item state machine (Document 02 §6) without needing schema changes when the approval gate (OQ-1) is toggled on |
| DO-4 | Define indexes that actually support the dashboard's real query patterns (Document 02 §4.2–4.4), not indexes added reflexively |
| DO-5 | Draw a clear line between what lives in Postgres versus the external log store, so neither system becomes the wrong tool for the other's job |

---

## 3. Scope

Covers: entity definitions, relationships, key constraints, indexing strategy, tenant boundary implementation, retention/soft-delete strategy.

Does not cover: literal SQL/Prisma schema syntax, migration strategy details, query optimization beyond indexing strategy.

---

## 4. Tenant Boundary Strategy

**Decision (resolves Document 01 AD "tenant-shaped schema, hardcoded single value"):** every tenant-scoped entity carries an `owner_id` field (UUID, foreign key to the `Owner` entity defined below). In v1, exactly one `Owner` row exists. No row-level security or cross-tenant isolation enforcement is implemented in v1 (Document 01 explicitly scopes tenancy *enforcement* out) — but every query in the Application layer (Document 04 §5.1) filters by `owner_id` as a matter of code convention, so that adding real multi-tenant isolation later is a matter of turning an already-present filter into an *enforced* one (e.g., via Postgres row-level security), not adding a column to every table retroactively.

---

## 5. Core Entities

### 5.1 `Owner`

Represents the account holder. Single row in v1; becomes the tenant root entity in a future multi-user SaaS.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `email` | String, unique | Used for login and alerting (Document 03 §5.6) |
| `password_hash` | String | Document 03 security requirements apply |
| `created_at` | Timestamp | |

### 5.2 `PlatformAccount`

One row per connected platform (Facebook Page, Instagram Business account, YouTube channel).

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `owner_id` | UUID (FK → Owner) | |
| `platform` | Enum (`facebook`, `instagram`, `youtube_shorts`, ...) | Extensible enum per Document 04 adapter registry — new platforms add a value, not a new table |
| `display_name` | String | e.g., the Page name, shown in Document 02 §4.6 |
| `encrypted_credentials` | Encrypted text/JSON | Per Document 03 §5.3 — application-level encryption, not just column encryption |
| `token_expires_at` | Timestamp, nullable | Drives Document 02 §4.1/§4.6 expiry warnings |
| `status` | Enum (`connected`, `expiring_soon`, `expired`, `error`) | Denormalized for fast dashboard reads — recomputed on token check, not derived live on every page load |
| `enabled` | Boolean | Per-platform publish toggle (Document 02 §4.6) |
| `created_at`, `updated_at` | Timestamp | |

### 5.3 `ContentType`

Configuration entity — not hardcoded to Shayari/quotes, satisfying Document 01's extensibility requirement structurally.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `owner_id` | UUID (FK) | |
| `key` | String, unique per owner | e.g., `shayari_hindi_urdu`, `motivational_quote` |
| `display_name` | String | |
| `active` | Boolean | Allows disabling a content type without deleting its history |

### 5.4 `PromptTemplate`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `content_type_id` | UUID (FK → ContentType) | |
| `ai_provider` | Enum | Which provider adapter handles this (Document 04 §5.3) |
| `prompt_text` | Text | |
| `version` | Integer | Supports Document 02 §4.7 version history — each edit creates a new version row, previous versions retained, never overwritten |
| `is_active` | Boolean | Only one active version per content type at a time |
| `created_at` | Timestamp | |

### 5.5 `Template` (Branded Visual Template)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `owner_id` | UUID (FK) | |
| `content_type_id` | UUID (FK, nullable) | Nullable = usable across content types; set = restricted to one (Document 02 §4.5 mapping) |
| `name` | String | |
| `asset_reference` | String | Storage-abstraction reference (Document 04 Storage module), not a raw file path — keeps the DB storage-backend-agnostic per Document 01 |
| `active` | Boolean | |
| `created_at` | Timestamp | |

### 5.6 `ContentItem`

The central entity — implements the state machine from Document 02 §6.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `owner_id` | UUID (FK) | |
| `content_type_id` | UUID (FK) | |
| `prompt_template_id` | UUID (FK) | Which prompt version generated this — critical for debugging bad output back to its source |
| `raw_ai_output` | Text | Persisted before any further processing (Document 01 FR-5) |
| `caption` | Text, nullable | Populated at the caption stage |
| `hashtags` | String array | |
| `state` | Enum | `generated`, `validating`, `validated`, `pending_approval`, `approved`, `rejected`, `queued`, `publishing`, `published`, `verified`, `failed`, `discarded` — the full Document 02 §6 state machine as a single source of truth |
| `state_updated_at` | Timestamp | |
| `is_approval_gated` | Boolean | Snapshot of whether the gate was on when this item was created — so toggling the setting later doesn't retroactively change the meaning of past items' history |
| `created_at` | Timestamp | |

### 5.7 `MediaAsset`

Separated from `ContentItem` because media generation is its own retryable pipeline stage (Document 01 FR-7, Document 04 §6.1) — a content item can have a failed media generation attempt without losing its already-generated text.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `content_item_id` | UUID (FK → ContentItem) | |
| `template_id` | UUID (FK → Template) | |
| `storage_reference` | String | Storage-abstraction reference, not a raw path (same reasoning as 5.5) |
| `state` | Enum (`pending`, `generated`, `failed`) | |
| `created_at` | Timestamp | |

### 5.8 `ContentStateEvent` (Pipeline Audit Trail — Resolves the Postgres-vs-Logs Boundary)

**This is the resolution to DO-5.** Every state transition of a `ContentItem` (Document 02 §6) is recorded here — this is the queryable, joinable pipeline history the dashboard needs (Document 02 §4.2 detail view "complete stage history with timestamps"). It is **not** the same as the verbose debug logging from Document 03 §5.6, which ships to an external log aggregator and is never queried via the dashboard's data model. Conflating the two would either bloat Postgres with high-volume debug noise or starve the dashboard of the structured state history it actually needs — keeping them separate solves both.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `content_item_id` | UUID (FK) | |
| `from_state` | Enum, nullable | Null for the initial `generated` event |
| `to_state` | Enum | |
| `correlation_id` | UUID | Links to the corresponding external log entries (Document 03 §5.6) without duplicating their content here |
| `detail` | Text, nullable | Short human-readable context (e.g., failure reason summary) — not a stack trace, which stays in the external log store |
| `occurred_at` | Timestamp | |

**Immutability:** rows in this table are insert-only. No application code path updates or deletes a `ContentStateEvent` row.

### 5.9 `PublishingJob`

Represents the *intent* to publish one content item to one platform. One row per (content item, platform) pair.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `content_item_id` | UUID (FK) | |
| `platform_account_id` | UUID (FK) | |
| `current_status` | Enum (`queued`, `publishing`, `published`, `verified`, `failed`) | Mutable — this is the *current* status, deliberately separate from the immutable attempt history below |
| `scheduled_for` | Timestamp | Computed from configured delay (Document 04 §6.2) |
| `created_at`, `updated_at` | Timestamp | |

### 5.10 `PublishAttempt` (Immutable History — Resolves DO-2)

**This is the structural fix for Document 02 §4.4's "immutable history with retry lineage."** A `PublishingJob` row is allowed to change its `current_status` as retries happen (that's normal operational state). But every individual attempt is recorded here as its own **insert-only** row, so the full retry lineage is a permanent, queryable sequence — not reconstructed from a mutable status field's overwritten history.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `publishing_job_id` | UUID (FK → PublishingJob) | Links all attempts for the same job — this is the "retry lineage" (Document 02 §4.4) |
| `attempt_number` | Integer | 1, 2, 3... |
| `outcome` | Enum (`success`, `failure`, `unknown`) | `unknown` supports Document 04 §6.2's verification-ambiguity handling |
| `platform_post_id` | String, nullable | The platform's own ID for the published post — populated on success, used to build the "link to live post" (Document 02 §4.4) |
| `platform_post_url` | String, nullable | Captured at verification time |
| `error_detail`, `nullable` | Text | Human-readable error summary; full stack trace stays in external logs, linked via `correlation_id` |
| `correlation_id` | UUID | |
| `attempted_at` | Timestamp | |

**Immutability enforced the same way as `ContentStateEvent`:** insert-only, no update/delete code path.

### 5.11 `AIProviderConfig`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `owner_id` | UUID (FK) | |
| `provider` | Enum | |
| `encrypted_api_key` | Encrypted text | |
| `daily_cost_ceiling`, `monthly_cost_ceiling` | Decimal | Document 03 §5.4 |
| `current_daily_spend`, `current_monthly_spend` | Decimal | Reset on a schedule; tracked here so the cost-ceiling check is a fast local read, not a call to the provider's billing API on every generation |
| `enabled` | Boolean | |

### 5.12 `ScheduleConfig`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `content_type_id` | UUID (FK) | |
| `cron_expression` | String | Feeds the BullMQ repeatable job (Document 04 AD-1) |
| `publish_delay_seconds` | Integer | Per Document 04 §6.2 |
| `enabled` | Boolean | |

### 5.13 `Settings`

Simple key-value table for owner-level settings (approval gate toggle, retention policy values) per Document 02 §4.10 — deliberately not over-modeled as separate tables per setting, since these are few, low-churn, single-owner values.

| Field | Type | Notes |
|---|---|---|
| `key` | String (PK) | |
| `value` | Text/JSON | |
| `owner_id` | UUID (FK) | |

---

## 6. Relationships Summary

- `Owner` 1—N `PlatformAccount`, `ContentType`, `Template`, `AIProviderConfig`, `ContentItem` (via content type)
- `ContentType` 1—N `PromptTemplate`, `ContentItem`
- `ContentItem` 1—1 `MediaAsset` (v1 assumption: one media asset per item; nullable FK relationship, not enforced 1—1 at the DB level in case future content types need multiple assets — see Open Questions OQ-12)
- `ContentItem` 1—N `ContentStateEvent`
- `ContentItem` 1—N `PublishingJob` (one per platform it's published to)
- `PublishingJob` 1—N `PublishAttempt`

---

## 7. Indexing Strategy (Resolves DO-4)

Indexes are chosen against Document 02's actual dashboard query patterns, not added by default to every foreign key:

| Table | Index | Supports |
|---|---|---|
| `ContentItem` | `(owner_id, state, content_type_id)` composite | Content Library filtering (Document 02 §4.2) |
| `ContentItem` | `(owner_id, created_at DESC)` | Default recency sort |
| `PublishingJob` | `(current_status, scheduled_for)` | Publishing Queue view (Document 02 §4.3) — needs to quickly find "what's due to publish soon" |
| `PublishAttempt` | `(publishing_job_id, attempt_number)` | Retry lineage reconstruction (Document 02 §4.4) |
| `PublishAttempt` | `(attempted_at DESC)` | Publishing History date-range search (Document 02 §4.4) |
| `ContentStateEvent` | `(content_item_id, occurred_at)` | Content detail view's stage history (Document 02 §4.2) |
| `PlatformAccount` | `(owner_id, status)` | Dashboard platform health strip (Document 02 §4.1) |

---

## 8. Retention & Deletion Strategy

Resolves Document 02 OQ-6 and Document 03 OQ-8:

| Data | Retention | Deletion Mechanism |
|---|---|---|
| `ContentItem` (including `discarded`/`rejected` state) | Indefinite by default (Document 01 A-Data Retention), configurable via `Settings` | Soft — `discarded`/`rejected` is a *state*, never a row deletion. This directly satisfies Document 02 OQ-6's recommendation to retain discarded content for audit. |
| `PublishAttempt`, `ContentStateEvent` | Indefinite — these are the immutable audit trail | Never deleted by normal operation; only a future explicit retention-policy job (Document 02 §4.10) would archive/purge, and even then only past a long configurable threshold |
| External debug logs (Document 03 §5.6) | 90 days (Document 03 OQ-8 recommendation) | Handled entirely outside Postgres — confirms this table design doesn't need to carry that retention logic |

---

## 9. Architecture Decisions

| ID | Decision | Rationale |
|---|---|---|
| DD-1 | `owner_id` on every tenant-scoped table now, enforced by convention in v1 | Structural readiness for row-level security later without retroactive migration |
| DD-2 | Split mutable `PublishingJob.current_status` from immutable `PublishAttempt` rows | Makes "immutable history with retry lineage" a real database guarantee, not a documentation promise |
| DD-3 | `ContentStateEvent` as a distinct table from external debug logs | Prevents the dashboard's structured needs and the ops team's (owner's) debug needs from fighting over the same storage system |
| DD-4 | Storage references (not raw file paths) in `MediaAsset`/`Template` | Keeps the schema agnostic to local disk vs. S3/Cloudinary/R2, matching Document 01's storage abstraction requirement structurally |
| DD-5 | `is_approval_gated` snapshotted on `ContentItem` at creation | Prevents a later settings change from retroactively rewriting the meaning of historical content items |

---

## 10. Tradeoffs

| Tradeoff | Gain | Cost | Verdict |
|---|---|---|---|
| Separate `PublishingJob`/`PublishAttempt` tables vs. one table with a status history JSON column | True relational queryability of attempt history, proper indexing | Slightly more join complexity in queries | Accept — Document 02 explicitly requires searchable, filterable history; a JSON blob defeats that |
| `ContentStateEvent` as its own table vs. relying entirely on external logs | Dashboard can query stage history directly without hitting an external system | One more table, some overlap in *purpose* (though not content) with external logs | Accept — dashboard responsiveness (Document 02 NFR) requires this data be a fast local query, not a call to an external log system on every page load |
| `owner_id` everywhere now vs. adding it when multi-tenancy is actually built | Zero-migration path to tenant isolation later | Every v1 query carries a filter that's currently always the same single value | Accept — this is the specific tradeoff Document 01 already decided was worth it |

---

## 11. Assumptions

- **DA-1:** One `MediaAsset` per `ContentItem` is sufficient for Shayari/quote content types (single image). Carousels/multi-image content types (Future Expansion) will need the relationship changed from effectively-1—1 to genuinely 1—N — flagged in Open Questions.
- **DA-2:** Cost ceiling tracking (`AIProviderConfig.current_daily_spend`) is updated synchronously at generation time, not via a separate reconciliation job — acceptable at v1's call volume.
- **DA-3:** `Settings` as a key-value table is acceptable for v1's small, low-churn setting count; would need to become proper typed tables if settings grow substantially in complexity (unlikely pre-SaaS).

---

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| `owner_id` filter forgotten in a query (v1 has no enforced isolation) | Low now (single tenant, so "wrong" and "right" produce the same result), High if forgotten and multi-tenancy is later enabled | Recommend a repository-layer base class/helper that *always* injects the `owner_id` filter, so it's structurally hard to forget rather than a manual discipline |
| `ContentItem.state` enum drifts out of sync with the Document 02 §6 state machine as features evolve | Medium | State enum and transition rules should be defined once in the Domain layer (Document 04 §5.1) and the database enum kept as a mirror, not a second source of truth |
| Media relationship assumption (DA-1) breaks when carousels are added | Medium (future) | Flagged explicitly now (OQ-12) so it's a planned migration, not a surprise |

---

## 13. Future Expansion

- `MediaAsset` relationship changes from effectively-1—1 to formally 1—N when carousel/multi-image content types are added — the FK direction (`MediaAsset.content_item_id`) already supports this without restructuring, only a relationship-cardinality assumption changes
- Row-level security policies added on top of existing `owner_id` columns when real multi-tenancy is built — no column additions needed
- `ContentStateEvent` and `PublishAttempt` tables are the natural foundation for the future analytics feature (Document 01 Future Expansion) — already structured, queryable, and indexed by time

---

## 14. Open Questions

| ID | Question | Recommendation |
|---|---|---|
| OQ-12 | Should `MediaAsset` be modeled as 1—N from `ContentItem` now, even though v1 only ever creates one? | Recommend modeling the FK as 1—N now (nullable `content_item_id` FK on `MediaAsset`, no unique constraint forcing 1—1) — costs nothing today, avoids a real migration when carousels arrive |
| OQ-13 | Should `ContentStateEvent` eventually be partitioned by date given it's an append-only, ever-growing table? | Not a v1 concern at single-user volume; recommend revisiting only if row count becomes a measured problem, not preemptively |

---

## 15. Industry Best Practices Applied

- **Append-only audit tables separate from mutable operational tables** — standard pattern for systems requiring genuine audit guarantees (financial ledgers use the same split: current balance vs. immutable transaction log)
- **Tenant column present pre-emptively, enforcement added later** — well-established SaaS data-modeling pattern to avoid retroactive schema migration
- **Reference-not-raw-path storage fields** — keeps the data model decoupled from infrastructure choices, standard practice for storage abstraction
- **Denormalized status fields for dashboard reads (`PlatformAccount.status`) alongside normalized source-of-truth data** — a deliberate, scoped denormalization for read performance, not a general pattern applied everywhere

---

## 16. Production Considerations

- The immutability of `ContentStateEvent` and `PublishAttempt` should be enforced at the application/repository layer (no update/delete methods exposed for these entities) — Postgres-level `REVOKE UPDATE/DELETE` grants are a defensible additional hardening step worth considering at implementation time, not strictly required for v1
- Encrypted fields (`PlatformAccount.encrypted_credentials`, `AIProviderConfig.encrypted_api_key`) must use envelope encryption or equivalent, with the encryption key itself stored outside the database (Document 03 §5.3) — never a key stored in the same database as the data it encrypts

---

## 17. Recommendations

1. Resolve OQ-12 before implementation — modeling `MediaAsset` as 1—N now costs nothing and avoids a real future migration.
2. Implement the repository-layer `owner_id` auto-filter (§12 Risk mitigation) as a Document 04 Infrastructure-layer concern during initial build, not as an afterthought once the pattern's already been violated a few times.
3. Proceed to **Document 06: API Design** next — every entity and relationship in this document is direct input for defining the internal REST API's resource shapes.

---

**End of Document 05 — Database Schema & Data Model Design**