# Document 15: Coding Standards
## AI-Powered Content Automation Platform

**Document Status:** Approved for Implementation Planning
**Version:** 1.0
**Depends On:** Document 03 (TRS §5.1–5.5), Document 04 (System Architecture §5.1, §11), Document 07 (Frontend Architecture §7), Document 14 (Error Handling)
**Amends:** Document 04 (resolves the import-boundary enforcement risk left open since §11/§16), Document 14 (gives the error taxonomy a concrete code-level structure)
**Owner:** Founding Engineering Team

---

## 1. Executive Summary

This document defines the concrete, enforceable coding conventions the codebase must follow — naming, formatting, module boundary enforcement, and error-handling code structure. It closes two items other documents identified but couldn't resolve themselves: Document 04's layered-architecture boundaries have been described since §5.1 but never given an actual enforcement mechanism, and Document 14's error taxonomy has been fully specified as data but never given a concrete representation in code.

Everything here is enforced by tooling (ESLint, Prettier, TypeScript compiler options) wherever possible — a coding standard that relies on developers remembering the rule is not a standard, it's a suggestion, and this codebase has already shown (across fourteen prior documents) how easily good intentions drift without a structural backstop.

---

## 2. Objectives

| # | Objective |
|---|-----------|
| CO-1 | Resolve Document 04's import-boundary enforcement risk with an actual, specific lint configuration — not another restated intention |
| CO-2 | Define a concrete error representation in code that implements Document 14's taxonomy |
| CO-3 | Establish naming, formatting, and file organization conventions consistent enough that generated code doesn't need per-PR bikeshedding |
| CO-4 | Define commit and code review conventions that scale from a single contributor to a future team without requiring a later rewrite of process |

---

## 3. Scope

Covers: naming conventions, formatting/linting configuration, layer boundary enforcement, error handling code pattern, commit conventions, code review checklist, test file conventions.

Does not cover: the architectural decisions themselves (Documents 04, 07, 14 — this document enforces them, doesn't redecide them), CI/CD pipeline configuration beyond what's needed to run these checks (Document 03 §5.1).

---

## 4. Import Boundary Enforcement (Resolves CO-1 — The Critical Fix)

### 4.1 The Unresolved Item

Document 04 §5.1 defined four layers (Domain → Application → Infrastructure/Interface, with strict inward-only dependency direction) and explicitly flagged in §11 that boundary erosion — "someone imports Infrastructure directly into Domain 'just this once'" — was a real risk needing "a lint rule / import boundary enforcement... as a tooling backstop," then repeated that same recommendation unresolved in §16.

### 4.2 Resolution

**ESLint's `no-restricted-imports` (or an equivalent boundary-aware plugin) is configured with explicit rules per layer**, enforced in CI (Document 03's existing CI gate) as a build-blocking check, not a warning:

| Layer | May Import From | May NOT Import From |
|---|---|---|
| Domain | Nothing outside Domain (no framework, no I/O) | Application, Infrastructure, Interface — enforced as a hard boundary, since Domain importing anything outward is the specific violation Document 04 §5.1 exists to prevent |
| Application | Domain only | Infrastructure, Interface — Application depends on interfaces Infrastructure implements, never the concrete Infrastructure module itself (this is what makes swapping an adapter possible without touching Application code, per Document 04 §5.3) |
| Infrastructure | Domain, Application (interfaces only) | Interface |
| Interface | Application | Infrastructure directly (Interface calls Application, which in turn uses Infrastructure via dependency injection — Interface never reaches past Application to touch Infrastructure concretely) |

**Module-level organization requirement:** each of Document 04 §5.2's core modules (Content, AI Generation, Media, Publishing, Storage, Scheduling, Platform Accounts, Observability) is a distinct lint-boundary group — the rule above applies both *between* the four layers *within* a module and *across* modules, so one module's Infrastructure can't be casually imported by another module's Application layer either, which Document 04 never explicitly stated but is clearly implied by "modular monolith with hard internal module boundaries" (Document 04 §1).

**This closes Document 04's risk permanently, not provisionally** — a PR that violates the boundary fails CI before a human reviewer ever needs to catch it by eye, which is the entire point of Document 04 §11's original concern about relying on manual discipline.

---

## 5. Error Handling Code Pattern (Resolves CO-2)

### 5.1 The Gap

Document 14 §4 defined a complete error taxonomy (retry disposition × domain × code) but never specified how an error is actually represented in TypeScript code — as a thrown exception, a `Result<T, E>` return type, or something else. Without this, "enforce the taxonomy via shared types" (Document 14 §12) has nothing concrete to point at.

### 5.2 Resolution

**A single `AppError` class, extending the native `Error`, carrying Document 14 §4's taxonomy fields as required constructor arguments:**

- `code` — one of the enumerated values from Document 14 §4.2's registry (shared schema package, Document 07 §7, so this is a compile-time-checked union, not a free-form string)
- `domain` — the error domain axis
- `retryable` — boolean, derived from the code's registry entry, not independently settable per-throw-site (preventing the exact drift risk Document 14 §12 flagged — a developer can't accidentally mark a `CONTENT_POLICY_REJECTED` as retryable by mistake, because retryability is a property of the code itself, not a parameter)
- `detail` — human-readable context (maps to `ContentStateEvent.detail` / `PublishAttempt.error_detail`, Document 05 §5.8, §5.10)

**Pattern:** `AppError` is thrown from Domain/Application/Infrastructure layers wherever Document 03 §5.5's error classification applies. It is caught exactly once, at the boundary — either the Express error-handling middleware (Interface layer, for API request errors) or the BullMQ job processor's top-level catch (for pipeline stage errors) — never caught and re-thrown repeatedly through intermediate layers. This directly implements Document 03 §5.5's "no silent catches" rule with a concrete shape: any `catch` block that doesn't either handle an `AppError` completely or let it propagate unchanged is a defect, not a style choice, exactly as Document 03 stated in principle.

**Non-`AppError` exceptions** (genuinely unexpected errors — a null pointer, a library throwing something unclassified) are caught at the same boundary and wrapped as `INTERNAL_ERROR` (Document 14 §4.2) before logging — the system never lets a raw, unclassified exception reach a log line or API response without at least being tagged into the taxonomy at the point it's first caught.

---

## 6. Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Files (backend modules, utilities) | kebab-case | `content-item-service.ts` |
| React components | PascalCase, filename matches component name | `ContentItemCard.tsx` |
| Variables, functions | camelCase | `getActiveContentType` |
| Types, interfaces, classes | PascalCase | `ContentItem`, `AppError` |
| Constants (true compile-time constants) | SCREAMING_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |
| Booleans | `is`/`has`/`should` prefix | `isApprovalGated`, `hasActiveSchedule` |
| Database tables/columns | snake_case (Prisma convention, matches Document 05's field naming already used throughout) | `content_item`, `owner_id` |

**No abbreviations** except industry-standard ones already used throughout Documents 01–14 (`id`, `url`, `api`) — a variable named `ctntItm` instead of `contentItem` is a readability regression with no corresponding benefit, and this codebase's whole design philosophy (explicit, traceable, documented) argues against saving four keystrokes at the cost of clarity.

---

## 7. TypeScript Conventions (Extends Document 03 TR-2)

| Rule | Detail |
|---|---|
| `strict: true` | Already required (Document 03 TR-2) — restated as the non-negotiable baseline everything below assumes |
| No `any` | Enforced via ESLint (`no-explicit-any`); an escape hatch requires an inline comment justifying why (Document 03 TR-2's existing exception clause) — reviewers should treat an unjustified `any` as a blocking comment, not a nitpick |
| Explicit return types on exported functions | Required — inferred return types are fine for private/internal functions, but anything crossing a module boundary (§4's layers) should have its contract visible without needing to trace the implementation |
| `type` over `interface` for data shapes; `interface` reserved for genuinely extensible contracts (e.g., the `AIProvider`/`PlatformPublisher` adapter interfaces, Document 04 §5.3) | Keeps the distinction meaningful — using `interface` everywhere by habit erases the signal that these specific adapter contracts are deliberately built for multiple implementations |
| Zod-derived types (`z.infer`) for anything with a corresponding schema (Document 07 §7 shared package) | Never hand-write a type that duplicates a Zod schema's shape — this is the concrete mechanism that makes Document 07 FE-AD-3's drift-prevention claim actually true in code, not just in the architecture document |

---

## 8. Formatting

Prettier, default configuration with two explicit overrides: single quotes (matches the codebase's existing convention throughout this document set's own code-adjacent references), no semicolons omitted (explicit semicolons — reduces ASI-related edge-case bugs, a small but real category of JavaScript footguns not worth the minor stylistic preference for omitting them). Enforced via a pre-commit hook and CI check, not manual review — formatting disagreements should never consume code review time.

---

## 9. Commit Conventions

**Conventional Commits** format (`type(scope): description`, e.g., `fix(publishing): correct Instagram container polling timeout`) — chosen because it's a widely-adopted standard (not inventing a bespoke convention this project would need to document and onboard people to) and because `scope` naturally maps to Document 04 §5.2's module names, keeping commit history navigable by the same boundaries the codebase itself is organized around.

| Type | Use |
|---|---|
| `feat` | New capability |
| `fix` | Bug fix |
| `refactor` | No behavior change |
| `test` | Test-only changes |
| `docs` | Documentation only |
| `chore` | Tooling, dependencies, config |

---

## 10. Code Review Checklist

A PR is not approved until the reviewer has explicitly checked:

- [ ] No import-boundary violations (should already fail CI per §4, but a human check catches boundary-adjacent smells the lint rule's literal scope might miss)
- [ ] Errors thrown are `AppError` instances with a correct, registry-backed code (§5) — not ad hoc strings or generic `Error`
- [ ] No `catch` block that swallows an error without either fully handling it or re-throwing it unchanged (Document 03 §5.5)
- [ ] New/changed pipeline stages remain idempotent (Document 03 TR-4) — re-running the job must not produce duplicate side effects
- [ ] New endpoints follow Document 06's conventions — action endpoints for state transitions (never a generic `state` field), CSRF token validated (Document 13 §4), Idempotency-Key honored where applicable (Document 06 §5.4)
- [ ] Tests exist per Document 03 §5.1's coverage expectations for the type of code changed

---

## 11. Test File Conventions (Extends Document 03 §5.1, Document 07 §12)

| Convention | Detail |
|---|---|
| File naming | `*.test.ts` colocated with the file under test (feature-based organization, Document 07 FE-AD-1 — tests live with the feature, not in a parallel mirrored directory tree) |
| Structure | `describe` blocks per function/component, `it`/`test` blocks stating expected behavior in plain language (e.g., `it('rejects an illegal state transition with a 409')`) — test names should be readable as a specification, since Document 06 §14 already established that illegal-path testing (not just happy-path) is a production-critical requirement, and a clearly-named test is how that requirement stays visible in the test suite itself |
| Boundary-crossing tests | Any test exercising an adapter (`AIProvider`, `PlatformPublisher`, Document 04 §5.3) uses the sandbox/mock endpoints established in Document 03 §5.1 — never a live call to a real platform or AI provider in automated tests |

---

## 12. Architecture Decisions

| ID | Decision | Rationale |
|---|---|---|
| CS-AD-1 | Import boundaries enforced via CI-blocking ESLint rules, scoped per-layer and per-module | Closes Document 04's twice-flagged, never-resolved risk with an actual mechanism rather than continued reliance on manual discipline |
| CS-AD-2 | Single `AppError` class with taxonomy fields as required, code-derived (not independently settable) properties | Gives Document 14's taxonomy a concrete code-level home; prevents the specific drift risk of a developer manually mis-marking retryability |
| CS-AD-3 | Conventional Commits over a bespoke commit format | Avoids inventing and documenting a new convention when a standard one already fits, particularly given `scope` maps naturally onto existing module boundaries |
| CS-AD-4 | Test files colocated with source, not mirrored in a parallel directory | Consistent with Document 07's feature-based organization decision — a parallel test-directory structure would be a second, competing organizational principle |

---

## 13. Tradeoffs

| Tradeoff | Gain | Cost | Verdict |
|---|---|---|---|
| CI-blocking boundary lint vs. a documented convention relying on review discipline | Structurally can't drift, matches Document 04 §11's own stated preference for a "tooling backstop" | Some upfront ESLint configuration effort, occasional friction when a genuinely justified exception needs an explicit override | Accept — this is literally the fix Document 04 asked for and never got; not implementing it now would mean acknowledging the risk a third time without resolving it |
| `AppError`'s retryability derived from `code` rather than settable per-throw | Prevents accidental misclassification | Slightly less flexibility for a genuinely novel one-off error that doesn't cleanly fit an existing code | Accept — Document 14 §4.2 already established the registry as living/extensible; a new code can always be added rather than bypassing the registry's discipline for a one-off |

---

## 14. Assumptions

- **CSA-1:** ESLint's boundary-enforcement capability (via `no-restricted-imports` or a dedicated plugin such as one built for layered-architecture enforcement) is sufficient for this codebase's scale — a more sophisticated architectural-fitness-function tool would be over-engineering for a single-contributor-scale v1.
- **CSA-2:** Conventional Commits' learning curve is negligible given it's a widely-documented, common standard — no team-specific onboarding material is needed beyond linking the specification.

---

## 15. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Boundary lint rules (§4) configured too loosely to actually catch violations (e.g., a glob pattern that misses a valid violating import path) | Medium — would provide false confidence, the worst outcome given this is meant to be the definitive fix for a twice-flagged risk | Recommend a deliberate negative test during setup — write a known-violating import, confirm CI actually fails on it, before trusting the rule going forward |
| `AppError` pattern not consistently adopted (some code paths still throw plain `Error` or ad hoc strings) | Medium | Directly covered by §10's code review checklist item — this is exactly the kind of drift a checklist item exists to catch during the window before it's fully habitual |

---

## 16. Future Expansion

- Boundary lint rules (§4) extend naturally to any future extracted service (Document 04 §12 — module extraction path) since the boundaries were already being enforced as if they were service boundaries
- `AppError`'s code registry grows with new platforms/providers (Document 14 §11) without requiring changes to the `AppError` class itself, only new registry entries

---

## 17. Open Questions

| ID | Question | Recommendation |
|---|---|---|
| OQ-32 | Should the boundary-lint configuration be a custom ESLint config or an off-the-shelf architectural-boundary plugin? | Recommend starting with `no-restricted-imports` (built into ESLint, zero new dependency) and only adopting a dedicated plugin if the configuration becomes unwieldy in practice — consistent with this document set's repeated preference for the minimal mechanism that actually solves the problem |

---

## 18. Industry Best Practices Applied

- **CI-enforced architectural boundaries over documentation-only conventions** — standard practice specifically because documentation-only rules are known to erode under deadline pressure, which Document 04 §11 already identified as the exact risk here
- **Typed, taxonomy-backed error classes over ad hoc thrown values** — standard practice in mature TypeScript codebases, and the direct enabler of Document 14's error taxonomy actually being enforceable rather than aspirational
- **Conventional Commits** — widely adopted standard, chosen deliberately over a bespoke format for the same reason this document set has generally preferred standard patterns over invented ones (session cookies over custom auth, cursor pagination over custom schemes, etc.)

---

## 19. Production Considerations

- The boundary lint rule (§4) should be added and verified (per §15's negative-test mitigation) **before** the first feature PR, not retrofitted after several modules already exist — Document 04 §16 already made this exact recommendation ("establishing discipline from the first module... far more expensive to retrofit"), and it's worth repeating here since this is the document that finally has to make it real
- `AppError`'s `detail` field (§5.2) must never include raw secrets/credentials (Document 13's encryption requirements) — error detail strings are exactly the kind of place a stray `error.message` from a failed platform auth call could accidentally leak a token fragment if not deliberately sanitized at the throw site

---

## 20. Recommendations

1. Implement §4's boundary lint rules literally before any other implementation work begins — this is a two-document-old, twice-flagged, previously-unresolved risk, and there's no remaining reason to defer it further.
2. Implement `AppError` (§5) as part of the same initial setup — Document 14's entire taxonomy is inert without it.
3. This document set (01–15) is now genuinely comprehensive across vision, product, technical, architecture, database, API, frontend, design, UX, dashboard, AI, platforms, security, observability, and coding standards. There is no remaining "next document" I'd propose generating — the honest next step, stated plainly and for the last time, is reconciling the amendments scattered across Documents 10–15 back into their source documents (01, 03, 04, 05, 06, 14) before any of this becomes code.

---

**End of Document 15 — Coding Standards**