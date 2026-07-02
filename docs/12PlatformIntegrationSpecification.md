# Document 12: Platform Integration Specification
## AI-Powered Content Automation Platform

**Document Status:** Approved for Implementation Planning
**Version:** 1.0
**Depends On:** Document 01 (Vision & Scope), Document 04 (System Architecture §5.3, §6), Document 05 (Database Schema)
**Amends:** Document 01 (resolves a genuine contradiction between supported platforms and content-type scope), Document 05 (adds a `video_rendering_required` consideration to `MediaAsset`)
**Owner:** Founding Engineering Team

---

## 1. Executive Summary

This document specifies the concrete integration mechanics — auth, publish, verify, error handling — for each of the three v1 platforms (Facebook Pages, Instagram Business, YouTube Shorts), behind the `PlatformPublisher` interface defined in Document 04 §5.3.

It resolves one real contradiction inherited from Document 01 (YouTube Shorts requires video; v1 content was scoped as static-image-only) and one interface-shape mismatch (Instagram's publish flow is inherently two-phase, not one-shot). Both are architectural, not cosmetic — left unresolved, one makes a listed v1 platform literally impossible to support as specified, and the other means the adapter pattern's promised uniformity ("publishing engine unchanged regardless of platform," Document 01) would have been broken on day one by the very first non-Facebook platform implemented.

---

## 2. Objectives

| # | Objective |
|---|-----------|
| PIO-1 | Resolve the YouTube Shorts / static-content contradiction with a concrete, scoped decision — not a deferred flag |
| PIO-2 | Reconcile Instagram's two-phase publish API with the single-call `PlatformPublisher.publish()` interface without breaking the interface's uniformity promise |
| PIO-3 | Define the exact verification mechanism (Document 04 §6.2) per platform — what "verify" actually checks, concretely |
| PIO-4 | Define per-platform error taxonomy (retryable vs. terminal, Document 03 §5.5) with platform-specific detail, not just the generic classification |
| PIO-5 | Define OAuth scope and token-refresh mechanics per platform, since Document 02 PA-3 deferred automated refresh but still requires accurate expiry tracking |

---

## 3. Scope

Covers: platform-specific auth flows, publish mechanics, verification mechanics, error taxonomy, rate limits, and the resolution of the YouTube Shorts content-format contradiction.

Does not cover: generic adapter pattern architecture (Document 04 §5.3, unchanged here), future platforms (X, LinkedIn, etc. — Document 01 Future Expansion), UI for platform connection (Document 09 §7.2).

---

## 4. Resolving the YouTube Shorts Contradiction (Resolves PIO-1 — The Critical Fix)

### 4.1 The Contradiction, Stated Plainly

Document 01 lists YouTube Shorts as a v1 supported platform. Document 01 also states, as Assumption A2, that v1 content is "primarily text-plus-image (static graphic), not video." YouTube Shorts requires an actual vertical video file — there is no API path to publish a static image as a Short. As written across the document set, this platform cannot be supported with this content scope. This should have been caught in Document 01 itself; it wasn't, and it survived eleven documents unaddressed.

### 4.2 Resolution

**A minimal static-to-video rendering step is added to the Media module (Document 04 §5.2), scoped narrowly — this is not the general video/Reels content-type support that Document 01 correctly deferred to Future Expansion.**

Concretely: when a `MediaAsset` (Document 05 §5.7) targets a `PublishingJob` for the YouTube platform specifically, the Media module renders a short (e.g., 8–15 second, configurable) vertical video from the existing static image — a simple pan/zoom (Ken Burns-style) motion over the branded graphic, optionally with a generic background audio track (silent is acceptable and simpler for v1; see Open Questions). This produces an actual video file suitable for the YouTube Shorts upload API, while the underlying content (the Shayari/quote text, caption, hashtags) remains exactly what the AI Generation module already produces — no change to content generation, only to how it's packaged for this one platform.

**Why not simply drop YouTube Shorts from v1 instead?** Because Document 01 explicitly named it as a launch platform, and the fix is genuinely scoped and cheap — a static-to-video renderer is a well-understood, bounded piece of media processing, not the open-ended "generate original video content" problem Future Expansion correctly defers. Dropping the platform would be avoiding the contradiction rather than resolving it; rendering a minimal video resolves it directly within the spirit of what Document 01 actually asked for.

**Schema amendment (Document 05 §5.7):** `MediaAsset` gains no new required field — the video rendering is a platform-specific transformation applied at publish time from the existing static asset, not a separate stored content type. A `MediaAsset` may have an associated rendered-video variant, tracked as a second `storage_reference`-bearing sub-record if needed at implementation time; this document establishes the requirement, exact schema shape is an implementation detail consistent with Document 05's storage-reference abstraction.

---

## 5. Resolving the Instagram Two-Phase Publish Mismatch (Resolves PIO-2)

### 5.1 The Mismatch

Instagram's Content Publishing API requires: (1) create a media container (upload the image/video, Instagram processes it asynchronously), (2) poll the container's status until it reports ready, (3) publish the container as a separate call. This is fundamentally a multi-step, asynchronous process — not the single `publish(content) → PublishResult` call Document 04 §5.3's interface implies.

### 5.2 Resolution

**The multi-step complexity is fully encapsulated inside the Instagram adapter's implementation of `publish()` — the interface itself does not change.** The Instagram adapter's `publish()` method internally: creates the container, polls for ready status (with its own bounded internal retry/backoff, separate from and nested within the job-level retry Document 04 §6 already provides), then publishes — returning a single `PublishResult` to the orchestration layer only once all three internal steps complete or the internal polling exhausts its bound.

**This preserves Document 01's core promise** ("publishing engine unchanged regardless of platform") exactly as intended — the Publishing module's orchestration code never knows or cares that Instagram took three underlying API calls where Facebook took one. The complexity is real, but it belongs entirely inside the adapter, which is precisely what the adapter pattern (Document 04 AD "ports and adapters") exists to contain.

**Operational consequence:** the `publish` BullMQ job's timeout (Document 04 §6.2, Document 04 §11 stall-timeout risk) must be set generously enough to accommodate Instagram's internal container-processing wait — this is a concrete instance of the stall-timeout tuning Document 04 §13 already flagged as needing real measurement rather than a guessed value, now with a specific, known cause.

---

## 6. Per-Platform Integration Detail

### 6.1 Facebook Pages

| Aspect | Detail |
|---|---|
| Auth | OAuth via Meta Graph API; requires a long-lived Page access token, obtained via the standard Facebook Login for Business flow scoped to `pages_manage_posts`, `pages_read_engagement` (least-privilege, per Document 03 §5.3) |
| Publish | Single call: create a Page post (image + caption) — the simplest of the three platforms, genuinely one-shot |
| Verify | `GET` the created post by its returned ID, confirm it's retrievable and not flagged/removed |
| Rate limits | Governed by Meta's Graph API rate limiting (app-level and Page-level) — Document 03 §5.4's application-level rate cap must be configured below Meta's actual limit, not assumed equal to it, to leave headroom |
| Token lifecycle | Long-lived Page tokens are effectively non-expiring under normal conditions but can be invalidated by password changes or permission revocation — `PlatformAccount.token_expires_at` (Document 05 §5.2) should reflect a conservative re-verification interval, not "never," since "effectively non-expiring" is not the same guarantee as "will never fail" |

### 6.2 Instagram Business

| Aspect | Detail |
|---|---|
| Auth | Same Meta Graph API OAuth flow as Facebook (Instagram Business accounts are managed through a linked Facebook Page) — `instagram_content_publish` scope added |
| Publish | Two-phase, per §5.2 |
| Verify | `GET` the published media object by ID once the container-publish step (§5.2) returns success — confirms the post is live and publicly retrievable, distinct from the container-ready check that already happened inside `publish()` itself |
| Rate limits | Instagram enforces a daily content-publishing limit per account (a hard cap distinct from general API rate limiting) — this must be tracked and respected explicitly, since exceeding it is a platform policy violation risk, not just a technical rate-limit error |
| Token lifecycle | Same underlying token as the linked Facebook Page (§6.1) — connection status for Instagram should be shown as dependent on the Facebook Page connection remaining valid, a real coupling the dashboard (Document 09 §6.6) should surface, not hide |

### 6.3 YouTube Shorts

| Aspect | Detail |
|---|---|
| Auth | Google OAuth 2.0, scoped to `youtube.upload` — a genuinely separate auth provider and flow from the Meta-based platforms above, not just a different token |
| Publish | Resumable upload API (video file, per §4.2's rendered video) plus a separate metadata call (title/description built from the caption/hashtags) — also effectively multi-step, following the same encapsulation principle as §5.2: fully contained inside the YouTube adapter |
| Verify | `GET` the video's processing status via the YouTube Data API — YouTube videos go through their own processing pipeline after upload before being publicly playable, meaning verification here must, like Instagram, tolerate a real "still processing" intermediate state distinct from both success and failure (Document 04 §6.2's `unknown` outcome, Document 05 §5.10, applies directly) |
| Rate limits | YouTube Data API uses a daily quota-unit system (not simple request counts) — upload operations consume significantly more quota per call than reads; Document 03 §5.4's rate limiting must account for quota *cost*, not just call *count*, specifically for this platform |
| Token lifecycle | Google OAuth refresh tokens are used for renewal — genuinely different expiry/refresh mechanics from the Meta long-lived token model (§6.1), reinforcing that Document 02 PA-3's "manual re-auth" assumption may need revisiting sooner for YouTube specifically, since Google's refresh tokens can be invalidated by inactivity or security events more readily than Meta's model |

---

## 7. Error Taxonomy (Extends Document 03 §5.5 With Platform Specifics)

| Category | Facebook/Instagram Example | YouTube Example | Classification |
|---|---|---|---|
| Auth failure | Token invalidated/revoked | Refresh token expired/revoked | Terminal — surfaces as `PlatformAccount.status: error`, requires owner re-auth (Document 09 §7.2) |
| Rate/quota exceeded | Graph API rate limit hit | Daily quota exhausted | Retryable, but with a much longer backoff than a transient error — retrying immediately against an exhausted daily quota is pointless until the quota window resets |
| Content policy rejection | Post rejected for policy violation | Video rejected/flagged | Terminal — must **not** auto-retry; this is a case where the moderation architecture (Document 11 §6) failing to catch something before publish is a real, actionable signal, not just a publish-layer error to swallow and retry |
| Transient network/5xx | Standard transient failure | Standard transient failure | Retryable per Document 03 §5.5's standard backoff |
| Processing/verification pending | N/A (Facebook is synchronous) | Video still processing (§6.3) | `unknown` outcome (Document 05 §5.10) — re-check on the next verification attempt, not immediately reclassified as failure |

---

## 8. Architecture Decisions

| ID | Decision | Rationale |
|---|---|---|
| PI-AD-1 | Static-to-video rendering added as a scoped Media module capability for YouTube specifically | Resolves the only way Document 01's stated platform list and content-type scope can both be true simultaneously, without expanding scope into full video content generation |
| PI-AD-2 | Instagram's and YouTube's multi-step publish processes are fully encapsulated inside their respective adapters | Preserves the adapter pattern's core promise; the orchestration layer's simplicity is non-negotiable regardless of how complex any individual platform's real API is |
| PI-AD-3 | Content-policy rejections are always terminal, never auto-retried | Retrying a policy rejection wastes cost/quota and risks a platform trust/standing penalty for repeated rejected submissions — a fundamentally different risk profile than a transient network error |
| PI-AD-4 | Instagram connection status is shown as dependent on its linked Facebook Page | Reflects the real underlying coupling rather than presenting two platforms as independently reliable when one's failure mode is actually shared |

---

## 9. Tradeoffs

| Tradeoff | Gain | Cost | Verdict |
|---|---|---|---|
| Minimal Ken-Burns-style video rendering vs. dropping YouTube from v1 | Keeps Document 01's stated platform commitment | Adds a real, if small, media-processing capability to the Media module earlier than "true" video content types were planned | Accept — the alternative is silently breaking a stated v1 requirement, which is worse than a small scope addition to fulfill it correctly |
| Encapsulating multi-step publish logic inside adapters vs. changing the `PlatformPublisher` interface to natively support multi-step flows | Zero disruption to the orchestration layer and every other adapter (Facebook) that doesn't need it | Each multi-step adapter carries its own internal state machine for the steps, slightly more complex individually | Accept — pushing complexity to exactly the platforms that have it, rather than forcing every adapter to model steps it doesn't need, is the correct application of the adapter pattern |
| Terminal-only handling of content policy rejections (no auto-retry) | Avoids repeated rejected submissions and quota waste | A borderline rejection that might have succeeded on a slightly modified resubmission requires manual intervention rather than automatic recovery | Accept — automatic resubmission of policy-rejected content without human judgment is a bigger risk than requiring a manual look |

---

## 10. Assumptions

- **PIA-1:** Silent background audio (or no audio) is acceptable for the YouTube Shorts video rendering (§4.2) in v1 — adding music/audio selection is a real future enhancement, not a launch blocker, since the core requirement is a valid video format, not audio production quality.
- **PIA-2:** The owner's YouTube channel is already eligible for Shorts uploads (channel verification, if required by YouTube's current policies, is a prerequisite handled during onboarding's platform-connection step, Document 09 §7.2) — not something this architecture can resolve on the owner's behalf.
- **PIA-3:** Instagram's daily publishing limit (§6.2) is well above v1's actual publishing volume (Document 01 A4) — this is a safety consideration to track, not an expected operational constraint at launch.

---

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| YouTube's video processing time (§6.3) is unpredictable, potentially exceeding a reasonably-configured verify-delay window | Medium | Verification must support multiple `unknown`-outcome re-checks over an extended window (not just one retry), consistent with Document 04 §6.2's design, tuned specifically for YouTube's longer typical processing time versus Facebook/Instagram |
| Static-to-video rendering (§4.2) adds real processing time/cost to the Media module stage for YouTube-targeted content specifically | Low-Medium | Should be measured during implementation and factored into the media-generation stall-timeout tuning already flagged as an open item in Document 04 §13 |
| Instagram/Facebook shared-token coupling (§6.2) means a Facebook-side credential problem silently breaks Instagram publishing too | Medium | Directly addressed by PI-AD-4's dashboard visibility decision — the coupling must be visible, not discovered only when a publish unexpectedly fails |

---

## 12. Future Expansion

- The static-to-video renderer (§4.2) is a natural foundation for full Reels/video content type support (Document 01 Future Expansion) — the rendering pipeline already exists, future work extends it from a fixed pan/zoom template to genuinely varied video content
- Additional platforms (X, LinkedIn, Pinterest, Threads, Telegram, WhatsApp Channels — Document 01 Future Expansion) each get their own subsection in a future revision of this document, following the same per-platform detail structure established here
- Webhook-based verification (Document 06 Future Expansion) would most benefit YouTube specifically, given its comparatively long and variable processing time (§6.3) — flagged here as the platform where the future optimization has the clearest payoff

---

## 13. Open Questions

| ID | Question | Recommendation |
|---|---|---|
| OQ-26 | Should the YouTube Shorts video rendering (§4.2) include background audio by default, given music can meaningfully affect Shorts engagement/algorithm treatment? | Recommend silent for v1 (per PIA-1) — audio licensing/selection is a real scope addition better deferred until the core rendering pipeline is proven, consistent with this document's principle of a *minimal* scoped fix, not a feature expansion disguised as a bug fix |
| OQ-27 | Should Instagram's daily publish limit (§6.2) be tracked proactively in the database (a counter, checked before attempting publish) or discovered reactively via API error responses? | Recommend proactive tracking — reactively discovering a limit via a failed publish attempt wastes a job cycle and delays the owner's content by a full retry cycle for something that was actually predictable in advance |

---

## 14. Industry Best Practices Applied

- **Encapsulating multi-step external API flows entirely within the adapter boundary** — standard integration-architecture practice, directly reinforcing Document 04's ports-and-adapters decision under real-world API complexity rather than an idealized single-call assumption
- **Quota-cost-aware rate limiting (YouTube) rather than naive request-count limiting** — necessary correctness detail for any platform using a weighted quota system, frequently missed when rate limiting is designed generically
- **Never auto-retrying content policy rejections** — standard practice for maintaining platform trust/standing, distinct from technical error retry logic

---

## 15. Production Considerations

- The YouTube Shorts video-rendering step (§4.2) should be included in the manual QA dry-run checklist (Document 03 §5.1) specifically — it's new processing logic that didn't exist before this document, and deserves the same pre-launch verification rigor as the rest of the pipeline
- Instagram/Facebook token coupling (§6.2, PI-AD-4) should be tested explicitly: disconnecting the Facebook Page and confirming Instagram's status correctly reflects the dependency, rather than showing a misleadingly independent "connected" state

---

## 16. Recommendations

1. Treat §4 (the YouTube Shorts contradiction resolution) as a required amendment to Document 01, not just a footnote in this document — Document 01 is the document most likely to be read first by anyone new to this project, and it currently states something that isn't actually true as specified.
2. Resolve OQ-27 in favor of proactive Instagram publish-limit tracking — cheap to implement, meaningfully better owner experience than reactive failure discovery.
3. With this document, every platform named in Document 01's v1 scope now has a concrete, implementable integration path, including the one that previously didn't. Recommend the Cross-Document Consistency Audit (raised twice now) is genuinely due before further documents are produced — Documents 10, 11, and 12 have each amended earlier documents, and none of those amendments have yet been reconciled back into their source documents.

---

**End of Document 12 — Platform Integration Specification**