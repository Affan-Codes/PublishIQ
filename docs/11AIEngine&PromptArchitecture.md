# Document 11: AI Engine & Prompt Architecture
## AI-Powered Content Automation Platform

**Document Status:** Approved for Implementation Planning
**Version:** 1.0
**Depends On:** Document 01 (Vision & Scope), Document 03 (TRS §5.4), Document 04 (System Architecture §5.2–5.3), Document 05 (Database Schema)
**Amends:** Document 05 (adds `ContentEmbedding` entity, requires `pgvector` extension), Document 04 (extends `AIProvider` interface with a moderation method)
**Owner:** Founding Engineering Team

---

## 1. Executive Summary

This document specifies the AI Generation module in the detail Document 04 §5.2–5.3 left at the interface level: how prompts are actually assembled, how duplicate content is actually detected (resolving a real contradiction between Document 02's recommendation and Document 05's schema), and how content moderation actually works for Hindi/Urdu content specifically, rather than relying on tooling that was never built for these languages.

---

## 2. Objectives

| # | Objective |
|---|-----------|
| AIO-1 | Resolve the semantic-duplicate-detection requirement (Document 02 OQ-2) with a concrete, storable mechanism — not just a recommendation with no implementation path |
| AIO-2 | Replace the implicit assumption of keyword-based content moderation with an approach that actually works for Hindi/Urdu, directly addressing the risk Document 01 flagged and never resolved |
| AIO-3 | Define prompt template structure precisely enough to implement, extending Document 05 §5.4's versioning model with actual content |
| AIO-4 | Clarify that generation, moderation, and embedding are three distinct, separately-costed AI provider calls, all subject to Document 03 §5.4's cost ceiling — not just "generation" as previously implied |

---

## 3. Scope

Covers: prompt template structure, generation context assembly, duplicate detection architecture, content moderation architecture, the extended `AIProvider` interface, cost accounting across all three AI call types.

Does not cover: literal prompt text/copy (a content/product decision, not architecture), specific model selection (Document 03 already established provider-agnostic design), UI for prompt management (Document 02 §4.7, Document 09 §6.7).

---

## 4. Prompt Template Structure (Resolves AIO-3)

Extending Document 05 §5.4's `PromptTemplate` entity, each template is composed of four distinct parts, assembled at generation time rather than stored as one flat string — this matters because parts 2 and 3 below are dynamic and must not be hand-edited into the versioned template text itself:

| Part | Source | Purpose |
|---|---|---|
| System/brand instructions | Static, versioned in `PromptTemplate.prompt_text` | Tone, brand voice, target language/script, format constraints (e.g., character limit matching Document 04 §5.3 platform constraints) |
| Content-type-specific instructions | Static, versioned, part of the same template | E.g., "Write a two-line Shayari in the Ghazal tradition" vs. "Write a one-sentence motivational quote" |
| **Recent-content context (new)** | Dynamically assembled at generation time from the last N `ContentItem`s of the same content type | A short list of recent themes/openings injected as "avoid repeating these themes: [...]" — a first line of defense against repetition, complementing (not replacing) the embedding-based check in §5 |
| Dynamic variables | Provided per-generation-request (e.g., an upcoming festival name for seasonal content, per Document 01's "Festival wishes" future content type) | Keeps templates reusable across variations without a new template version for every occasion |

**Why inject recent context into the prompt itself, not rely solely on post-hoc duplicate detection?** Because prevention is cheaper than detection — if the model already knows what to avoid, fewer generations are wasted (and re-generated, incurring additional cost against Document 03 §5.4's ceiling) on content that fails the duplicate check downstream.

---

## 5. Duplicate Detection Architecture (Resolves AIO-1 — The Critical Fix)

### 5.1 The Contradiction Being Resolved

Document 02 OQ-2 recommended semantic similarity over exact-text matching for duplicate detection. Document 05's schema is pure relational Postgres with no vector storage or similarity search capability. As written, that recommendation had no implementation path.

### 5.2 Resolution

**Add the `pgvector` extension to the existing PostgreSQL database** (does not require a new database service, consistent with Document 03's managed-Postgres decision — `pgvector` is a standard extension supported by all major managed Postgres providers) and a new entity:

**`ContentEmbedding`** (amends Document 05):

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `content_item_id` | UUID (FK → ContentItem), unique | One embedding per content item |
| `embedding` | vector | Generated from the content's final text (caption or Shayari body) via an embedding-capable AI provider call |
| `model_used` | String | Embedding model identifier, since different models produce non-comparable vectors — comparisons must only ever happen within the same model's embedding space |
| `created_at` | Timestamp | |

**Process:** at the validation stage (Document 04 §6.1 `validate-content-queue`), the newly-generated content's embedding is computed, then compared via vector similarity search against embeddings of recent `ContentItem`s of the same content type (windowed — e.g., last 90 days, not the entire history, to keep the comparison set bounded and relevant). A similarity score above a configurable threshold (`Settings`, Document 05 §5.13) flags the item for the duplicate-handling path (Document 02's duplication check, FR-2).

**Indexing:** `pgvector` supports approximate nearest-neighbor indexes (e.g., IVFFlat/HNSW) — required here, not optional, since a full sequential scan comparison against a growing embedding table would violate Document 03's general performance expectations as content volume grows.

---

## 6. Content Moderation Architecture (Resolves AIO-2 — The Second Critical Fix)

### 6.1 The Problem

Document 01 explicitly flagged "AI generates culturally/religiously insensitive Shayari content" as a High-impact risk. Document 01 FR-2 requires validation including a "language-appropriate profanity/sensitivity filter, not just an English one." No document specified how. A naive implementation would reach for an off-the-shelf keyword-based profanity filter library — nearly all of which have poor-to-nonexistent Hindi/Urdu coverage, meaning the filter would pass through exactly the content it was meant to catch while giving false confidence that moderation is happening.

### 6.2 Resolution

**Moderation is implemented as a dedicated AI provider call, not a keyword filter.** This extends the `AIProvider` interface (Document 04 §5.3) with a second method beyond `generate`:

**`moderate(content, language) → ModerationResult`** — a structured call asking the model to assess the content for cultural insensitivity, religious offense, and general inappropriateness *in the specific linguistic and cultural context of the target language*, returning a classification (`pass`, `flag`, `reject`) with a brief reason. This works specifically because modern general-purpose language models have meaningfully better contextual understanding of Hindi/Urdu cultural nuance than any keyword list could — the same reason the content is AI-generated in the first place is the reason AI-based moderation is the appropriate check, not a mismatched, English-centric tooling choice bolted on afterward.

**Escalation rule (new, not previously specified anywhere):** a `flag` result — not just `reject` — automatically routes the content to `pending_approval` state (Document 02 §6 state machine), **regardless of whether the global approval gate (Document 01 OQ-1) is otherwise switched off.** A `reject` result moves the item directly to `failed` with the reason recorded (Document 05 §5.8 `ContentStateEvent.detail`). This is a meaningful refinement to Document 01's original all-or-nothing approval gate: the gate can stay off for the common case (fast, low-risk content) while borderline content still gets a human look — which is a materially better resolution to Document 01 OQ-1's original tension than either "always require approval" or "never require approval."

---

## 7. Extended `AIProvider` Interface (Amends Document 04 §5.3)

| Method | Purpose | Cost Accounting |
|---|---|---|
| `generate(prompt, config) → GenerationResult` | Original method, Document 04 §5.3 | Counts against `AIProviderConfig` ceiling (Document 03 §5.4) |
| `moderate(content, language) → ModerationResult` | New, §6.2 | **Also** counts against the same ceiling — this is a real cost previously unaccounted for anywhere in Document 03's cost model |
| `embed(content) → EmbeddingResult` | New, §5.2 | **Also** counts against the same ceiling |

**This resolves AIO-4.** Document 03 §5.4 defined a cost ceiling assuming, implicitly, that "AI provider calls" meant generation only. With moderation and embedding calls added, actual per-content-item cost is up to 3x a single generation call — the ceiling configuration and any cost estimates the owner sets must account for this, not be silently under-provisioned against real usage.

---

## 8. Architecture Decisions

| ID | Decision | Rationale |
|---|---|---|
| AI-AD-1 | `pgvector` extension on existing Postgres, not a separate vector database | Fulfills Document 02's semantic-similarity recommendation without introducing a new infrastructure component Document 03 never accounted for |
| AI-AD-2 | Moderation implemented as an AI provider call, not a keyword filter library | Keyword filters have negligible Hindi/Urdu coverage; this is the only approach that actually addresses the risk Document 01 identified, rather than appearing to address it |
| AI-AD-3 | Moderation `flag` results force `pending_approval` regardless of the global approval-gate setting | Provides a middle ground between Document 01 OQ-1's binary framing — most content flows fast, genuinely uncertain content still gets human review |
| AI-AD-4 | Recent-content context injected into the generation prompt itself, in addition to post-hoc embedding comparison | Reduces wasted (and costed) regenerations by preventing likely duplicates before they're generated, not just catching them after |

---

## 9. Tradeoffs

| Tradeoff | Gain | Cost | Verdict |
|---|---|---|---|
| `pgvector` in existing Postgres vs. a dedicated vector database (e.g., Pinecone, Weaviate) | No new infrastructure component, no new operational surface, consistent with Document 03's minimal-infra philosophy for v1 | Somewhat less specialized performance/features than a purpose-built vector DB at very large scale | Accept — v1's content volume (Document 01 A4, low volume) is nowhere near the scale where this tradeoff matters; revisit only if it becomes a measured bottleneck |
| AI-based moderation vs. keyword filter | Actually effective for the target languages | Real, ongoing cost per content item (§7); moderation quality depends on the provider model's own cultural competence, which isn't independently verifiable by this architecture | Accept — an ineffective free filter is worse than an effective paid one when the risk being mitigated is real reputational harm |
| Automatic escalation on `flag` even with the gate off | Catches genuinely uncertain content without requiring full manual review of everything | Adds a code path where the "gate off" setting doesn't mean what it superficially says — must be documented clearly in Settings (Document 09 §6.10) so the owner isn't confused by content still requiring approval | Accept — the alternative (a flag result being silently ignored because the gate is off) defeats the entire purpose of having moderation |

---

## 10. Assumptions

- **AIA-1:** The configured AI provider(s) support both a chat/completion-style call (for `generate` and `moderate`) and an embeddings endpoint (for `embed`) — this should be a stated requirement when selecting the second provider for Document 03's multi-provider proof, not assumed compatible after the fact.
- **AIA-2:** `pgvector`'s approximate nearest-neighbor search is acceptable (vs. exact search) for duplicate detection — a small false-negative rate on near-duplicates is an acceptable tradeoff for performance at this stage.
- **AIA-3:** The similarity threshold (§5.2) and moderation flag/reject boundaries (§6.2) will need real-world tuning after launch — initial values are a starting point, not a final calibration, per Document 03's general philosophy of measuring before over-specifying.

---

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Moderation model itself has gaps or biases in Hindi/Urdu cultural judgment | Medium-High | No fully automated system can be assumed perfect here — this is exactly why AI-AD-3's escalation-to-approval path exists as a safety net rather than treating `pass` as an unquestionable final answer |
| Cost ceiling (Document 03 §5.4) configured without accounting for moderation/embedding calls (§7) | Medium | Explicitly flagged here so implementation surfaces this in the Settings UI (Document 09 §6.10) — the cost ceiling description should say "covers generation, moderation, and duplicate-check calls," not just "generation" |
| `pgvector` index maintenance overhead as the embedding table grows | Low (v1 scale) | Standard index maintenance; not a v1 concern given Document 01's stated low volume, revisit if content volume assumptions change |

---

## 12. Future Expansion

- Additional languages (Document 01 Future Expansion — other content types) extend the same moderation approach — the `moderate(content, language)` interface already takes language as a parameter specifically so new languages don't require a new method
- The recent-context injection window (§4) could become configurable per content type as usage patterns emerge
- Provider fallback (Document 03 OQ-7, still deferred) applies equally to `generate`, `moderate`, and `embed` once built — no separate fallback design needed per method

---

## 13. Open Questions

| ID | Question | Recommendation |
|---|---|---|
| OQ-24 | Should moderation use the same AI provider as generation, or a separate, possibly cheaper/faster model dedicated to moderation? | Recommend allowing a separate provider/model configuration for moderation specifically — moderation doesn't need the same creative quality as generation, and a cheaper model here directly reduces the real cost concern raised in §7 |
| OQ-25 | What similarity threshold (§5.2) is a reasonable starting point before real-world tuning? | Recommend starting conservative (higher similarity required to flag as duplicate, e.g., 0.92+ cosine similarity) to avoid false positives blocking legitimately similar-but-distinct content (common in a genre like Shayari with recurring themes by nature) — tune down only if actual duplicates are observed slipping through |

---

## 14. Industry Best Practices Applied

- **Embeddings stored alongside relational data via `pgvector` rather than a separate specialized store** — increasingly standard practice for applications at this scale, avoiding premature infrastructure complexity
- **LLM-based content moderation for languages/contexts where keyword-based tooling is known to be weak** — an established pattern precisely because general-purpose language models often have broader contextual and cultural coverage than purpose-built filter libraries for lower-resource languages
- **Context injection to reduce downstream rework** — standard prompt-engineering practice; cheaper to steer generation upfront than discard and regenerate

---

## 15. Production Considerations

- Embedding and moderation calls add latency to the pipeline beyond generation alone — Document 04 §6's queue-per-stage design already accommodates this without change, since validation is already its own retryable stage
- Cost ceiling alerting (Document 03 §5.4) must be tested against realistic per-item cost including all three call types (§7), not just a generation-only estimate, before launch — an under-provisioned ceiling based on the old assumption would trigger false alerts or, worse, fail to trigger real ones

---

## 16. Recommendations

1. Update Document 03 §5.4 and Document 05's `AIProviderConfig` documentation to explicitly state that cost ceilings cover generation, moderation, and embedding calls collectively — this document defines that fact, but Document 03 is where an implementer would look first for cost configuration guidance.
2. Resolve OQ-24 in favor of allowing a separate, cheaper moderation-specific provider configuration — likely a meaningful cost saver given moderation runs on every single content item, unlike generation which runs once per item by definition.
3. This document closes the last major open architectural question from the earlier set (Document 02 OQ-2). Recommend the **Cross-Document Consistency Audit** previously suggested is now genuinely the highest-value next step — you have real amendments sitting in Documents 04 and 05 (this document's changes) that haven't been folded back into their source documents yet.

---

**End of Document 11 — AI Engine & Prompt Architecture**