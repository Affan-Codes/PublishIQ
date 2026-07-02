# Document 13: Security Architecture
## AI-Powered Content Automation Platform

**Document Status:** Approved for Implementation Planning
**Version:** 1.0
**Depends On:** Document 03 (TRS §5.3), Document 05 (Database Schema), Document 06 (API Specification)
**Amends:** Document 06 (adds CSRF protection, login rate limiting, OAuth state validation — none previously specified), Document 03/05 (defines a concrete key management mechanism where only a principle previously existed)
**Owner:** Founding Engineering Team

---

## 1. Executive Summary

Document 03 established security *principles* (encrypt at rest, least privilege, TLS, dependency scanning). This document establishes the *mechanisms* that make those principles real, and closes two gaps that survived twelve documents unaddressed: **the entire state-mutating API surface has no CSRF protection**, despite using session-cookie authentication that is specifically vulnerable to it, and **encrypted credentials are protected by a key with no defined management or rotation strategy**, despite being the thing standing between an attacker and every connected platform account and AI provider key the system holds.

For a single-user system, the stakes of a security failure here are not abstract — a compromised session or a leaked encryption key doesn't just expose data, it hands an attacker the ability to publish, as the owner, to real branded social accounts. This document is written with that specific consequence in mind throughout.

---

## 2. Objectives

| # | Objective |
|---|-----------|
| SO-1 | Close the CSRF gap on every state-mutating endpoint defined in Document 06 |
| SO-2 | Define a concrete encryption key management mechanism, not just the principle that one should exist |
| SO-3 | Add brute-force protection to the single login endpoint, given a compromised login is a full system compromise for this product |
| SO-4 | Secure the OAuth connection flows (Document 06 §6.5) against flow hijacking, not just credential storage after the fact |
| SO-5 | Establish a minimal security-relevant audit trail, distinct from the pipeline's `ContentStateEvent` log, for account-level security events |

---

## 3. Scope

Covers: CSRF protection, session security specifics, encryption key management, login brute-force protection, OAuth flow security, input validation/injection posture, security audit logging.

Does not cover: general application security principles already established in Document 03 §5.3 (restated only where a mechanism needs to be layered on top), infrastructure-level network security (Document 03 §5.2's deployment target, unchanged here).

---

## 4. CSRF Protection (Resolves SO-1 — The Critical Fix)

### 4.1 The Gap, Stated Plainly

Document 06 API-AD-3 chose session-cookie authentication specifically because it fits a first-party frontend well. What that decision requires — CSRF protection — was never specified anywhere in Document 06. Browsers automatically attach cookies to cross-site requests; without a mitigation, a malicious page the owner happens to have open in another tab could trigger `POST /api/v1/content-items/{id}/approve` or `POST /api/v1/publishing-jobs/{id}/force-publish` and the browser would dutifully attach valid session credentials. **Every state-transition endpoint Document 06 §6.1.1 designed specifically to prevent illegitimate state changes is exposed to exactly that, via a different attack surface entirely.**

### 4.2 Resolution

Two complementary mechanisms, layered (defense in depth, not either/or):

| Mechanism | Application |
|---|---|
| `SameSite=Strict` on the session cookie | Prevents the browser from attaching the cookie to cross-site requests at all in the majority of cases — the first, cheapest layer |
| Double-submit CSRF token | On session creation (login), a CSRF token is issued and stored both in a readable cookie and expected back as a request header on every state-mutating request (`POST`/`PATCH`/`DELETE`). The frontend reads the cookie value and attaches it as a header (Document 07's TanStack Query mutation layer is the natural place to attach this automatically, once per app load) | 

**Why both, given `SameSite=Strict` alone might seem sufficient?** Because `SameSite` behavior has known edge cases (top-level navigation exceptions, older browser support gaps) that a security-by-default posture (Document 03's own stated principle) shouldn't rely on as the sole control for a system whose compromise consequence is this severe.

**This is a required amendment to Document 06** — the CSRF token issuance/validation belongs in that document's auth section (§4) and every write endpoint's contract, not left living only here.

---

## 5. Encryption Key Management (Resolves SO-2)

### 5.1 The Gap

Document 03 §5.3 and Document 05 §16 both state credentials are "encrypted at rest... with the key stored outside the database" — correctly identifying the *principle* (never co-locate a key with the data it protects) but never specifying *where* the key actually lives, *how* it's used, or whether it's ever rotated.

### 5.2 Resolution

**Envelope encryption using the hosting platform's native secret manager** (already required for general secrets injection per Document 03 §5.2/TR-8) as the key's storage location — no new infrastructure component, consistent with Document 03's minimal-infra-for-v1 philosophy:

- A single **data encryption key (DEK)** is generated at deployment setup and stored in the platform secret manager (not as a plain environment variable in application config — most managed secret stores support access-controlled retrieval that a bare env var does not).
- The DEK encrypts `PlatformAccount.encrypted_credentials` and `AIProviderConfig.encrypted_api_key` (Document 05 §5.2, §5.11) at the application layer before values ever reach Postgres — consistent with Document 03's existing "application-level encryption, not just column encryption" requirement, now with a concrete key source.
- **Rotation:** the DEK is rotatable — on rotation, the application re-encrypts all existing encrypted fields with the new key in a single migration-style operation, not a gradual re-encryption-on-next-write approach (which would leave a mix of old/new-key-encrypted data indefinitely, complicating both security and debugging). Rotation frequency is an operational decision (Document 03's Settings-driven retention model is a reasonable place to configure a reminder, not an automated forced rotation — automatic rotation of a key that decrypts live platform credentials without a tested procedure is a higher operational risk than a manual, deliberate rotation).

---

## 6. Login Brute-Force Protection (Resolves SO-3)

Document 06 §4 defined the login endpoint's existence but not its resilience. Given a compromised login is total system compromise (every connected platform, every AI provider key, full publishing control) for this single-user product, this deserves real protection, not the level of casual rate limiting appropriate for a low-stakes endpoint:

| Control | Detail |
|---|---|
| Rate limiting | Login attempts capped per IP and per account (email) independently — e.g., 5 attempts per 15 minutes per IP, with a longer cooldown after repeated failures specifically against the single known account |
| Lockout signaling | After repeated failures, respond identically whether the account exists or not, and with generic timing (avoid revealing account existence via response-time or message differences) — standard practice, directly relevant here since there is exactly one account to enumerate against |
| Alerting | Repeated failed login attempts trigger the same owner-facing alert channel Document 03 §5.6 already established for pipeline failures (email) — a login attack in progress is at least as urgent as a pipeline failure |

---

## 7. OAuth Flow Security (Resolves SO-4)

Document 06 §6.5 defined the OAuth connect/callback endpoints functionally but not their security posture. The OAuth `state` parameter (a standard part of the OAuth 2.0 spec, not an optional extra) must be generated per-flow-attempt, stored server-side against the session initiating the connection, and validated on callback — preventing an attacker from tricking the owner into completing an OAuth flow that gets bound to the attacker's own platform account instead of the owner's (a real, known OAuth flow hijacking pattern, not a theoretical one). This was implicitly assumed but never explicitly required anywhere in Document 06 or Document 12.

---

## 8. Input Validation & Injection Posture

Largely inherited correctly from existing decisions, restated here for completeness rather than left implicit:

| Vector | Posture |
|---|---|
| SQL injection | Mitigated structurally by Prisma's parameterized queries (Document 03 TR-3) — no raw SQL string concatenation permitted anywhere in the codebase, a rule worth stating explicitly rather than assuming Prisma alone guarantees it if raw query escape hatches are ever used |
| XSS | React's default JSX escaping handles this for all rendered content by default — **explicit rule: `dangerouslySetInnerHTML` is never used to render AI-generated content** (captions, Shayari text, any model output), since that content is the one input source in this entire system that isn't owner-authored and therefore warrants the least trust, not the most |
| Prompt injection (AI-specific, not previously addressed anywhere) | User-supplied dynamic variables (Document 11 §4, e.g., a festival name) are never concatenated into prompts without being clearly delineated from system instructions — while prompt injection can't be fully eliminated, treating dynamic inputs as data rather than instructions in the prompt structure reduces the surface, and moderation (Document 11 §6) remains the actual safety net regardless |

---

## 9. Security Audit Trail (Resolves SO-5)

Distinct from `ContentStateEvent` (Document 05 §5.8, pipeline events) and external debug logs (Document 03 §5.6, verbose technical detail): a lightweight `SecurityEvent` table records account-security-relevant actions specifically — login success/failure, password change, platform connect/disconnect, settings changes to security-relevant values (approval gate toggle, AI cost ceilings), and CSRF/session validation failures. Even for a single-user system, this is what lets the owner (or the owner investigating a suspected compromise) answer "was my account accessed or changed by someone else" — a question `ContentStateEvent` and debug logs were never designed to answer.

---

## 10. Architecture Decisions

| ID | Decision | Rationale |
|---|---|---|
| SEC-AD-1 | Double-submit CSRF token + `SameSite=Strict`, layered | Closes the most consequential gap in the entire document set — every carefully-designed state-transition safeguard in Document 06 was moot without this |
| SEC-AD-2 | Platform-native secret manager holds the DEK; application-layer envelope encryption for credential fields | Gives Document 03/05's stated principle an actual mechanism, using infrastructure already required rather than adding a new component |
| SEC-AD-3 | Full re-encryption on key rotation, not gradual re-encryption-on-write | Avoids an indefinite mixed-key state that's harder to reason about and secure than a clean, deliberate rotation event |
| SEC-AD-4 | Separate `SecurityEvent` audit table, distinct from pipeline and debug logs | Security-relevant questions ("was I compromised") need a purpose-built, reliably-queryable answer, not a search through logs designed for a different purpose |
| SEC-AD-5 | OAuth `state` parameter validated server-side per flow attempt | Standard OAuth security requirement, closes a flow-hijacking vector Document 06/12 both left implicit |

---

## 11. Tradeoffs

| Tradeoff | Gain | Cost | Verdict |
|---|---|---|---|
| Double-submit CSRF token vs. relying on `SameSite=Strict` alone | Defense in depth against a genuinely high-consequence attack surface | Slightly more implementation work (token issuance, header attachment on every mutation) | Accept — the consequence of getting this wrong (unauthorized publish/approve actions) is severe enough to warrant layered protection, not the minimum viable one |
| Full re-encryption on key rotation vs. gradual re-encryption | Clean, auditable rotation with no mixed-key ambiguity | A rotation event requires a coordinated operation rather than being "free" over time | Accept — for the relatively small number of encrypted fields at this system's scale, a full re-encryption is fast and far easier to reason about securely |
| Login rate limiting keyed by both IP and account vs. IP-only | Protects against both distributed attempts and single-source brute force | Slightly more state to track (per-account attempt counters in addition to per-IP) | Accept — for a single-account system, per-account tracking is cheap and directly relevant given there's only one account to protect |

---

## 12. Assumptions

- **SA-1:** The hosting platform's secret manager (Document 03 §5.2) supports both storage and access-controlled retrieval suitable for holding the DEK — true of essentially all major managed hosting/secret-manager offerings, but should be confirmed against the specific platform chosen at implementation time.
- **SA-2:** A single owner account means CSRF and brute-force protections don't need to account for multi-user contention (e.g., legitimate concurrent logins from different locations) — revisit when/if multi-user SaaS is built (Document 01 Future Expansion).
- **SA-3:** MFA is out of scope for v1 (see Open Questions OQ-28) — single-factor auth is treated as an accepted risk for now, compensated for by SO-3's brute-force protection, not eliminated by it.

---

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| DEK compromise (e.g., secret manager itself breached) | Critical — all encrypted credentials exposed | This is the residual risk envelope encryption cannot eliminate, only reduce; recommend the secret manager's own access logging/alerting be treated as part of this system's security perimeter, not a separate concern |
| CSRF token implementation done incorrectly (e.g., token not actually validated server-side, just present) | High — silently reintroduces the exact vulnerability §4 exists to close | Recommend an explicit integration test asserting a request with a missing/invalid CSRF token is rejected on every state-mutating endpoint — the same "test the rejection path, not just the happy path" principle Document 06 §14 already established for illegal state transitions |
| `SecurityEvent` table (§9) never gets reviewed by the owner in practice | Medium — a good audit trail nobody looks at provides false confidence | Recommend surfacing recent `SecurityEvent` entries in the Settings screen (Document 09 §6.10) rather than only in Logs (§6.8), so it's genuinely visible, not just technically present |

---

## 14. Future Expansion

- Multi-factor authentication (OQ-28) becomes more clearly warranted once the system moves toward multi-user SaaS (Document 01 Future Expansion), where account compromise risk multiplies across users
- `SecurityEvent` audit trail extends naturally to per-user attribution once multi-tenancy is real (Document 05 §4's `owner_id` pattern already supports this)
- Key rotation (§5.2) could move from manual/deliberate to a scheduled, tested automatic process once the operation has been performed manually enough times to trust automating it

---

## 15. Open Questions

| ID | Question | Recommendation |
|---|---|---|
| OQ-28 | Should MFA be added to v1 login, given the severity of what a compromised login exposes? | Recommend deferring to a fast-follow rather than a launch blocker — SO-3's brute-force protection plus a strong password requirement meaningfully reduces the most common attack path; MFA is a genuine improvement but shouldn't block launch for a single, careful owner, especially given Document 01's stated preference for shipping v1 functionality first |
| OQ-29 | How often should the DEK (§5.2) actually be rotated in practice? | Recommend no fixed schedule for v1 — trigger rotation on suspected compromise or personnel/access changes (not applicable for a single owner, but worth stating as the actual trigger condition) rather than an arbitrary calendar cadence that adds operational overhead without a clear corresponding security benefit at this scale |

---

## 16. Industry Best Practices Applied

- **Double-submit CSRF tokens alongside `SameSite` cookies** — standard defense-in-depth practice for session-cookie-authenticated applications, specifically recommended over relying on either mechanism alone
- **Envelope encryption with externally-managed keys** — standard practice for protecting data-at-rest encryption keys, distinct from and more robust than a bare application-config secret
- **OAuth `state` parameter validation** — a mandatory part of the OAuth 2.0 specification itself, not an optional hardening measure
- **Generic failure responses for authentication** (no account-existence leakage, uniform timing) — standard practice against enumeration and timing-based attacks

---

## 17. Production Considerations

- CSRF token and session cookie configuration (§4) must be verified end-to-end in a production-like environment before launch — cookie `SameSite`/`Secure` flag behavior can differ across local development and production TLS configurations, and a control that silently doesn't work in production is worse than no control, since it provides false confidence
- The DEK rotation procedure (§5.2) should be documented and, ideally, dry-run tested at least once before it's ever needed for a real incident — a rotation procedure that's only ever theoretical is a real operational risk the first time it's actually needed under pressure

---

## 18. Recommendations

1. Treat §4 (CSRF protection) as a required amendment to Document 06, implemented before any state-mutating endpoint ships — this is the single highest-severity gap found across the entire thirteen-document set to date, precisely because it silently undermines a control (Document 06's action-endpoint state machine) that was built carefully and correctly, just without this complementary piece.
2. Implement the DEK/secret-manager mechanism (§5) before any real platform credentials are ever stored — retrofitting key management onto already-encrypted-with-a-weaker-approach data is a real migration, not a config change.
3. This is a strong candidate to be the last new document before the Cross-Document Consistency Audit — between Documents 10, 11, 12, and this one, there are now four separate sets of amendments to Documents 01, 03, 04, 05, and 06 that exist only in their originating documents. That reconciliation is no longer optional groundwork; it's necessary to have one coherent spec at all.

---

**End of Document 13 — Security Architecture**