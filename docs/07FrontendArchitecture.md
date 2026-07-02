# Document 07: Frontend Architecture
## AI-Powered Content Automation Platform

**Document Status:** Approved for Implementation Planning
**Version:** 1.0
**Depends On:** Document 02 (PRD), Document 04 (System Architecture), Document 06 (API Specification)
**Owner:** Founding Engineering Team

---

## 1. Executive Summary

This document defines how the React/TypeScript dashboard is structured, how it manages server and local state, how it stays honest about pipeline state (never inferring transitions the backend hasn't confirmed), and how the animation/design tooling in the stack (Framer Motion, shadcn/ui) is used deliberately rather than decoratively.

The frontend's core job, per Document 02 PO-1, is to be a control center the owner trusts. Every decision here is evaluated against a simple test: **does this make system state clearer and faster to act on, or does it just look nice?** Where those conflict, clarity wins.

---

## 2. Objectives

| # | Objective |
|---|-----------|
| FO-1 | Define a component organization that scales from 12 dashboard sections (Document 02 §4) without becoming an unstructured pile of one-off components |
| FO-2 | Establish a server-state strategy (TanStack Query) that keeps the dashboard accurate after every state-transition action, closing the gap Documents 02–06 left open |
| FO-3 | Keep the frontend a "dumb" consumer of backend state machine decisions — it displays state and requests transitions, it never computes or assumes them (directly enforces Document 06 API-AD-1 from the client side) |
| FO-4 | Give Framer Motion and shadcn/ui explicit usage boundaries so the design system stays consistent and animation stays purposeful |
| FO-5 | Prevent Zod validation schemas from silently drifting out of sync with the backend's actual validation rules |

---

## 3. Scope

Covers: component organization strategy, state management (server and local), data fetching/cache invalidation, form/validation strategy, routing, animation guidelines, design system usage, frontend testing strategy, error/loading/empty state handling.

Does not cover: visual design tokens/branding specifics, literal component code, backend API implementation (Document 06).

---

## 4. Component Organization Strategy

**Decision:** feature-based organization, not type-based. Components, hooks, and query logic for "Content Library" live together as a unit; components, hooks, and query logic for "Publishing Queue" live together as a separate unit. A small shared/common layer holds genuinely cross-feature primitives (layout shell, shadcn/ui wrappers, shared formatting utilities).

**Why not type-based** (`components/`, `hooks/`, `utils/` as top-level buckets)? Because Document 02 already defines the product in terms of 12 largely independent dashboard sections (§4.1–4.11) — type-based organization would scatter each section's logic across three or four unrelated top-level folders, making "everything about the Publishing Queue" a search operation instead of a single location. Feature-based organization mirrors the PRD's own structure, which is the actual source of truth for how this product is organized.

This is described conceptually here, not as a literal folder tree, consistent with Document 04's approach to backend module boundaries — the specific directory layout is an implementation task guided by this principle, not an architectural decision requiring its own document section.

---

## 5. State Management Strategy

Document 04 §7 already made the top-level split: **TanStack Query owns server state, Zustand owns local UI state.** This section makes that split concrete and closes the gap Document 04 left open around cache invalidation after actions.

### 5.1 Server State (TanStack Query)

| Aspect | Design |
|---|---|
| Query key structure | Hierarchical, matching the resource structure of Document 06 (e.g., `['content-items', 'list', filters]`, `['content-items', 'detail', id]`) — enables targeted invalidation without over-invalidating unrelated queries |
| **Cache invalidation after actions (Resolves FO-2)** | Every state-transition action (Document 06 §6.1.1: approve, reject, discard, retry) and queue action (§6.2: force-publish, cancel) invalidates both the specific item's detail query **and** the relevant list query on success — not just one or the other. A successful "Approve" must update both the item's own state (if the owner is looking at the detail view) and remove it from any "Pending Approval" filtered list view simultaneously. |
| No optimistic updates for state transitions | Given Document 06 API-AD-1's explicit rejection of illegal transitions (`409 Conflict`), state-transition actions show a loading state and wait for server confirmation rather than optimistically updating the UI — an optimistic "Approved" that gets reverted a moment later because the server rejected it is worse for trust (Document 02 PO-1) than a half-second wait |
| Optimistic updates permitted for field edits | Caption/hashtag edits (Document 06 §6.1 `PATCH`) may use optimistic updates — these are low-risk, non-state-machine field changes where a brief rollback-on-error is an acceptable tradeoff for responsiveness |
| Refetch strategy | Refetch-on-window-focus enabled for list views (dashboard, queue) so returning to the tab shows current state without a manual refresh; disabled for the content detail view during active editing to avoid clobbering in-progress edits |

### 5.2 Local UI State (Zustand)

Strictly limited to state that has no server representation: active filter selections before they're applied, modal/drawer open state, multi-select selections in list views, sidebar collapse state. **Rule: if a piece of state could be answered by asking the backend, it does not belong in Zustand.** This is the concrete enforcement of Document 04 §7's "kept strictly separate" principle — without a rule like this, it's easy for local caches of server data to creep into Zustand and become a second, competing source of truth.

### 5.3 Form State (React Hook Form + Zod)

React Hook Form manages form-local state (templates, prompt editing, settings); Zod schemas validate before submission. See §7 for how these schemas stay aligned with backend validation.

---

## 6. State Machine Representation on the Frontend (Resolves FO-3)

The frontend maintains a **display-only** mapping of `ContentItem.state` (Document 05 §5.6) to UI treatment (badge color, available actions, iconography). It does **not** maintain its own copy of transition rules.

**Concretely:** the set of action buttons shown for a content item (Approve/Reject/Discard/Retry) is determined by asking "does the API expose this action for this item's current state," which in practice means the frontend keeps a simple state-to-available-actions lookup table that must be kept in sync with Document 06 §6.1.1 — but critically, this lookup only controls **which buttons are shown**, never bypasses the server's own validation. If the lookup table drifts out of sync and shows a button that's no longer valid, the worst outcome is a `409` response with a clear error message (Document 06 §5.1) — never a corrupted state, because the server remains the sole authority.

---

## 7. Validation Schema Alignment (Resolves FO-5)

**Problem:** Zod schemas will exist on both frontend (form validation) and backend (Document 04 Application-layer validation). Without coordination, these drift — a backend rule change (e.g., a new required field) doesn't automatically show up as a frontend validation error, so the owner hits a confusing server-side rejection after a form appeared to submit successfully.

**Decision:** frontend and backend share a single `types`/`schemas` package within the same repository (this is a monorepo-lite structure — one repository, not one deployable, consistent with Document 04's modular monolith approach). Zod schemas for request/response shapes are defined once in this shared package and imported by both the Express route handlers (Document 06) and the React Hook Form resolvers. This is not a new architectural layer — it's the mechanism that makes Document 03 §5.1's "contract tests" actually enforceable, since frontend and backend are now provably using the same validation logic rather than two hand-maintained copies that a contract test can only check after the fact.

---

## 8. Routing

Route structure mirrors Document 02's 12 dashboard sections directly — one top-level route per section (Dashboard, Content Library, Publishing Queue, Publishing History, Templates, Platform Management, AI Prompt Management, Logs, Scheduler, Settings), with Platform Health and System Health integrated into the Dashboard route rather than given separate routes (they're summary widgets, not independently navigable workflows, per Document 02 §4.1/§4.11's framing as dashboard components).

Content Library and Publishing Queue support a detail view as a nested route (`/content/:id`) rather than a modal, so a specific item's state is directly linkable/bookmarkable — useful for an owner debugging a specific failed post from a log correlation ID (Document 05 §5.8).

---

## 9. Animation Guidelines (Resolves FO-4 — Missing From Every Prior Document)

Framer Motion is in the tech stack with no usage guidance anywhere in Documents 01–06. Left unaddressed, this is exactly how a tool meant for fast operational decisions accumulates decorative animation that slows perceived responsiveness. Explicit boundary:

| Use Framer Motion for | Do not use Framer Motion for |
|---|---|
| State transition feedback (a status badge changing color/icon after a confirmed action) | Page transitions/route changes — these should be instant, this is an operational tool, not a marketing site |
| List item enter/exit (an item leaving the Pending Approval list after approval) — helps the owner visually track "that's the one I just acted on" | Loading skeletons — use static skeleton states, not animated shimmer, to avoid implying activity that isn't meaningfully informative |
| Toast/alert notifications appearing | Decorative hover effects on data-dense tables (Content Library, Publishing History) — motion here reduces scanability, not enhances it |

**Principle:** animation is used only where it communicates a state change the owner needs to notice, never as ambient polish on a tool whose primary job is fast, accurate information delivery.

---

## 10. Design System Usage (shadcn/ui)

shadcn/ui components are used as-is for all standard controls (buttons, inputs, dialogs, tables) rather than custom-built equivalents — consistent with Document 03's "don't build what doesn't need building" implicit philosophy. Custom components are built only for genuinely domain-specific UI: the content-item state badge, the pipeline stage timeline (Document 05 §5.8's `ContentStateEvent` visualization), and the platform health strip (Document 02 §4.1).

---

## 11. Error, Loading, and Empty State Handling

| State | Handling |
|---|---|
| API errors | Mapped from Document 06 §5.1's error envelope to human-readable messages via a small, centralized error-code-to-message lookup — not ad hoc `catch` blocks per component, so a backend error code's user-facing wording is defined once |
| `409 Conflict` on state transitions | Surfaced as a specific "this item's state changed since you loaded it — refresh to see current status" message, not a generic error — this is a real, expected case (Document 06 OQ-14's race condition) and deserves a real explanation, not a generic failure toast |
| Loading states | Static skeleton loaders on initial list/detail load; inline spinners on action buttons during in-flight requests (disabled state prevents double-submission, complementing but not replacing the backend's idempotency-key protection from Document 06 §5.4) |
| Empty states | Every list view (Content Library, Publishing Queue, History, Templates, Platform Accounts) has a designed empty state, not a blank table — directly required by Document 02 §14's "must work correctly with zero content items and zero platform connections" |

---

## 12. Frontend Testing Strategy

Extends Document 03 §5.1's testing requirements to frontend specifics:

| Test Type | Scope |
|---|---|
| Unit tests (Vitest) | Zod schema validation logic, state-to-available-actions lookup (§6), formatting/utility functions |
| Component tests (Vitest + Testing Library) | Feature components in isolation with mocked TanStack Query responses — particularly the state-transition action buttons, verifying they call the correct endpoint and handle both success and `409` responses correctly |
| E2E (Playwright, P1 per Document 03 §5.1) | Full flows once UI stabilizes: generate → approve → publish → verify, run against sandbox platform accounts |

---

## 13. Architecture Decisions

| ID | Decision | Rationale |
|---|---|---|
| FE-AD-1 | Feature-based component organization, not type-based | Mirrors Document 02's actual product structure; keeps each dashboard section's logic co-located |
| FE-AD-2 | No optimistic updates for state-transition actions; optimistic updates allowed for field edits | Trust (Document 02 PO-1) is more damaged by a reverted optimistic state than helped by saved latency, specifically for actions the server can legitimately reject |
| FE-AD-3 | Shared Zod schema package between frontend and backend | Turns Document 03's contract-testing requirement into something structurally enforced, not just tested for after the fact |
| FE-AD-4 | Frontend never computes state transition legality itself — only displays server-confirmed state and requests transitions | Direct client-side enforcement of Document 06 API-AD-1; the frontend's action-button lookup table is a UX convenience, not a security or correctness boundary |
| FE-AD-5 | Framer Motion restricted to state-change communication, never page transitions or decorative effects | Prevents animation creep in an operational tool where speed and legibility matter more than polish |

---

## 14. Tradeoffs

| Tradeoff | Gain | Cost | Verdict |
|---|---|---|---|
| No optimistic updates for state transitions | No misleading UI reverts | Slightly slower perceived responsiveness on approve/reject actions (a loading spinner instead of instant feedback) | Accept — Document 02 PO-1 (trust) outweighs a few hundred milliseconds of perceived latency |
| Shared schema package (monorepo-lite) vs. independently maintained frontend/backend schemas | Prevents drift, makes contract tests structurally meaningful | Slightly tighter coupling between frontend and backend deploy cycles (a schema change requires both to consume the updated package) | Accept — schema drift causing confusing server-side rejections after apparent client-side success is a worse user experience than the coupling cost |
| Feature-based organization vs. type-based | Mirrors product structure, easier to navigate by feature | Some genuinely shared logic (formatting, small utilities) needs a deliberate "does this belong in shared or in a feature" judgment call rather than an automatic bucket | Accept — this judgment call is cheap; the alternative (type-based scatter) is the actual maintenance cost |

---

## 15. Assumptions

- **FA-1:** The frontend and backend remain in the same repository (Document 07's monorepo-lite schema-sharing decision assumes this); if they're ever split into separate repositories, the shared schema package becomes a published internal package instead — a packaging change, not a schema redesign.
- **FA-2:** Single-owner usage means no need for optimistic UI patterns aimed at masking network latency for a high-frequency, multi-user collaborative context — the tradeoffs in §14 assume a single, patient operator, not a team racing against each other's edits.
- **FA-3:** Playwright E2E tests (§12) run against sandbox platform accounts, consistent with Document 03 TA-2.

---

## 16. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| State-to-available-actions lookup table (§6) drifts out of sync with backend's actual state machine | Low (server remains authoritative per FE-AD-4) but causes confusing `409`s if unaddressed | Recommend this lookup table be generated from or tested against the shared schema package (§7) rather than hand-maintained separately |
| Shared schema package becomes a dumping ground for unrelated shared code over time | Medium | Scope it explicitly to request/response validation schemas only — other shared utilities get their own location, not bundled in |
| Cache invalidation (§5.1) misses an edge case (e.g., an action affects a list view the developer didn't think to invalidate) | Medium | Recommend invalidating by broader query key prefix (e.g., all `content-items` queries) rather than narrowly-scoped keys where the two diverge — slightly less efficient, meaningfully safer against staleness bugs |

---

## 17. Future Expansion

- Feature-based structure scales naturally to new dashboard sections (e.g., a future Analytics section per Document 01) as one more feature folder, no reorganization needed
- Shared schema package extends naturally to support a future public API (Document 06 Future Expansion) — the same schemas that validate internal requests become the documented contract for external consumers
- Optimistic updates could be revisited for state transitions if/when the product moves to a context where perceived latency matters more (e.g., a future higher-volume multi-user SaaS context) — explicitly not a v1 concern per FA-2

---

## 18. Open Questions

| ID | Question | Recommendation |
|---|---|---|
| OQ-16 | Should the shared schema package (§7) also include shared TypeScript types for entities (e.g., `ContentItem`), or only request/response validation schemas? | Recommend entity types too — Zod schemas can derive TypeScript types directly (`z.infer`), so this is close to free once the package exists, and prevents a second form of frontend/backend drift on entity shape |
| OQ-17 | Should list-view cache invalidation (§5.1, Risk in §16) use broad or narrow query key invalidation as the default team convention? | Recommend broad-by-default (per §16 mitigation) until a specific performance problem justifies narrowing a specific case — premature narrow invalidation is a more likely bug source than a real performance cost at this scale |

---

## 19. Industry Best Practices Applied

- **Feature-based (vertical slice) frontend organization** — well-established alternative to type-based organization for products with clear, PRD-defined feature boundaries
- **Server state / client state separation via distinct tools (TanStack Query / Zustand)** — standard modern React practice, avoiding the classic anti-pattern of Redux-style stores holding server data that then goes stale
- **Schema-derived types (`z.infer`) shared across frontend/backend** — standard practice for full-stack TypeScript projects to eliminate manual type duplication
- **Restraint in animation usage tied to information hierarchy** — standard UX practice for operational/admin tooling as distinct from marketing or consumer-facing product design

---

## 20. Production Considerations

- Action buttons (approve/reject/discard/retry/force-publish) must be disabled during their own in-flight request — this is a frontend-level defense-in-depth alongside, not instead of, the backend's idempotency-key protection (Document 06 §5.4)
- The `409` race-condition messaging (§11) should be treated as a first-class, tested UI state, not an edge case afterthought — Document 06 OQ-14 already flagged this race condition exists by design, so the frontend must handle it gracefully, not just technically avoid crashing on it

---

## 21. Recommendations

1. Implement the shared schema package (§7) early — retrofitting shared types after frontend and backend have each grown independent, drifted schemas is significantly more expensive than establishing the shared package before either does.
2. Resolve OQ-16 in favor of including entity types in the shared package — the marginal cost is low and the drift-prevention value compounds over the project's life.
3. This completes the primary technical documentation set (01–07). Recommend a **Non-Functional Requirements & Observability Plan** next, consolidating the NFRs scattered across Documents 02–07 into one operational reference before implementation begins — or, if you're ready to start building, this set is sufficient to begin implementation of Document 04's module boundaries.

---

**End of Document 07 — Frontend Architecture**