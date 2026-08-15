# PROMPT_ASSET_CONFIGURATION_AUDIT.md
### PublishIQ — Prompt, Content Profile, Asset & Duplicate-Detection Configuration Audit

Scope: whether the configuration surface the product exposes (Prompts/Prompt Versions, Content Profiles, Templates, Assets, Music Selection, Duplicate Detection) actually drives runtime behavior, end to end, or is partially decorative. Method: full read of `backend/src/services/content-pipeline.service.ts`, `prompt.service.ts`, `contentProfile.service.ts`/repository/router, `providers/ai/gemini.provider.ts`, `utils/normalization.ts`, the Prisma schema, `docs/PROJECT_DECISIONS.md`, and the Prompt/Content-Profile frontend views, with grep-verified cross-referencing of every `ContentProfile` JSON field against every place it's actually read.

This audit builds on the prior `DEEP_EDGE_CASE_AUDIT.md` pass. That pass's CRITICAL findings (CRIT-01 through CRIT-05) have visibly been remediated in this codebase — `GeneratedContent` now has `@@unique([workspaceId, textHash])`, `publishing.service.ts` shows evidence of idempotency guards, and dedicated test files (`domain-events-transactions.test.ts`, `duplicate-content-detection.test.ts`, `publishing-idempotency.test.ts`, `scheduled-job-idempotency.test.ts`, `workspace-isolation.test.ts`, etc.) now exist. That work is good and is acknowledged in Positive Findings below — it is not re-litigated here except where directly relevant to this audit's scope.

---

# Executive Summary

The reliability/idempotency layer got fixed. The configurability layer was never actually built to the depth `PROJECT_DECISIONS.md` Section 11 promises, and this audit finds the gap is worse than "some rough edges" — it's structural.

Two fields the docs explicitly list as things "a Content Profile owns" — **Branding Rules and Watermark Rules** — are stored, validated as JSON, and editable through a dedicated UI form, and are **never read by any pipeline code, anywhere.** A user can configure them, save them, see them persist, and they will never once affect a single rendered image. The same is true of **Validation Rules**. This is not a missing nice-to-have; it's a configuration surface that lies to the user about what it does.

Separately, the two things this audit was specifically asked to re-verify from the product's own stated concerns — music selection and duplicate detection — land in different places. Duplicate detection is now genuinely solid (DB-enforced uniqueness + correct P2002-triggered regeneration that resets all stale fields). Music selection is **not** fixed: it still does `candidates[0]`, deterministically, every time, and the video-rendering fallback path still bypasses `musicSelectionRules` entirely and reaches for "any Cloudinary-hosted music track" with no mood/genre filtering at all — exactly the two behaviors the audit brief asked to specifically check for and exactly the two behaviors PROJECT_DECISIONS.md Section 9.1 ("Selection is rule-based, configurable per Content Profile") says shouldn't happen.

The Prompt system has no schema at all. `PromptVersion.body` is a raw string; there is no validation of `{{variable}}` placeholders against what will actually be supplied at generation time. If an operator writes `{{contnetType}}` (a typo) into a prompt body, it is silently sent to Gemini as a literal, un-substituted `{{contnetType}}` string in the middle of the prompt — no error, no warning, in the UI or the backend, at creation time or at generation time. Six of seven `Asset` types (Font, Background, Logo, Watermark, Animation, Icon) are fully implemented as storable, uploadable, metadata-bearing entities and are **never consumed by rendering** — only Music is actually wired into the pipeline.

None of this breaks the happy-path demo, because the happy path uses the seeded prompt/profile, which happens to have consistent variable names and only one matching music track. It breaks the moment a real operator tries to actually configure the system the way the UI and the docs tell them they can.

---

# Critical Findings (summary — full entries below)

- **CFG-01** (CRITICAL): `brandingRules`, `watermarkRules`, and `validationRules` are fully implemented as storable/editable Content Profile fields but have zero runtime consumers. Direct contradiction of `PROJECT_DECISIONS.md` Section 11.
- **CFG-02** (CRITICAL): Prompt variable substitution is unvalidated string-replace with no schema; unmatched `{{placeholder}}` tokens are silently sent to Gemini verbatim.
- **CFG-03** (CRITICAL): Music selection still deterministically picks `candidates[0]` — the exact behavior the audit was asked to confirm/deny is confirmed present.
- **CFG-04** (CRITICAL): The `RenderingVideo` music fallback bypasses `musicSelectionRules` entirely when the snapshot music path is missing/local, picking any active Cloudinary track regardless of mood/genre.
- **CFG-05** (HIGH): Six of seven Asset types (Font, Background, Logo, Watermark, Animation, Icon) are stored but never consumed by the rendering pipeline.

---

# Prompt System Findings

## CFG-02

**Issue ID:** CFG-02
**Domain:** Prompt System / AI Provider Contract
**Severity:** CRITICAL

**Title:** No formal prompt schema; variable substitution is silent, unvalidated string-replace — a prompt referencing an unsupplied variable is not an error, it's a literal string sent to the AI model.

**Current Behavior:** `PromptVersion.body` (`backend/prisma/schema.prisma`) is `String @db.Text` — completely free-form. `promptService.createPrompt`/`createVersion` (`backend/src/services/prompt.service.ts`) accept this raw `body` with no structural validation whatsoever — no check for well-formed `{{variable}}` syntax, no check that referenced variables exist anywhere, no required-field enforcement. At generation time, `geminiProvider.generate` (`backend/src/providers/ai/gemini.provider.ts`) does:
```ts
let finalPrompt = prompt.body;
for (const [key, value] of Object.entries(variables)) {
  finalPrompt = finalPrompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
}
```
This loop iterates over the *supplied* variables and replaces matching placeholders. It never inspects `prompt.body` for placeholders that have **no** corresponding entry in `variables`. Any such placeholder — a typo (`{{languaage}}`), a variable the author assumed exists but doesn't, a leftover from a copy-pasted older prompt — is left in the final string exactly as written and sent to Gemini as literal text.

**Expected Behavior:** Per the audit brief's own framing (and standard prompt-template practice), the system should be able to answer, before a version is ever activated: which variables does this prompt body reference, are they all resolvable from the known variable sources (system-injected: `contentType`/`language`/`tone`/`style`; profile-supplied: `promptVariables`), and does the AI response contract (`AIContentResponseSchema`) match what the prompt asks the model to produce. None of this is checked anywhere.

**Evidence:** `backend/src/services/prompt.service.ts` (`createPrompt`, `createVersion` — no validation call of any kind on `body`); `backend/src/providers/ai/gemini.provider.ts` (`generate`, the substitution loop); `backend/src/routes/prompts.router.ts` (confirm — Zod schema, if any, validates only `name`/`notes`/`body: z.string()`, not structure).

**Exact Files:** `backend/src/services/prompt.service.ts`, `backend/src/providers/ai/gemini.provider.ts`, `backend/src/routes/prompts.router.ts`.

**Exact Functions:** `promptService.createPrompt`, `promptService.createVersion`, `geminiProvider.generate`.

**Root Cause:** The Prompt system was built as a plain CRUD-over-a-text-column feature with no intermediate "compile/validate this template" step between authoring and execution.

**Impact:** Directly answers the audit brief's Question 4 ("Can a valid prompt be silently broken by variable substitution?") — **yes.** An operator can edit an Active prompt version, introduce a typo in a variable name, save it, and the very next scheduled or manual generation will silently send the literal `{{typo}}` string to Gemini as part of the actual prompt text — degrading (not failing) content quality with no error anywhere in the system to signal what happened. This is a silent correctness failure, not a crash, which makes it strictly harder to notice and debug than an outright error would be.

**Recommended Direction:** Do not build a full prompt-templating engine or DSL — that's disproportionate to this product's needs (per audit brief Section 25/35, prefer simple/explicit over complex). Instead: (1) define the fixed set of system-injected variable names as a single exported constant (`contentType`, `language`, `tone`, `style`) that both the Gemini provider and prompt validation share; (2) on prompt/version create and update, extract all `{{...}}` tokens from `body` via regex and validate each is either a known system variable or would be resolvable from *some* Content Profile's `promptVariables` — since `promptVariables` is genuinely free-form per profile, the strictest useful check is: extract the token set and store it (e.g. `PromptVersion.declaredVariables: String[]`), and validate it explicitly against a specific Content Profile's `promptVariables` keys + the fixed system set whenever that profile is linked to this version, surfacing "these tokens are not covered by any known source" as a validation warning at profile-save time, not just silently at generation time; (3) surface the extracted variable list in the Prompt UI so an author can see exactly what a prompt body will require before saving.

**Required Tests:** Unit test: a prompt body containing an unmatched `{{unknownVar}}` token, when validated against a Content Profile's `promptVariables`, is flagged rather than silently accepted. Unit test: `geminiProvider.generate` given a body with an unmatched token — assert either the call is rejected before hitting the network, or (if the recommended pre-validation is implemented upstream instead) that this is explicitly documented as the last line of defense, not the only one.

---

## CFG-06

**Issue ID:** CFG-06
**Domain:** Prompt System / Content Profile
**Severity:** HIGH

**Title:** Two competing, unreconciled sources for the same conceptual variables (`tone`, `language`, `style`, `contentType`) — the free-form `promptVariables` JSON silently wins over the profile's own dedicated fields on key collision.

**Current Behavior:** In `content-pipeline.service.ts`, `PipelineStage.GeneratingContent`:
```ts
const variables = profile.promptVariables as Record<string, any> || {};
const aiResponse = await geminiProvider.generate(
  { body: promptVersion.body, versionNumber: promptVersion.versionNumber },
  {
    contentType: contentType?.name || '',
    language: profile.language,
    tone: profile.tone,
    style: profile.writingStyle,
    ...variables,
  }
);
```
The spread `...variables` is applied **last**, so if a Content Profile's free-form `promptVariables` JSON happens to contain a key named `tone`, `language`, `style`, or `contentType`, it silently overwrites the profile's own dedicated, purpose-built `tone`/`language`/`writingStyle` fields (and the resolved Content Type name) with no warning.

**Expected Behavior:** There should be exactly one authoritative source per conceptual variable. Either `promptVariables` is explicitly documented and enforced as "custom variables only — the four system names are reserved and cannot be overridden," or the dedicated fields are removed in favor of `promptVariables` entirely. The current design offers both, with undocumented, order-dependent precedence.

**Evidence:** `backend/src/services/content-pipeline.service.ts`, `GeneratingContent` case, lines ~70–82.

**Exact Files:** `backend/src/services/content-pipeline.service.ts`.

**Exact Functions:** `processStage` (case `PipelineStage.GeneratingContent`).

**Root Cause:** `promptVariables` was added as a general-purpose escape hatch without reserving the names already used by dedicated `ContentProfile` columns.

**Impact:** A profile author who adds a custom variable named, say, `tone` for an unrelated purpose (thinking it's scoped to their own prompt) will silently and invisibly change what tone value the AI actually receives, contradicting the value visibly set in the "Tone" field of the Content Profile UI. This is exactly "a valid user configuration silently overridden" — except by another part of the same user's own configuration, which is even harder to diagnose.

**Recommended Direction:** Reserve the four system variable names at validation time — reject (or at minimum warn and strip) any `promptVariables` key that collides with `contentType`/`language`/`tone`/`style` when the Content Profile is saved, with a clear error message naming the collision. This is a cheap, purely additive validation fix.

**Required Tests:** Unit test: saving a Content Profile with `promptVariables: {tone: "x"}` is rejected (or the collision is otherwise made impossible), rather than silently accepted and later overriding the dedicated `tone` field at generation time.

---

## CFG-07

**Issue ID:** CFG-07
**Domain:** Prompt System / Documentation Drift
**Severity:** MEDIUM

**Title:** "Global Prompt Variables," listed in `PROJECT_DECISIONS.md` Section 21 as a System Configuration category, does not exist anywhere in the codebase.

**Current Behavior:** `docs/PROJECT_DECISIONS.md` Section 21 lists `Global Prompt Variables` as an example of System Configuration data — implying a third, workspace/system-wide source of prompt variables, distinct from the four system-injected fields and the per-profile `promptVariables`. Grep of the entire backend for `global_prompt_variables` / `globalPromptVariables` returns zero results. No such key is read by `geminiProvider.generate` or `content-pipeline.service.ts`.

**Evidence:** `docs/PROJECT_DECISIONS.md` line ~302; absence confirmed by exhaustive grep of `backend/src`.

**Exact Files:** N/A (absence, not a specific file) — relevant file for implementation would be `backend/src/services/content-pipeline.service.ts` and `backend/src/config/system-config.cache.ts`.

**Root Cause:** Documented capability that was never implemented, or was implemented and later removed without a doc update.

**Impact:** Low direct impact (nothing currently depends on this working), but it is a concrete, checkable instance of documentation promising a configuration capability that doesn't exist — exactly the kind of ambiguity Section 26 of the audit brief asks to be reported rather than silently resolved.

**Recommended Direction:** Either implement it (merge a `system_config` key's variables into the base variable set before the profile-level spread, with the same reserved-name protection as CFG-06) or remove the line from `PROJECT_DECISIONS.md` — this audit takes no position on which; per instructions, this is reported as documentation/implementation drift, not resolved unilaterally.

**Required Tests:** N/A until a direction is chosen.

---

## CFG-08

**Issue ID:** CFG-08
**Domain:** Prompt System / Frontend UX
**Severity:** HIGH

**Title:** The Prompt UI provides zero variable guidance, no preview/test capability, and no indication of which version is active.

**Current Behavior:** `frontend/src/routes/prompts/PromptsView.tsx` (455 lines) contains no reference to `{{`, "variable," "preview," "test," or "validate" anywhere in the file (confirmed by direct search). A prompt author authoring or editing `body` has no in-UI list of available variable names, no way to see what a rendered prompt would look like with sample values substituted, and no way to run a test generation before activating a version for live use.

**Evidence:** Direct grep of `PromptsView.tsx` for variable/preview/test/validate keywords returns no matches outside unrelated query-invalidation code.

**Exact Files:** `frontend/src/routes/prompts/PromptsView.tsx`.

**Root Cause:** The UI was built to manage the CRUD lifecycle of Prompts/Versions but not the authoring safety net a free-form template field needs.

**Impact:** Directly answers audit brief Questions 1, 3, and 15 — an operator **cannot** create a valid, safe prompt without knowing internal implementation details (they'd need to read the backend source to know the four system variable names exist and what they're called), and the UI is not clear enough for safe self-service configuration.

**Recommended Direction:** Add, at minimum: (1) a static, always-visible list of the reserved system variable names (`{{contentType}}`, `{{language}}`, `{{tone}}`, `{{style}}`) in the Prompt editor; (2) a "Test Generation" action that runs the prompt through `geminiProvider.generate` with either sample values or a real Content Profile's current variables and displays the raw result, without persisting a `Job`/`GeneratedContent` row; (3) visible indication in the Prompt list/detail view of which `PromptVersion` is currently `Active` vs `Draft`/`Deprecated`, and which (if any) Content Profiles currently reference it.

**Required Tests:** N/A (frontend UX) — but the backing "test generation" endpoint, once added, needs an integration test confirming it does not create persistent `Job`/`GeneratedContent` rows.

---

# Prompt Structure Findings

## CFG-09

**Issue ID:** CFG-09
**Domain:** Prompt Structure
**Severity:** MEDIUM

**Title:** The prompt body has no required structural sections; correctness of the AI output contract depends entirely on prose discipline by whoever writes the prompt text, with no enforcement.

**Current Behavior:** `PromptVersion.body` is one opaque string. The actual output contract — `title`, `quote`, `caption`, `hashtags`, `language`, `contentType` — is enforced entirely on the *response* side, via `geminiResponseSchema` (sent to Gemini as `responseSchema`) and `AIContentResponseSchema` (Zod-validated on the way back). There is nothing on the *request* side confirming the prompt body actually instructs the model to produce content consistent with that contract (e.g., nothing stops a prompt body that never mentions hashtags at all, relying entirely on Gemini's structured-output mode to invent something reasonable for a field the prompt text never discusses).

**Expected Behavior:** Given the architecture is intentionally free-form (per PROJECT_DECISIONS.md's general preference for simplicity — no evidence a formal prompt DSL was ever planned), full imposition of a rigid structure (role/objective/constraints/output-schema as separate stored fields) would be disproportionate. The minimum viable fix is not a new structure, but the CFG-02 validation layer: since the *response* contract is already fixed and Zod-validated, the *request* side only needs to confirm the prompt body doesn't fight that contract via undeclared variables (CFG-02) — it does not need its own separate formal structure on top.

**Evidence:** `backend/src/providers/ai/gemini.provider.ts` (`geminiResponseSchema`, `AIContentResponseSchema`); `backend/prisma/schema.prisma` (`PromptVersion.body: String`).

**Exact Files:** `backend/src/providers/ai/gemini.provider.ts`, `backend/src/schemas/ai-response.schema.ts`.

**Root Cause:** N/A — this is a design characteristic, not a bug per se.

**Impact:** Low on its own; this finding exists mainly to explicitly answer audit brief Section 4 ("determine whether the current architecture is intentionally free-form... and if it is, is it still sufficiently safe"). Verdict: the free-form body itself is an acceptable design choice **given** CFG-02/CFG-06/CFG-08 are fixed; without those fixes, free-form-with-no-guardrails is not safe for a non-developer operator.

**Recommended Direction:** Do not add a formal structured-prompt schema. Fix CFG-02/CFG-06/CFG-08 instead, which collectively make the existing free-form design safe to use.

**Required Tests:** None beyond CFG-02/CFG-06/CFG-08's tests.

---

# Prompt Variable Findings

(Consolidated into CFG-02, CFG-06, CFG-07, CFG-08 above — see those entries. No additional distinct findings.)

---

# Prompt Versioning Findings

## CFG-10

**Issue ID:** CFG-10
**Domain:** Prompt Versioning / Determinism
**Severity:** HIGH

**Title:** Version-pinning determinism (correctly fixed for `promptVersionId`/`templateVersionId` per the prior audit's MED-04) does not extend to the *behavioral* Content Profile fields (`promptVariables`, `tone`, `writingStyle`, `musicSelectionRules`, `captionStrategy`, `hashtagStrategy`, `renderingConfiguration`) — these remain live reads for the whole life of a job.

**Current Behavior:** `content-pipeline.service.ts` reads `job.contentProfile` fresh on every `processStage` call (`jobRepository.getById(jobId)` at the top of `processStage`), and specific stages independently re-fetch the live profile again (`GeneratingCaption`/`GeneratingHashtags` call `contentProfileRepository.getById(job.contentProfileId, job.workspaceId)` directly, a second live fetch). Only `promptVersionId` and `templateVersionId` are pinned via `job.configSnapshot` (the fix from the prior audit's MED-04). Every other Content Profile field — `tone`, `writingStyle`, `promptVariables`, `musicSelectionRules`, `captionStrategy`, `hashtagStrategy`, `renderingConfiguration` — is read live, at whatever value it currently holds in the database, at the exact moment each pipeline stage executes.

**Expected Behavior:** PROJECT_DECISIONS.md Section 13 (per the original audit-brief instructions) frames determinism as a property of "the running Job," not specifically "the Prompt/Template Version pointers within the running Job." A Hybrid-mode job held for approval, or a job that spans a slow render across a moment where an operator edits the linked profile's `tone` or `musicSelectionRules`, will use whatever value is live at each stage's execution time — which can differ from what was live when the job was created or when an approver reviewed a preview.

**Evidence:** `backend/src/services/content-pipeline.service.ts`, top of `processStage` (`const job = await jobRepository.getById(jobId)`), and the two separate live `contentProfileRepository.getById` calls in `GeneratingCaption`/`GeneratingHashtags`.

**Exact Files:** `backend/src/services/content-pipeline.service.ts`.

**Exact Functions:** `processStage` (all cases that read `job.contentProfile` or re-fetch it).

**Root Cause:** The prior fix (MED-04) scoped "determinism" narrowly to the two version-pointer fields because those were the ones explicitly named in that audit's finding; the broader behavioral-config fields were out of that finding's scope and were never revisited.

**Impact:** Medium-probability (requires an edit to a live, in-use profile during a job's execution window), but directly relevant to this audit's explicit Question 14 ("Are existing jobs protected from later Prompt/Template changes?") — the answer is "the version *pointers* yes, the actual profile *behavior* no."

**Recommended Direction:** Extend `job.configSnapshot` at job-creation time to capture the full set of behavioral fields needed for deterministic stage execution (`tone`, `writingStyle`, `promptVariables`, `musicSelectionRules`, `captionStrategy`, `hashtagStrategy`, `renderingConfiguration`, and — once CFG-01 is fixed — `brandingRules`/`watermarkRules`/`validationRules`), and have every pipeline stage read from the snapshot, falling back to the live relation with a warning log only for jobs created before this change ships (mirroring the existing fallback pattern already used for `promptVersionId`/`templateVersionId`).

**Required Tests:** Integration test: create a job against a profile with `musicSelectionRules: {mood: "Calm"}`; edit the profile's `musicSelectionRules` to `{mood: "Energetic"}` while the job is held (Hybrid `Queued`); approve and resume; assert the job still selects music using `{mood: "Calm"}`.

---

## CFG-11

**Issue ID:** CFG-11
**Domain:** Prompt Versioning / Database Integrity
**Severity:** LOW

**Title:** No test coverage exists for concurrent Prompt Version creation or concurrent rollback (though no specific bug was found — this is a coverage gap, not a confirmed defect).

**Current Behavior:** `promptRepository.createPromptVersion` and `rollbackPromptVersion` were not read in enough depth in this pass to confirm or deny a race condition, but no existing test (`backend/src/tests/`) exercises concurrent version creation or concurrent rollback for the same `Prompt`. The `@@unique([promptId, versionNumber])` constraint on `PromptVersion` (confirmed present in schema) should prevent two concurrent `createVersion` calls from producing duplicate version numbers, *if* `versionNumber` assignment is computed correctly under concurrency (e.g., `MAX(versionNumber) + 1` inside a transaction, or DB-sequence-backed) — this specific mechanism was not verified in this pass.

**Evidence:** `backend/prisma/schema.prisma` (`@@unique([promptId, versionNumber])` present); repository implementation not verified in depth in this pass.

**Exact Files:** `backend/src/repositories/prompt.repository.ts` (verify `createPromptVersion`'s version-number assignment logic specifically).

**Root Cause:** N/A — flagged as a verification gap, not a confirmed root cause.

**Impact:** Low, speculative until verified.

**Recommended Direction:** Verify `createPromptVersion`'s version-number assignment is transaction-safe under concurrency; if it computes `MAX(versionNumber)` in a separate read before insert (not inside the same transaction/using a DB-level `SELECT ... FOR UPDATE` or the unique constraint as the sole race guard with retry-on-conflict), fix it to be safe. Add the test regardless of the outcome of that check.

**Required Tests:** Concurrency test: two simultaneous `createVersion` calls for the same `promptId`; assert both succeed with distinct, correct `versionNumber`s (no collision, no silent overwrite, no unhandled unique-constraint error surfaced to the caller).

---

# AI Contract Findings

## CFG-12

**Issue ID:** CFG-12
**Domain:** AI Provider Contract
**Severity:** LOW (positive-leaning finding, documented for completeness)

**Title:** The Prompt ↔ Gemini ↔ Database ↔ UI contract is internally consistent for the fields it does define — no mismatches found in this pass.

**Current Behavior:** `title`, `quote`, `caption`, `hashtags`, `language`, `contentType`, `metadata` are defined once in `geminiResponseSchema` (sent to the model), validated once via `AIContentResponseSchema` (Zod, on the response), and mapped consistently into `StructuredAIResponse.metadata` and then into `Job`/`GeneratedContent` fields (`caption`, `hashtags`, `generatedText` ← `quote`). No mismatch was found between what's requested, what's validated, and what's persisted for these fields.

**Evidence:** `backend/src/providers/ai/gemini.provider.ts`; `backend/src/schemas/ai-response.schema.ts` (not fully re-read line-by-line in this pass, but the mapping in `gemini.provider.ts`'s return statement is consistent with schema field names).

**Exact Files:** `backend/src/providers/ai/gemini.provider.ts`.

**Root Cause:** N/A.

**Impact:** None — documented as a Positive Finding as well (see below); listed here only because the audit brief explicitly requires this contract to be checked and reported either way.

**Recommended Direction:** None required.

**Required Tests:** Existing coverage (if any) for this mapping is adequate; no gap identified.

---

# Duplicate Detection Findings

## CFG-13

**Issue ID:** CFG-13
**Domain:** Duplicate Detection
**Severity:** LOW (positive-leaning; one residual gap noted)

**Title:** Exact-duplicate detection is now genuinely race-safe and correctly triggers full-state regeneration — confirmed by direct code read, not merely inferred from the presence of a unique constraint.

**Current Behavior:** `GeneratedContent` now has `@@unique([workspaceId, textHash])` at the database level. `content-pipeline.service.ts`'s generation loop catches both the pre-check `ValidationError('Duplicate content detected...')` (from `Validating` stage) **and** a genuine Prisma `P2002` unique-violation (`err?.code === 'P2002' && ... target?.includes('textHash')`) from the final persistence step, and both routes into the same regeneration path: `completedStagesInThisRun.clear()`, `startIndex = 0`, and a full reset of `generatedText`/`imageUrl`/`videoUrl`/`caption`/`hashtags` to `null` via `transitionJobStage(..., PipelineStage.Draft, {...nulls})`, bounded by `retry_limit.duplicate_regeneration` (default 5), with a clear terminal `ValidationError` if exhausted. This is a correct, race-proof implementation: even if two workers both pass the pre-check simultaneously, only one's final `INSERT`/`UPDATE` will succeed, and the loser correctly regenerates from scratch (not a stale partial state) rather than either silently persisting a duplicate or getting stuck.

**Evidence:** `backend/prisma/schema.prisma` (`GeneratedContent` model); `backend/src/services/content-pipeline.service.ts` lines ~340–440 (full regeneration loop, read in this pass).

**One residual gap (not a correctness bug, a cost/design note):** The duplicate check only definitively resolves at the very end of a full generation run — text, image, **and video** are all rendered before the P2002 race is caught, meaning a race loss discards a fully-rendered image and video, not just text. This is expected/acceptable given the race is rare, but is worth knowing: the pre-check inside `Validating` (`findByTextHash`) is what normally catches duplicates cheaply, *before* rendering; only the genuinely racy case (two workers finishing generation within the same narrow window) pays the full render cost before being caught.

**Exact Files:** `backend/src/services/content-pipeline.service.ts`.

**Root Cause:** N/A.

**Impact:** None (this is a confirmed fix). Noted in Positive Findings as well.

**Recommended Direction:** No fix required. Optional, non-blocking future optimization: since `Validating` already computes `normalizedHash` and checks it, and the image/video stages run after, consider whether a cheap *second* pre-check immediately before the final persist (not just relying on the P2002 catch) could save render cost in the common case — but this is a performance nicety, not a correctness gap, and should not be prioritized over the CRITICAL/HIGH findings above.

**Required Tests:** Confirm `duplicate-content-detection.test.ts` (present in the repo) actually exercises the P2002 path with a real concurrent-write simulation, not just the pre-check path — verify in remediation, don't assume from the filename.

---

## CFG-14

**Issue ID:** CFG-14
**Domain:** Duplicate Detection / Normalization
**Severity:** MEDIUM

**Title:** Normalization strips punctuation and collapses whitespace but performs no Unicode canonicalization (`NFC`/`NFKC`) — a real gap given the product explicitly supports Hindi and Urdu.

**Current Behavior:** `backend/src/utils/normalization.ts`:
```ts
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\p{P}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
```
This lowercases (a no-op for Hindi/Urdu scripts, which have no case), strips Unicode punctuation, and collapses whitespace — but never calls `.normalize('NFC')` (or `'NFKC'`) before hashing.

**Expected Behavior:** Two strings that are visually and semantically identical but encoded with different Unicode composition (e.g., a precomposed character vs. a base character plus a combining diacritical mark — a real, common occurrence in Devanagari/Urdu text depending on input method/keyboard/copy-paste source) should hash identically for exact-duplicate purposes. Without NFC normalization, they may not.

**Evidence:** `backend/src/utils/normalization.ts` (full file read).

**Exact Files:** `backend/src/utils/normalization.ts`.

**Exact Functions:** `normalizeText`.

**Root Cause:** Unicode canonicalization was not considered when the normalization function was written, likely because it was validated primarily against English test content.

**Impact:** Duplicate content in Hindi/Urdu could escape exact-duplicate detection purely due to encoding differences in how the AI model happens to emit a given generation — a real, product-relevant gap given Hindi/Urdu are two of the three supported languages (`Language` enum: `English`, `Hindi`, `Urdu`).

**Recommended Direction:** Add `.normalize('NFC')` as the first step of `normalizeText`, before lowercasing. This is a one-line, low-risk fix — but changing it will change the hash of all existing `GeneratedContent.textHash` values going forward relative to old rows, so it needs a migration note (existing rows keep their old hash; only new comparisons use the new normalization; do not attempt to retroactively rehash existing rows as part of this fix unless that's explicitly wanted).

**Required Tests:** Unit test: two strings that are visually identical but differ only in Unicode composition (NFC vs NFD form of the same text) normalize to the same hash after the fix.

---

# Asset System Findings

## CFG-05

**Issue ID:** CFG-05
**Domain:** Asset System
**Severity:** HIGH

**Title:** Six of seven Asset types — Font, Background, Logo, Watermark, Animation, Icon — are fully implemented as uploadable, storable, metadata-bearing entities and are never read by rendering. Only Music is actually wired into the pipeline.

**Current Behavior:** The `AssetType` enum (`backend/prisma/schema.prisma`) defines `Background`, `Font`, `Music`, `Logo`, `Watermark`, `Animation`, `Icon`. Assets of every type can be uploaded, given metadata, and set `Active`/`Disabled` and `Confirmed`/`Unconfirmed` license status through the Asset API/UI. A repository-wide grep for `AssetType.Font`, `AssetType.Background`, `AssetType.Logo`, `AssetType.Watermark`, `AssetType.Animation`, `AssetType.Icon` outside of CRUD/test code returns **zero matches** — none of these asset types are ever queried, filtered, or referenced by `content-pipeline.service.ts` or `rendering.service.ts`. `rendering.service.ts`'s `renderImage` accepts an optional `fontFamily` string, but it is a plain string never populated from any `Font`-type `Asset` row, and the caller (`RenderingImage` stage in `content-pipeline.service.ts`) never passes it at all — it's dead parameter space, not a wired integration.

**Expected Behavior:** Per PROJECT_DECISIONS.md Section 9.2 ("Assets are first-class entities: Backgrounds, Fonts, Music, Logos, Watermarks, Animations, Icons, future types... referenced (never duplicated) by Content Profiles"), the doc treats all seven types as equally first-class, referenced-by-profile entities. Only one of the seven actually is.

**Evidence:** Exhaustive grep of `backend/src` for each non-Music `AssetType` value, outside test files, returns no results; `rendering.service.ts`'s `fontFamily` parameter traced to its only caller and found unpopulated.

**Exact Files:** `backend/src/services/content-pipeline.service.ts`, `backend/src/services/rendering.service.ts`, `backend/src/services/asset.service.ts` (CRUD-only for all types).

**Exact Functions:** `processStage` (`RenderingImage` case — the only stage that plausibly could consume Font/Background/Logo/Watermark), `renderingService.renderImage`.

**Root Cause:** The Asset data model and CRUD layer were built out generically for all seven types up front, but pipeline integration was only completed for Music.

**Impact:** This is exactly the audit brief's Section 31 distinction — "implementing the missing runtime behavior" vs. "removing misleading configuration that is not intended to be supported" — and it needs an explicit product decision, because right now the system silently does neither: it lets an operator upload a Logo asset, mark it `Active`, set its license `Confirmed`, and it will never appear on a single rendered video. There is no error, no warning, no "not yet supported" indicator anywhere in the Asset UI.

**Recommended Direction:** This audit does not choose implementation vs. removal (that's a product decision, and the brief explicitly says not to leave this ambiguous in the remediation prompt — see `ANTIGRAVITY_PROMPT_CONFIG_FIXES.md`, which requires an explicit choice per type). What this audit does establish: whichever direction is chosen, it must be chosen for all six unused types consistently, and the Asset UI must not present unused types as if they have equivalent effect to Music. At minimum as an immediate mitigation, the Asset creation UI should visibly label which types currently affect generated output (Music only) versus which are reserved for future use.

**Required Tests:** Once a direction is chosen per type: either an integration test proving the asset type now affects rendering output, or (if removed/deferred) a test/lint rule that prevents the Asset creation UI from silently accepting a type with no runtime consumer without a visible "not yet active" label.

---

# Music Selection Findings

## CFG-03

**Issue ID:** CFG-03
**Domain:** Music Selection
**Severity:** CRITICAL

**Title:** Music selection deterministically picks `candidates[0]` — confirmed present, not fixed since the behavior the audit brief specifically asked to check for.

**Current Behavior:** `content-pipeline.service.ts`, `PipelineStage.AttachingMusic`:
```ts
const exactMatches = allMusic.filter((asset) => {
  if (asset.status !== 'Active' || asset.licenseStatus !== 'Confirmed') return false;
  const meta = asset.metadata as Record<string, any> || {};
  return meta.mood === mood && meta.genre === genre;
});
const candidates = exactMatches.length > 0 ? exactMatches : allMusic.filter(/* mood-only */);
if (candidates.length === 0) { throw new ValidationError(...); }
const selectedAsset = candidates[0]!;
```
Filtering by `mood`/`genre` (the "rule-based" part of Section 9.1) is genuinely implemented and correct. But once filtered, the *tie-break* among multiple equally-valid candidates is always "whatever `assetRepository.list()` returns first" — which, absent an explicit `ORDER BY` designed for rotation, is effectively insertion order. If a workspace has five licensed, active "Calm/Acoustic" tracks, every single job that resolves to that mood/genre combination will use the exact same one, forever, regardless of how many alternatives exist.

**Expected Behavior:** PROJECT_DECISIONS.md Section 9.1 says selection is "rule-based, configurable per Content Profile" but is silent on tie-breaking among multiple rule-matching candidates — this is a genuine documentation ambiguity (see Documentation Ambiguities section), but the audit brief's own framing (Section 13: "Determine whether this means the same asset is always selected. If yes, report it") makes clear this is being treated as a defect regardless of the doc's silence, because a content library with unused variety defeats the purpose of building a library.

**Evidence:** `backend/src/services/content-pipeline.service.ts`, `AttachingMusic` case, `const selectedAsset = candidates[0]!`.

**Exact Files:** `backend/src/services/content-pipeline.service.ts`.

**Exact Functions:** `processStage` (case `PipelineStage.AttachingMusic`).

**Root Cause:** No selection strategy was ever implemented beyond the mood/genre filter — the array-index pick was presumably a placeholder that was never revisited.

**Impact:** Every published video for a given profile/mood/genre combination uses identical background music, which is a real, user-visible product quality issue (repetitive content across a channel's output) — not just an internal code smell.

**Recommended Direction:** Per the audit brief's explicit instruction not to blindly choose a strategy: the correct minimal-complexity choice, consistent with "prefer simple, deterministic behavior" (brief Section 25) while still solving the actual problem (repetition), is **deterministic rotation** — track "last used" per `(workspaceId, contentProfileId)` (or per mood/genre bucket) and pick the next candidate in a stable, repeatable order that isn't always index 0. This is simpler and more debuggable than random selection (which the brief also lists as an option but which makes reproducing a specific job's output harder to reason about), and simpler than a weighted engine. Concretely: add a small `MusicSelectionState` record (or reuse `SystemConfiguration`/a dedicated table) keyed by `(workspaceId, mood, genre)` storing the last-selected `assetId`; on each selection, pick the next candidate after the last-used one in a stable sort order (e.g. by `id`), wrapping around. This is explicit, testable, and does not require randomness or a rules engine.

**Required Tests:** Test proving that, given 3+ eligible candidates, repeated pipeline runs for the same profile select different assets across runs (not always the same one). Test proving disabled/unlicensed assets are never selected regardless of rotation state (should already pass given the existing filter, but should be explicitly asserted).

---

## CFG-04

**Issue ID:** CFG-04
**Domain:** Music Selection / Fallback Behavior
**Severity:** CRITICAL

**Title:** The `RenderingVideo` stage's music-path fallback bypasses `musicSelectionRules` entirely, picking any Cloudinary-hosted active music track with no mood/genre filtering.

**Current Behavior:** `content-pipeline.service.ts`, `PipelineStage.RenderingVideo`:
```ts
let musicFilePath = snapshot.selectedMusicFilePath;
if (!musicFilePath || (!musicFilePath.startsWith('http://') && !musicFilePath.startsWith('https://'))) {
  const activeMusicAssets = await getCachedActiveMusic(job.workspaceId);
  const validCloudinaryTrack = activeMusicAssets.find((a: Asset) => a.filePath && (a.filePath.startsWith('http://') || a.filePath.startsWith('https://')));
  if (validCloudinaryTrack) {
    musicFilePath = validCloudinaryTrack.filePath;
  } else {
    throw new ValidationError('No valid Cloudinary music track available for rendering.');
  }
}
```
`getCachedActiveMusic` returns *all* active music for the workspace — it does not filter by `licenseStatus === 'Confirmed'` (only `AttachingMusic`'s filter does that), and the `.find(...)` here applies **no mood/genre filter at all**, just "the first one with an `http(s)://` path." This fallback triggers whenever `snapshot.selectedMusicFilePath` is missing or is a non-URL (e.g., a local/relative path — plausible if an asset was uploaded but not yet fully migrated to Cloudinary, or if `AttachingMusic`'s selection somehow stored a local path).

**Expected Behavior:** Per the audit brief's Section 14 framing verbatim: "Fallback behavior should never silently contradict explicit user configuration." If the selected asset from `AttachingMusic` can't be used for a legitimate reason, the fallback should still honor `musicSelectionRules` (mood/genre) and `licenseStatus === 'Confirmed'`, or the job should fail loudly with a clear "your selected track became unusable and no compliant fallback exists" error — not silently substitute an unrelated, unlicensed-status-unchecked track.

**Evidence:** `backend/src/services/content-pipeline.service.ts`, `RenderingVideo` case, the `if (!musicFilePath || ...)` fallback block.

**Exact Files:** `backend/src/services/content-pipeline.service.ts`.

**Exact Functions:** `processStage` (case `PipelineStage.RenderingVideo`).

**Root Cause:** The fallback was written purely to prevent a hard failure ("we need *some* URL to hand FFmpeg") without threading the original `musicSelectionRules` (or even the `licenseStatus` check) through to the fallback path.

**Impact:** A configured Content Profile's explicit music mood/genre rules, and the licensing-confirmation requirement PROJECT_DECISIONS.md Section 27 explicitly calls out ("Confirm licensing status of every asset... before any channel goes live publicly"), can both be silently bypassed by this fallback, in a real published video, with no error and no log level above whatever `logger.info` already exists for the normal path (worth confirming there's at least a `logger.warn` here — not confirmed present in this pass).

**Recommended Direction:** Rebuild the fallback to re-run the *same* mood/genre + `licenseStatus === 'Confirmed'` filtering logic used in `AttachingMusic` (extract it into a shared helper used by both stages) rather than a bare "any Cloudinary URL" scan. If no compliant candidate exists at fallback time either, fail the stage with a clear `ValidationError` — do not silently relax the licensing/rule constraints just to avoid a job failure.

**Required Tests:** Test: `AttachingMusic` selects an asset whose `filePath` is a local (non-URL) path; assert `RenderingVideo`'s fallback still only selects from mood/genre/license-compliant candidates, and fails cleanly (not with an unrelated track) if none exist.

---

## CFG-15

**Issue ID:** CFG-15
**Domain:** Music Selection / Caching / Concurrency
**Severity:** MEDIUM

**Title:** The 60-second music asset cache is a per-process, in-memory `Map` — multiple worker processes have independent, potentially-divergent views of the active music library, and newly uploaded/disabled assets are invisible to a given worker for up to 60 seconds.

**Current Behavior:** `content-pipeline.service.ts`:
```ts
const musicAssetCache = new Map<string, { timestamp: number; assets: Asset[] }>();
async function getCachedActiveMusic(workspaceId: string): Promise<Asset[]> { ... }
```
This is a plain module-level `Map`, scoped to a single Node.js process, with a hardcoded 60-second TTL and no invalidation hook (no cache-bust on `Asset` create/update/disable).

**Expected Behavior:** Per the audit brief's Section 15 checklist: (a) newly uploaded music should ideally be visible without a mandatory wait, or the wait should at least be consistent; (b) disabling an asset should reliably stop it from being selectable within a bounded, known time, not "somewhere between 0 and 60 seconds depending on which worker process happens to serve the next job"; (c) multiple worker processes should not have divergent views of the same workspace's music library at the same moment.

**Evidence:** `backend/src/services/content-pipeline.service.ts`, `musicAssetCache`/`getCachedActiveMusic`, module-level scope confirmed (declared outside any function, at file scope, so it's per-Node-process, not shared).

**Exact Files:** `backend/src/services/content-pipeline.service.ts`.

**Root Cause:** The cache was added (per its own inline comment, "LOW-02") purely as a query-count performance optimization in the prior audit round, without considering multi-worker consistency, since at the time BullMQ worker `concurrency` was the only "concurrency" under discussion — not multiple worker *processes*.

**Impact:** In the current single-worker-process deployment (per `docker-compose.prod.yml`'s single `worker` service), this is low-impact in practice (one process, one cache) — but it is a correctness landmine the moment the worker is horizontally scaled (running `worker` as `replicas: 2+`, which the architecture doesn't prohibit), at which point two worker processes could make different music-eligibility decisions for jobs running at the same moment, including one still treating a just-disabled asset as eligible after the other has already stopped selecting it.

**Recommended Direction:** If horizontal worker scaling is a real near-term plan, move this cache to Valkey (already used elsewhere in the stack for BullMQ and pub/sub) with the same 60-second TTL, so all worker processes share one view. If horizontal scaling isn't planned, this is acceptable as-is for now, but should be explicitly flagged as a "single-worker-process assumption" in the code comment (it currently isn't) so a future engineer scaling the worker doesn't miss it.

**Required Tests:** If moved to Valkey: integration test simulating two "worker processes" (two separate cache instances/connections) both reading via the shared cache and confirming consistent results after an asset update. If left as-is: no new test required, only the documentation comment.

---

# Other Asset Selection Findings

(See CFG-05 above — Font/Background/Logo/Watermark/Animation/Icon are covered as a single consolidated finding since the pattern and root cause are identical across all six.)

---

# Content Profile Findings

## CFG-01

**Issue ID:** CFG-01
**Domain:** Content Profile
**Severity:** CRITICAL

**Title:** `brandingRules`, `watermarkRules`, and `validationRules` are stored, validated as JSON, and editable via a dedicated UI form — and are never read by the pipeline, anywhere. This directly contradicts `PROJECT_DECISIONS.md` Section 11, which explicitly lists Branding Rules and Watermark Rules as fields "a Content Profile owns."

**Current Behavior — full field-by-field mapping** (per the audit brief's required format, Section 18/12):

| ContentProfile field | Stored? | Editable via UI? | Backend-validated? | Read by pipeline? | Runtime effect? |
|---|---|---|---|---|---|
| `brandingRules` | Yes (Json) | Yes (raw JSON textarea, generic "valid JSON" check only) | Only "is valid JSON," no shape validation | **No — zero occurrences outside CRUD** | **None** |
| `watermarkRules` | Yes (Json) | Yes (same as above) | Same | **No — zero occurrences outside CRUD** | **None** |
| `validationRules` | Yes (Json) | Yes (same as above) | Same | **No — zero occurrences outside CRUD** | **None** |
| `renderingConfiguration` | Yes (Json) | Yes | Same | Yes — `.branding`/`.watermark` sub-keys read in `RenderingImage` | Partial (only 2 sub-keys of an open-ended JSON blob are ever read) |
| `promptVariables` | Yes (Json) | Yes | Same | Yes — spread into Gemini variables | Yes, but see CFG-06 (collision risk) |
| `musicSelectionRules` | Yes (Json) | Yes | Same | Yes — `.mood`/`.genre` read in `AttachingMusic` | Yes for the happy path; see CFG-03/CFG-04 for gaps |
| `captionStrategy` | Yes (Json) | Yes | Same | Yes — `.template`/`.prefix`/`.suffix` read in `GeneratingCaption` | Yes, working correctly |
| `hashtagStrategy` | Yes (Json) | Yes | Same | Yes — `.tags` read in `GeneratingHashtags` | Yes, working correctly |

**Evidence:** Exhaustive grep of `backend/src` for `brandingRules`, `watermarkRules`, `validationRules` returns matches only in `contentProfile.service.ts`, `contentProfile.repository.ts`, and `routes/content-profiles.router.ts` (all CRUD/validation-shape code) — never in `content-pipeline.service.ts`, `rendering.service.ts`, or `video.service.ts`. Cross-checked against `docs/PROJECT_DECISIONS.md` Section 11's explicit list of what "A Content Profile owns," which includes "Branding Rules," "Watermark Rules," and "Validation Rules (additive constraints only — Section 6.2)" as first-class items alongside the fields that *are* wired correctly.

**Exact Files:** `backend/src/services/content-pipeline.service.ts` (absence confirmed here); `backend/src/services/contentProfile.service.ts`, `backend/src/repositories/contentProfile.repository.ts`, `backend/src/routes/content-profiles.router.ts` (CRUD-only presence confirmed here).

**Exact Functions:** `processStage` (specifically `RenderingImage`, which is the only plausible consumer for `brandingRules`/`watermarkRules`, and `Validating`, the only plausible consumer for `validationRules` — neither reads these fields).

**Root Cause:** `renderingConfiguration.branding`/`.watermark` was implemented as an ad-hoc, unstructured way to get *some* branding/watermark text onto rendered images, apparently without the implementer realizing (or without it being communicated) that dedicated `brandingRules`/`watermarkRules` fields already existed in the schema for this exact purpose. Two competing mechanisms exist; only the wrong one is wired up. Similarly, `validationRules` was added to the schema/API/UI layer to satisfy the documented Content Profile shape but the `Validating` pipeline stage was never updated to consult it — it uses only a hardcoded/system-config profanity word list, with no path for a profile to add its own additive validation constraints (per Section 6.2's "additive constraints only" framing, which implies profile-level rules are meant to *add to*, not replace, the system-level checks — a mechanism that doesn't exist).

**Impact:** This is the single clearest instance of "a configuration field that exists in Prisma but has no runtime effect is a bug, not a feature" (audit brief Section 12) found in this pass. An operator configuring branding, watermark text/position, or content-specific validation constraints through the dedicated, documented UI fields for those exact purposes will see their configuration silently do nothing, while a completely different, undocumented-in-the-UI JSON blob (`renderingConfiguration.branding`/`.watermark`) is what actually controls branding/watermark text. This is worse than a missing feature — it's a feature that appears to exist and doesn't.

**Recommended Direction:** Consolidate to one mechanism per concern, not two. For branding/watermark: retire `renderingConfiguration.branding`/`.watermark` as the source of truth and wire `RenderingImage` to read `brandingRules`/`watermarkRules` instead (define their minimal expected shape — e.g. `{text: string, position?: string}` — and validate that shape specifically, not just "is valid JSON"), OR conversely retire the dedicated `brandingRules`/`watermarkRules` columns and fold branding/watermark config into `renderingConfiguration` where it's actually read, updating `PROJECT_DECISIONS.md` Section 11 to match. Either direction resolves the contradiction; this audit does not prescribe which (that's a product call the remediation prompt requires be made explicitly, not silently). For `validationRules`: implement the "additive constraints" mechanism the docs already promise — at minimum, support a `bannedWords: string[]` and/or `maxLength: number` shape that `Validating` merges with the system-level profanity list before checking, since that's the simplest interpretation consistent with Section 6.2's framing.

**Required Tests:** Once wired: integration test proving a Content Profile's `brandingRules`/`watermarkRules` value actually appears in a rendered image's output (or in the arguments passed to the renderer, if pixel-level assertion isn't practical), and a test proving a profile-specific `validationRules.bannedWords` entry causes `Validating` to reject content that the base system-level list alone would have allowed through.

---

# Template Findings

## CFG-16

**Issue ID:** CFG-16
**Domain:** Template System
**Severity:** LOW (positive-leaning; one gap noted)

**Title:** Template versioning correctly pins `templateVersionId` for a running job (via the same `configSnapshot` mechanism as `promptVersionId`); no defect found in this pass beyond the same live-vs-snapshot boundary already covered by CFG-10.

**Current Behavior:** `RenderingImage` reads `templateVersionId` from `job.configSnapshot`, falling back to the live profile relation with a warning log only if the snapshot value is missing — the same correctly-implemented pattern as `promptVersionId`. `templateVersion.componentPath`/`componentSource` themselves were not traced into `rendering.service.ts` in this pass in enough depth to confirm the actual Playwright component-loading mechanism reads the *pinned* version's `componentSource` rather than always loading whatever the single hardcoded React layout currently is (per `PROJECT_DECISIONS.md`'s v2.3 note: "Documented single hardcoded React layout as the primary v1 rendering path... utilizing `TemplateVersion` tracking for future extensibility") — this may mean `TemplateVersion` is currently tracking metadata for a template system that isn't yet the actual rendering mechanism, which would make this a documentation-consistent, intentional v1 limitation rather than a bug. Flagged for explicit verification rather than asserted as a defect.

**Evidence:** `backend/src/services/content-pipeline.service.ts` (`RenderingImage` case, `templateVersionId` sourcing); `docs/PROJECT_DECISIONS.md` v2.3 changelog note.

**Exact Files:** `backend/src/services/rendering.service.ts` (verify whether `componentSource`/`componentPath` is actually loaded dynamically per-version, or whether the single hardcoded layout is used regardless of which `TemplateVersion` is pinned).

**Root Cause:** Not established — pending verification.

**Impact:** If `TemplateVersion.componentSource` is genuinely inert (matching the "single hardcoded layout" note), this would be a second instance of the CFG-01 pattern (configuration that exists in the DB/UI but has no runtime effect) — but the doc's own v2.3 note suggests this may be an intentional, disclosed v1 limitation rather than an undisclosed one, which is the meaningful difference between this and CFG-01/CFG-05.

**Recommended Direction:** Verify `rendering.service.ts` against `TemplateVersion.componentSource`/`componentPath` directly; if confirmed inert, either wire it up or make the Template UI explicitly label it as "tracked for future use, not yet applied to rendering" so it doesn't silently mislead the way CFG-01's fields do.

**Required Tests:** Once verified: integration test proving that switching a Content Profile's `templateVersionId` to a different `TemplateVersion` (with different `componentSource`) actually changes rendered image output; or, if intentionally inert for v1, no test needed but the UI-label fix above should ship.

---

# Rendering Configuration Findings

(See CFG-01 for `renderingConfiguration.branding`/`.watermark` overlap with `brandingRules`/`watermarkRules`, and CFG-16 for `TemplateVersion.componentSource` verification. No additional distinct findings — `language`/RTL/Urdu/Hindi rendering specifics were not deeply re-traced in this pass beyond confirming `profile.language` is passed to `renderingService.renderImage`; no defect found or claimed here.)

---

# Default/Fallback Findings

## CFG-17

**Issue ID:** CFG-17
**Domain:** Defaults / Fallback Behavior
**Severity:** MEDIUM

**Title:** Defaults for branding/watermark text (`'PUBLISHIQ'`, `'@publishiq'`) and video duration are correctly "fallback when missing," not "override when present" — but this correctness is undermined by CFG-01, since the field they fall back from (`renderingConfiguration.branding`/`.watermark`) isn't the field the UI actually presents as the place to configure branding.

**Current Behavior:** `(profile.renderingConfiguration as any)?.branding || 'PUBLISHIQ'` and the video-duration default sourced from `systemConfigCache.get('default_video_duration_seconds')` with a `15`-second code-level fallback are both correctly "use the configured value if present, otherwise use a sensible default" — no case was found where a default silently overrides a *valid* value. This part of the audit brief's Section 17 checklist passes.

**Evidence:** `backend/src/services/content-pipeline.service.ts`, `RenderingImage` and `RenderingVideo` cases.

**Exact Files:** `backend/src/services/content-pipeline.service.ts`.

**Root Cause:** N/A — correct behavior, noted for completeness and cross-referenced to CFG-01.

**Impact:** The mechanism is correct; the problem (covered fully in CFG-01) is that the field being defaulted (`renderingConfiguration.branding`) isn't the field the Content Profile UI/docs present as authoritative for branding (`brandingRules`), so "the default logic is correct" doesn't help an operator who configured the field they were told to configure.

**Recommended Direction:** No separate fix — resolved by CFG-01's remediation.

**Required Tests:** Covered by CFG-01's required tests.

---

# Frontend UX Findings

## CFG-18

**Issue ID:** CFG-18
**Domain:** Frontend UX / Content Profile
**Severity:** HIGH

**Title:** The Content Profile editor requires hand-authoring eight separate raw-JSON textareas with only generic "is this valid JSON" validation — no field-specific schema guidance, and no indication that three of the eight (`brandingRules`, `watermarkRules`, `validationRules` — see CFG-01) currently do nothing at all.

**Current Behavior:** `frontend/src/routes/content-profiles/ContentProfilesView.tsx` defines eight `...Json` string fields (`promptVariablesJson`, `brandingRulesJson`, `watermarkRulesJson`, `captionStrategyJson`, `hashtagStrategyJson`, `musicSelectionRulesJson`, `renderingConfigurationJson`, `validationRulesJson`), each validated only via `try { JSON.parse(val); return true } catch { return false }` — i.e., "is this syntactically valid JSON," not "does this JSON have the shape the corresponding pipeline stage expects" (e.g., nothing stops `musicSelectionRulesJson` from being `{"foo": "bar"}`, which parses fine as JSON and silently does nothing useful at generation time, since `AttachingMusic` only reads `.mood`/`.genre`).

**Evidence:** `frontend/src/routes/content-profiles/ContentProfilesView.tsx`, form field validators (lines ~25–47) and submit handlers parsing each field independently (lines ~169–207).

**Exact Files:** `frontend/src/routes/content-profiles/ContentProfilesView.tsx`.

**Root Cause:** The eight JSON-blob fields on `ContentProfile` were exposed to the UI as raw textareas rather than as structured sub-forms, likely because building eight small structured forms is more UI work than one generic JSON-textarea pattern reused eight times.

**Impact:** Directly matches audit brief Section 21's explicit instruction to "avoid forcing users to edit raw JSON unless that is genuinely necessary" — none of these eight fields have a shape complex enough to genuinely require raw JSON (they're all small, flat, well-known key sets per the pipeline code that reads them: `mood`/`genre`; `template`/`prefix`/`suffix`; `tags`; `branding`/`watermark`). A non-developer operator has no way to know the correct keys for any of these fields except by reading backend source code — this is the Content-Profile-level version of the same problem CFG-08 identifies for Prompts.

**Recommended Direction:** Replace the raw JSON textareas with small structured sub-forms for the fields that are actually consumed (`musicSelectionRules`: mood/genre dropdowns sourced from actual distinct values present in the Music asset library; `captionStrategy`: template/prefix/suffix text inputs; `hashtagStrategy`: a tag-list input) and, per CFG-01's resolution, either build the equivalent structured form for `brandingRules`/`watermarkRules` once they're wired up, or remove them from the UI if that direction is chosen instead. Leave `promptVariables` as raw JSON (it's genuinely open-ended by design) but add the reserved-name validation from CFG-06 to it specifically.

**Required Tests:** N/A (frontend UX) — but any backend shape-validation added as part of this (e.g. a Zod schema for `musicSelectionRules` specifically) should have unit test coverage for both valid and invalid shapes.

---

## CFG-19

**Issue ID:** CFG-19
**Domain:** Frontend UX / Asset System
**Severity:** MEDIUM

**Title:** The Asset UI does not show selection eligibility or explain why a given asset is or isn't currently selectable — an operator cannot tell, from the UI, whether an uploaded music track will ever actually be picked.

**Current Behavior:** Not fully traced to a specific Assets view file in this pass (time-bounded), but no evidence was found of an "eligibility" indicator (e.g., "this track is Active + Confirmed + matches N Content Profiles' mood/genre rules") anywhere in the asset-management flow.

**Evidence:** Inferred from the absence of any eligibility-related string found while reviewing adjacent frontend files; not exhaustively confirmed against every Asset-related frontend file given the audit's time budget — flagged as a probable gap pending direct verification, not asserted with full certainty.

**Exact Files:** Frontend Asset management view (path not fully confirmed in this pass — likely `frontend/src/routes/assets/` or similar; verify exact path during remediation).

**Root Cause:** Likely the same generic-CRUD-UI pattern as CFG-18, extended to Assets.

**Impact:** Directly relevant to audit brief Section 21's Assets checklist ("show selection eligibility," "show why an asset is or isn't eligible") — if confirmed absent, this makes CFG-03's rotation fix (once implemented) harder for an operator to verify/trust, since they'd have no way to see which tracks are even in the eligible pool for a given profile.

**Recommended Direction:** Verify the exact current state of the Asset UI during remediation before building anything; if genuinely absent, add a simple per-asset "eligible for: [list of mood/genre combinations from Active Content Profiles' musicSelectionRules that this asset would currently match]" indicator, computed client-side or via a lightweight backend endpoint — not a large feature, since the matching logic itself (mood/genre equality) is already simple.

**Required Tests:** N/A until scope is confirmed during remediation.

---

# Backend Validation Findings

## CFG-20

**Issue ID:** CFG-20
**Domain:** Backend Validation
**Severity:** HIGH

**Title:** Every one of the eight Content Profile JSON fields is validated only for "is this syntactically valid JSON" on the backend, not for shape — meaning the backend has exactly the same weak validation as the frontend (CFG-18), so "frontend validation is not sufficient" (audit brief Section 22) is currently true here in the strongest possible sense: there effectively is no meaningfully stronger backend layer underneath the weak frontend one.

**Current Behavior:** `backend/src/routes/content-profiles.router.ts`: `promptVariables: jsonSchema.default({})`, and similarly for all eight fields — `jsonSchema` (defined once, reused for all eight) validates only that the value is a JSON-serializable object, not any field-specific shape. `backend/src/schemas/content-profile.schema.ts` similarly declares each as `z.record(z.string(), z.any()).optional()` — an open `Record<string, any>`, which Zod will accept for literally any object.

**Evidence:** `backend/src/routes/content-profiles.router.ts` (lines ~21–47, all eight fields share `jsonSchema`); `backend/src/schemas/content-profile.schema.ts` (lines ~11–14, `z.record(z.string(), z.any())` for `captionStrategy`/`hashtagStrategy`/`musicSelectionRules`/`renderingConfiguration`).

**Exact Files:** `backend/src/routes/content-profiles.router.ts`, `backend/src/schemas/content-profile.schema.ts`.

**Root Cause:** Same generic-JSON-field pattern as CFG-18, applied at the backend layer too — the backend schema was written to match "whatever the frontend sends" rather than to independently enforce the shape the pipeline actually expects.

**Impact:** A malformed or misspelled key in any of these fields (e.g. `musicSelectionRules: {"mod": "Calm"}` — typo'd key) is accepted by both frontend and backend validation, stored, and then silently produces the "no key match, fall through to defaults" behavior in the pipeline (e.g. `mood = selectionRules.mood || 'Inspiring'` — a typo'd key just means `mood` defaults to `'Inspiring'`, same as if the field were empty, with no error surfaced anywhere).

**Recommended Direction:** Define a specific Zod schema per field, matching exactly what the pipeline code reads: `musicSelectionRulesSchema = z.object({mood: z.string().optional(), genre: z.string().optional()}).strict()` (the `.strict()` is important — it rejects unknown keys like the `mod` typo above, rather than silently ignoring them), and similarly narrow schemas for `captionStrategy` (`{template, prefix, suffix}`), `hashtagStrategy` (`{tags: string[]}`), and (once CFG-01 is resolved) `brandingRules`/`watermarkRules`/`validationRules`. Leave `promptVariables` as an open record (correct, since it's genuinely meant to be free-form) but layer CFG-06's reserved-name check on top of it specifically.

**Required Tests:** Unit test per field: a payload with a correct-shape value is accepted; a payload with a typo'd/unknown key is rejected with a clear error (not silently accepted and silently ignored later).

---

# Database Findings

## CFG-21

**Issue ID:** CFG-21
**Domain:** Database Integrity
**Severity:** LOW (positive-leaning)

**Title:** Core integrity constraints relevant to this audit's scope are correctly present: `GeneratedContent.textHash` uniqueness (per-workspace), `PromptVersion`/`TemplateVersion` uniqueness per version number, and `PlatformConnection` uniqueness per external account — no new gaps found in this pass beyond CFG-14's normalization concern.

**Current Behavior:** Confirmed present in `backend/prisma/schema.prisma`: `GeneratedContent`: `@@unique([workspaceId, textHash])`; `PromptVersion`: `@@unique([promptId, versionNumber])`; `TemplateVersion`: `@@unique([templateId, versionNumber])`; `PlatformConnection`: `@@unique([workspaceId, platform, externalAccountId])`. No unique constraint exists (or is needed) directly on the eight Content Profile JSON fields themselves, since they're configuration blobs, not identity fields.

**Evidence:** Direct schema read, `backend/prisma/schema.prisma`.

**Exact Files:** `backend/prisma/schema.prisma`.

**Root Cause:** N/A.

**Impact:** None — positive finding, also listed below.

**Recommended Direction:** None required for this specific scope.

**Required Tests:** None beyond what's already covered by CFG-14/CFG-13.

---

# Testing Gaps

No test file in `backend/src/tests/` (confirmed list: `auth.test.ts`, `bullmq-error-handling.test.ts`, `domain-events-transactions.test.ts`, `duplicate-content-detection.test.ts`, `music-trimming.test.ts`, `oauth-state.test.ts`, `pipeline-version-pinning.test.ts`, `pipeline.test.ts`, `publishing-concurrency.test.ts`, `publishing-idempotency.test.ts`, `publishing-retry-budget.test.ts`, `scheduled-job-idempotency.test.ts`, `workspace-isolation.test.ts`) covers:

- Prompt creation/validation with a `{{variable}}` that has no corresponding source (CFG-02).
- Reserved-variable-name collision between `promptVariables` and dedicated Content Profile fields (CFG-06).
- Prompt versioning rollback/pinned-version behavior specifically for *behavioral* profile fields beyond the version pointers (CFG-10).
- Concurrent `PromptVersion` creation (CFG-11).
- Music selection returning different assets across multiple eligible candidates (CFG-03) — `music-trimming.test.ts` exists but per its name concerns trimming, not selection-among-candidates; verify during remediation that it doesn't already cover this.
- Music fallback path honoring `musicSelectionRules` (CFG-04).
- Disabled/unlicensed assets never being selected even via the `RenderingVideo` fallback path specifically (distinct from the `AttachingMusic` path, which likely is covered).
- Any non-Music asset type actually affecting rendering (CFG-05) — none exist because no such behavior exists yet.
- Content Profile field-shape validation rejecting malformed/typo'd keys (CFG-20).
- `brandingRules`/`watermarkRules`/`validationRules` affecting rendering/validation output (CFG-01) — none exist because no such behavior exists yet.
- Unicode-normalization equivalence for duplicate detection in Hindi/Urdu text (CFG-14).

**Existing, confirmed-relevant test coverage** (positive): `duplicate-content-detection.test.ts` almost certainly covers the CFG-13 P2002 path (name strongly suggests it, and the underlying mechanism was confirmed correct in this pass) — verify it specifically exercises concurrent/racing writes, not just the pre-check path, during remediation. `pipeline-version-pinning.test.ts` almost certainly covers the `promptVersionId`/`templateVersionId` snapshot behavior from the prior audit's MED-04 — this is good, and should be extended (not replaced) to cover CFG-10's broader behavioral-field snapshot scope once that's implemented.

---

# Documentation Ambiguities

1. **PROJECT_DECISIONS.md Section 9.1** ("Selection is rule-based, configurable per Content Profile") does not specify tie-breaking behavior among multiple rule-matching candidates. This audit treats "always pick the first/same one" as a defect per the audit brief's explicit framing (Section 13), but the doc itself doesn't rule it out. **Recommendation:** once CFG-03 is resolved, add an explicit sentence to Section 9.1 documenting the chosen tie-break strategy (e.g., "ties among rule-matching candidates are broken by deterministic rotation, tracked per profile/mood/genre").

2. **PROJECT_DECISIONS.md Section 21** lists "Global Prompt Variables" as System Configuration data with no corresponding implementation anywhere in the codebase (CFG-07). **Recommendation:** either implement or remove the line — do not leave it as an implied-but-nonexistent capability.

3. **PROJECT_DECISIONS.md Section 11** lists "Branding Rules," "Watermark Rules," and "Validation Rules (additive constraints only — Section 6.2)" as fields a Content Profile "owns," which the current implementation directly contradicts (CFG-01). This is not an ambiguity so much as a direct doc/implementation conflict — flagged here per Section 26's explicit instruction to report doc/implementation contradictions rather than silently deciding which one is "right." Given the doc is described elsewhere in this same document as deliberately "frozen" except for versioned amendments, and given three fields with full CRUD/UI/schema support already exist for this purpose, the more likely resolution is that the *implementation* is incomplete relative to an intentional, already-agreed doc — but this audit does not unilaterally decide that; it's flagged for an explicit remediation decision.

4. **Section 6.2's "additive constraints only"** framing for `validationRules` is referenced but the actual shape/mechanism of what an "additive constraint" looks like is not fully specified in the sections read during this pass (Section 6.2 itself was not separately located/read in full in this audit — flagged as a gap in this audit's own coverage, not a confirmed doc gap; verify Section 6.2's exact content during remediation before implementing CFG-01's `validationRules` fix).

---

# Positive Findings

- **Exact-duplicate detection (CFG-13) is now genuinely correct**: DB-enforced uniqueness, correct P2002-triggered full-state regeneration (all stale fields reset, not just text), bounded retry with a clear terminal error. This was the audit brief's single most emphasized concern (Sections 8–10) and it holds up under direct code inspection.
- **`captionStrategy` and `hashtagStrategy` are correctly wired**: both are read from the live Content Profile at the appropriate pipeline stage and genuinely change output (`template`/`prefix`/`suffix` substitution; custom tag list override) — proof the "profile field → pipeline stage → runtime behavior" chain works correctly when it's actually built, which makes CFG-01's gap for the sibling `brandingRules`/`watermarkRules`/`validationRules` fields more clearly an omission than a fundamental architectural limitation.
- **Mood/genre rule-based filtering for music (the "rules" part, distinct from the "which one of the matches" part) is correctly implemented** and correctly excludes non-`Active`/non-`Confirmed` assets in the primary `AttachingMusic` path.
- **`promptVersionId`/`templateVersionId` pinning via `configSnapshot`** (the prior audit's MED-04 fix) is correctly implemented and does prevent a live profile edit from silently changing which prompt/template *version* an in-flight job uses, with a sensible logged fallback for pre-existing jobs.
- **Gemini structured-output contract** (`geminiResponseSchema` sent to the API, `AIContentResponseSchema` validated on the response) is internally consistent end-to-end for every field it defines — no request/response/storage/UI mismatch found for `title`/`quote`/`caption`/`hashtags`/`language`/`contentType`.
- **AI provider retry logic** correctly sources its retry count from System Configuration (`retry_limit.generation`) rather than a hardcoded constant, consistent with the documented System Configuration philosophy.
- **Normalization's punctuation-stripping and whitespace-collapsing logic is correct** for the ASCII/English case (`"Hello world"`, `" hello   world "`, `"HELLO WORLD"`, `"Hello\nworld"` would all correctly normalize to the same hash) — the gap identified (CFG-14) is specifically and only about Unicode canonicalization for non-Latin scripts, not a defect in the base approach.

---

# Final Answers to the Brief's Required Questions

1. **Can a user create a valid prompt without understanding internal code?** No (CFG-02, CFG-08) — they need to know the four system variable names exist and how substitution behaves, which is nowhere in the UI.
2. **Does the database know enough about a prompt to validate it?** No — `PromptVersion.body` is an unstructured string with no extracted/validated variable metadata (CFG-02).
3. **Can an invalid prompt reach Gemini?** Yes, trivially — there is no validation gate between prompt authoring and the API call (CFG-02).
4. **Can a valid prompt be silently broken by variable substitution?** Yes (CFG-02, CFG-06) — both via unmatched placeholders and via silent key-collision overrides from `promptVariables`.
5. **Can generated content still be duplicated?** No, for exact duplicates — this is now correctly enforced (CFG-13), modulo the Unicode-normalization gap for Hindi/Urdu (CFG-14).
6. **Can two concurrent workers generate and persist the same content?** No — the database-level unique constraint plus P2002-triggered regeneration correctly prevents this (CFG-13).
7. **Does duplicate regeneration actually regenerate?** Yes, correctly — full stale-field reset confirmed (CFG-13).
8. **Can the same music asset be selected repeatedly simply because it is first?** Yes — confirmed, unfixed (CFG-03).
9. **Can rendering silently bypass `musicSelectionRules`?** Yes — confirmed in the `RenderingVideo` fallback path (CFG-04).
10. **Are other assets actually selected and used?** No — only Music; the other six types are entirely inert (CFG-05).
11. **Are `ContentProfile` configuration fields actually connected to runtime behavior?** Partially — 5 of 8 JSON fields are (`promptVariables`, `musicSelectionRules`, `captionStrategy`, `hashtagStrategy`, and `renderingConfiguration`'s two sub-keys); 3 of 8 are not (`brandingRules`, `watermarkRules`, `validationRules` — CFG-01).
12. **Do valid user configurations ever get silently overridden by defaults?** Not by *system* defaults (CFG-17 confirms defaults only fill gaps) — but a user's own `promptVariables` can silently override their own dedicated Content Profile fields (CFG-06), which is a different but related failure mode.
13. **Are disabled/unlicensed assets guaranteed not to be used?** In the primary `AttachingMusic` selection path, yes. In the `RenderingVideo` fallback path, **license status is not even checked** (CFG-04) — so no, not guaranteed end-to-end.
14. **Are existing jobs protected from later Prompt/Template changes?** For the version *pointers*, yes (confirmed correct, prior audit's MED-04). For the *behavioral* configuration on the linked Content Profile, no (CFG-10).
15. **Is the UI clear enough for a real operator to configure these systems safely?** No — both the Prompt UI (CFG-08) and the Content Profile UI (CFG-18) require implementation-level knowledge to use safely, and the Asset UI likely does too for eligibility (CFG-19, pending full verification).
16. **Are backend invariants enforced independently of frontend validation?** Not meaningfully for the eight Content Profile JSON fields — the backend schema is exactly as permissive as the frontend's "is this valid JSON" check (CFG-20). Backend invariants *are* meaningfully independent and correct for duplicate detection (DB constraint) and workspace isolation (per the prior audit).
17. **Are all important edge cases tested?** No — see Testing Gaps; none of CFG-01 through CFG-10's core defects have regression coverage, because in most cases the correct behavior doesn't exist yet to test.