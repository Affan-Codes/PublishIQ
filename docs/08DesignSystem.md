# Document 08: Design System
## AI-Powered Content Automation Platform — Dashboard UI

**Document Status:** Approved for Implementation Planning
**Version:** 1.0
**Depends On:** Document 02 (PRD), Document 07 (Frontend Architecture)
**Owner:** Founding Engineering Team

---

## 1. Executive Summary

This document defines the visual design system for the **dashboard application itself** — color, typography, spacing, motion, iconography, and voice — that shadcn/ui components and custom components (Document 07 §10) are built on top of.

**Critical disambiguation, stated once here and binding for every future document:** this is not the same thing as the "Templates" resource defined in Document 02 §4.5 and Document 05 §5.5, which are branded visual templates used to generate the platform's *social media content* (Shayari/quote graphics). This document governs the *operator's tool* — the control center a single owner uses to run the pipeline. Where the two could be confused, this document refers to the dashboard's own system as the "UI Design System" and the other as "Content Templates," never just "templates," in any future document that touches both.

The dashboard's design personality is deliberately **not** the poetic, ornate aesthetic of the Shayari content it manages. It's an operational tool — its job is fast, accurate, trustworthy information delivery, the same job described in Document 07 §9's animation restraint. The one place the product's cultural context earns a real design decision, rather than decoration, is described in §5 and §11.

---

## 2. Objectives

| # | Objective |
|---|-----------|
| DS-O1 | Define a token system (color, type, spacing) specific enough that implementation doesn't default to generic Tailwind/shadcn defaults by omission |
| DS-O2 | Guarantee Hindi (Devanagari) and Urdu (Nastaliq) content renders correctly wherever actual content is previewed — not assumed to "just work" with a UI font |
| DS-O3 | Give the state-machine visualization (Document 05 §5.8, Document 07 §10) a genuine visual identity, since it's the component that most directly embodies the product's core value: transparent, stage-by-stage automation |
| DS-O4 | Meet a real accessibility floor (WCAG 2.1 AA, keyboard focus, reduced motion) as a baseline requirement, not an aspiration |
| DS-O5 | Keep the design system distinct from generic "AI-generated dashboard" defaults, per the same discipline applied to product architecture in prior documents |

---

## 3. Scope

Covers: color palette, typography (including content-preview typography), spacing/layout grid, motion tokens (extending Document 07 §9's rules with actual values), iconography, component theming approach (light/dark), voice and copy guidelines, accessibility baseline.

Does not cover: Content Templates (branded social media graphics — Document 02 §4.5), literal CSS/token code (implementation detail), the animation *rules* themselves (already decided in Document 07 §9 — this document supplies the values those rules are expressed in).

---

## 4. Design Direction Statement

The subject is an unattended automation control center for a single operator managing culturally-specific content (Hindi/Urdu Shayari, motivational quotes) across social platforms. The audience is one person, at a desk, who needs to trust what they're looking at without effort — not a general audience being sold something.

**Rejected defaults:** a warm-cream-and-serif "editorial" look (reads as a content/blog product, misrepresents this as a publishing tool rather than an operations tool); a near-black-with-acid-accent developer-tool look used indiscriminately (generic, doesn't earn its darkness); a broadsheet/newspaper hairline-rule layout (implies a reading experience, this is a control panel).

**Chosen direction: "Ink and Marigold."** A calm, dark-first operational surface (the "ink") with a single warm accent (marigold/saffron) reserved specifically for states that need the operator's attention — approvals pending, warnings, tokens expiring. Marigold is not decorative here: it references the marigold garland's traditional role in South Asian visual culture as a marker of something significant happening *now* — which is exactly what it's used for functionally (attention states), giving the color choice a real reason to exist rather than being an arbitrary accent. Everything else in the interface stays deliberately quiet so that accent actually means something when it appears.

---

## 5. Color System

| Token | Value | Usage |
|---|---|---|
| `ink-950` | #0F1115 | Dark mode base background |
| `ink-900` | #171A20 | Dark mode surface/card background |
| `ink-700` | #2A2E37 | Dark mode borders, dividers |
| `paper-50` | #F7F6F3 | Light mode base background |
| `paper-100` | #EFEDE7 | Light mode surface/card background |
| `paper-300` | #D8D4CB | Light mode borders, dividers |
| `ink-text` / `paper-text` | #E8E6E1 / #1C1D20 | Primary text, per mode |
| `marigold-500` | #E8A33D | **Attention accent only** — pending approval, warnings, expiring tokens (§4). Never used as a generic brand/interactive color. |
| `indigo-500` | #5B5FEF | Primary interactive accent — links, primary buttons, active nav state |
| `signal-success` | #2FB37C | Published/verified/success states |
| `signal-error` | #E5484D | Failed/error states |
| `signal-info` | #4C9FE8 | Informational, non-urgent status |

**Rule enforced across all documents referencing status color:** `marigold-500` is reserved exclusively for attention/pending states (ties directly to Document 02 §4.1 Platform Health warnings and Document 06 approval-gate states) — it must never be reused as a generic accent elsewhere, or it stops meaning anything.

Both light and dark themes are required (Document 02 makes no explicit demand for dark-mode-only), implemented via CSS custom properties per theme, consistent with the artifact/component theming approach already assumed in Document 07.

---

## 6. Typography (Resolves DS-O2 — the Critical Fix)

Two entirely separate typeface roles are required, not one:

| Role | Typeface | Why |
|---|---|---|
| **UI Chrome** | Inter (or equivalent geometric grotesk with full Latin coverage) | Used for all navigation, labels, buttons, tables, dashboard UI text — optimized for interface legibility at small sizes |
| **Content Preview** (**required, not optional**) | Noto Sans Devanagari (Hindi) + Noto Nastaliq Urdu (Urdu), selected per content item's language, falling back to system defaults only if a Noto variant is unavailable | Used **exclusively** for rendering actual generated content — Shayari text, captions — anywhere it's previewed in Content Library, Publishing Queue, or Publishing History detail views. Inter and most UI sans fonts have no Devanagari or Nastaliq glyph coverage; using the UI font here would render the platform's actual product output as unreadable boxes. This is a functional requirement, not a stylistic one. |
| **Utility/Monospace** | JetBrains Mono | Timestamps, correlation IDs (Document 05 §5.8), platform post IDs, log detail — anywhere exact character-for-character precision matters |

**Type scale:** a standard modular scale (e.g., 12/14/16/20/24/32px) is sufficient — this is a data-dense operational tool, not an editorial layout; the type scale's job is consistent hierarchy, not personality. Personality lives in the color system (§5) and the signature component (§7), not in display typography, which would be the wrong place to spend distinctiveness for this specific product.

---

## 7. Signature Element: Pipeline Stage Timeline (Resolves DS-O3)

The one component this product should be visually remembered by is the pipeline stage timeline — the visualization of a content item's journey through `ContentStateEvent` records (Document 05 §5.8), shown in the Content Library detail view (Document 02 §4.2).

**Design intent:** a horizontal or vertical stepper where each stage (Generated → Validated → Pending Approval → Queued → Publishing → Published → Verified) is a node connected by a line; completed stages are solid `indigo-500`, the current stage pulses gently (respecting reduced-motion, per §10), a failed stage renders in `signal-error` with the retry lineage (Document 05 §5.10) visible as sub-steps beneath it rather than hidden behind a click. This is the single component worth this level of specific attention — it's the direct visual proof of the product's core promise (Document 01 O4: "an operator can trust to run unattended") — everything else in the interface should stay quieter than this component, not compete with it.

---

## 8. Spacing & Layout

| Aspect | Decision |
|---|---|
| Base unit | 4px, scale: 4/8/12/16/24/32/48/64 |
| Layout | Fixed collapsible sidebar (nav, Document 07 §8's 10 top-level routes) + main content area, standard for operational dashboards where orientation matters more than novel layout |
| Grid | 12-column responsive grid within the main content area |
| Breakpoints | Desktop-first (primary use case per Document 01 A3 — single operator at a desk); responsive down to tablet is required (P0); full mobile optimization is P2, not a launch blocker — an owner checking status from a phone needs the dashboard to be usable, not needs it to be exceptional |

---

## 9. Iconography

Lucide icon set — chosen for direct compatibility with shadcn/ui (Document 07 §10) and broad, consistent coverage, rather than mixing icon sources. No custom icon set is warranted for a single-user operational tool; that effort is better spent on the signature element (§7).

---

## 10. Motion Tokens (Extends Document 07 §9 With Actual Values)

Document 07 §9 defined *where* motion is allowed. This section supplies the values:

| Token | Value |
|---|---|
| `duration-fast` | 120ms — state badge color/icon changes |
| `duration-base` | 200ms — list item enter/exit, toast appearance |
| `duration-slow` | 320ms — the pipeline timeline's current-stage pulse (§7) |
| Easing | ease-out for entrances, ease-in for exits — standard, not novel, because motion here is functional signaling, not brand expression |
| Reduced motion | All durations above collapse to near-instant (≤16ms, effectively a cut) when `prefers-reduced-motion` is set — non-negotiable per the accessibility floor (§12) |

---

## 11. Voice & Copy Guidelines

Applying the same discipline used throughout this document set to written UI copy, not just visuals:

- **Active voice, consistent verb-to-outcome mapping:** a button that says "Approve" produces a toast that says "Approved" — never "Submitted" or "Done." This directly reinforces the trust objective (Document 02 PO-1) by making the interface's vocabulary predictable.
- **Errors state what happened and what to do, without apologizing or being vague** — this is a direct requirement, not a style suggestion, because Document 07 §11 already established that `409` conflicts and pipeline failures are expected, real states this product must explain clearly, not soften.
- **Empty states are an invitation to act, not a dead end** — e.g., an empty Content Library shows "Nothing generated yet — trigger a run or check the schedule," not a bare "No results."
- **Names things by what the operator controls**, never by internal system terms — "Pause publishing to Instagram," not "Disable Instagram adapter."

---

## 12. Accessibility Baseline (Resolves DS-O4)

| Requirement | Standard |
|---|---|
| Contrast | WCAG 2.1 AA minimum for all text and status-color-on-background combinations — `marigold-500` and `signal-error` on `ink-950`/`paper-50` specifically verified, since warm accent colors on dark backgrounds are a common contrast failure point |
| Keyboard | Every interactive element has a visible focus ring (not suppressed for aesthetic reasons); full dashboard operable via keyboard alone |
| Reduced motion | Enforced per §10 — this is a stated requirement, not a nice-to-have, consistent with Document 07 §9's animation restraint philosophy |
| Screen reader | Status badges and the pipeline timeline (§7) carry proper ARIA labeling — a visual-only status indicator (color alone) is insufficient given `signal-error`/`signal-success` convey meaning that must not depend on color perception alone |

---

## 13. Architecture Decisions

| ID | Decision | Rationale |
|---|---|---|
| DS-AD-1 | Separate content-preview typography from UI chrome typography | Functional requirement — UI fonts don't render Devanagari/Nastaliq; without this, the product's actual content is unreadable in its own dashboard |
| DS-AD-2 | `marigold-500` reserved exclusively for attention/pending states | A single accent color loses all signal value the moment it's reused decoratively elsewhere |
| DS-AD-3 | Pipeline Stage Timeline designated as the one signature component | Concentrates design effort where it reinforces the product's core trust proposition, rather than spreading polish thinly and unmemorably across all 12 dashboard sections |
| DS-AD-4 | Desktop-first, tablet-required, mobile-deferred-to-P2 | Matches actual usage pattern (Document 01 A3) rather than building full responsive parity nobody asked for at v1 |
| DS-AD-5 | Both light and dark themes required, dark as default | Matches operational-tool convention (extended log/status review) while not assuming the owner never works in a bright environment |

---

## 14. Tradeoffs

| Tradeoff | Gain | Cost | Verdict |
|---|---|---|---|
| Maintaining two typeface systems (UI + content preview) vs. one universal font | Correct rendering of actual product content | Slightly more font-loading overhead, two typefaces to keep visually coherent | Accept — the alternative is a broken core feature, not a stylistic compromise |
| Concentrating signature effort on one component (§7) vs. spreading polish across all sections | A genuinely memorable, meaningful piece of UI tied to the product's real value | Other sections stay visually "quieter" by comparison | Accept — per the frontend-design principle of spending boldness in one place; diffuse polish is memorable to no one |
| Desktop-first with mobile deferred | Faster v1, matches real usage | An owner checking from their phone gets a merely-usable, not polished, experience | Accept for v1 — revisit if usage data shows meaningful mobile engagement |

---

## 15. Assumptions

- **DSA-1:** Noto Sans Devanagari and Noto Nastaliq Urdu (or equivalent open-license fonts with full glyph coverage) are acceptable licensing-wise for production use — both are open-source (SIL Open Font License), so this holds.
- **DSA-2:** The owner has no pre-existing brand guidelines this design system must conform to — if one exists, §4–§5's specific direction would need reconciliation, but nothing in Documents 01–07 indicated one exists.
- **DSA-3:** Dark-mode-default (DS-AD-5) is acceptable to the owner; this is a judgment call based on typical operational-tool usage, not a stated requirement anywhere in prior documents.

---

## 16. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Content-preview font requirement (DS-AD-1) gets skipped during implementation because it's "just a font choice" | High — directly breaks content readability | Recommend this be called out explicitly in the Content Library component's implementation ticket, not left implicit in a design system document nobody re-reads mid-build |
| `marigold-500` discipline (DS-AD-2) erodes over time as new features get built by someone unfamiliar with this document | Medium | Recommend enforcing via a linted Tailwind theme config that only exposes `marigold` through an `attention` semantic token name, not a raw color value developers can reach for casually |
| Two-typeface system (§6) causes visual inconsistency if content preview typography bleeds into surrounding UI chrome, or vice versa | Low-Medium | Component boundaries (Document 07 §4) should scope typography at the content-preview component level specifically, not globally |

---

## 17. Future Expansion

- Additional content-preview language support (future content types per Document 01 — Arabic, Bengali, etc.) follows the same DS-AD-1 pattern: identify the correct script-specific typeface before the content type ships, never assume UI fonts cover it
- The signature Pipeline Stage Timeline component (§7) is the natural home for future Analytics visualizations (Document 01 Future Expansion) — same visual language, extended
- A public-facing brand identity (distinct from this operational dashboard's design system) would be a separate future document if the product ever needs marketing/landing-page presence — not to be conflated with this document, same disambiguation principle as §1

---

## 18. Open Questions

| ID | Question | Recommendation |
|---|---|---|
| OQ-18 | Should the marigold "attention" semantic extend to non-visual channels (e.g., the alerting from Document 03 §5.6) for consistency, or is that over-extending a UI color decision into unrelated systems? | Recommend keeping it UI-only — alerting channels (email) have their own conventions; forcing a color metaphor onto email notifications adds complexity without benefit |
| OQ-19 | Is a full Urdu (RTL-aware) layout consideration needed anywhere beyond the content-preview text itself, or is RTL scoped strictly to that rendered content? | Recommend scoping RTL support strictly to the content-preview component (§6) for v1 — the UI chrome itself remains LTR throughout, since the operator-facing interface language is not Urdu; revisit only if the product's operator-facing language requirements change |

---

## 19. Industry Best Practices Applied

- **Named token system over ad hoc values** — standard design system practice, makes DS-AD-2's enforcement rule technically possible
- **Script-appropriate typography selection** — standard internationalization practice, frequently missed specifically in AI-tooling dashboards built by teams whose own UI language doesn't require it, which is exactly why it's called out explicitly here rather than assumed
- **Single signature element with disciplined restraint elsewhere** — directly drawn from established design-systems practice: spend distinctiveness deliberately, not uniformly
- **Reduced-motion and keyboard-accessibility as baseline, not enhancement** — standard modern accessibility practice (WCAG 2.1 AA), not an optional polish pass

---

## 20. Production Considerations

- Font loading for Noto Sans Devanagari / Noto Nastaliq Urdu should be scoped (loaded only when content-preview components mount) rather than globally, to avoid unnecessary load weight on dashboard sections that never render Hindi/Urdu text
- Contrast verification (§12) should be a checked step in the component test suite (Document 07 §12), not a one-time manual check — color tokens can be reused in new contexts later that weren't contrast-checked at introduction

---

## 21. Recommendations

1. Treat DS-AD-1 (content-preview typography) as a launch blocker on the same level as Document 03's testing/deployment requirements — it's the difference between a working product and a broken one for its actual subject matter.
2. Resolve OQ-19 in favor of scoping RTL support to the content-preview component only, unless you have a specific reason to expect the operator-facing UI itself needs Urdu localization.
3. This completes the documentation set most teams would need before implementation begins (01–08). If you want full coverage, the remaining reasonable additions are a consolidated **NFR & Observability Plan** (previously recommended, still outstanding) and a **Platform Integration Design** document detailing the Meta/YouTube-specific adapter mechanics referenced but not detailed in Document 04 §5.3.

---

**End of Document 08 — Design System**