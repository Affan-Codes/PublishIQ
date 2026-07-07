# 06 — Backend Architecture

**Status:** Draft — pending approval
**Version:** 1.0
**Last revised:** 2026-07-04
**Owning document for:** Backend code organization, layer boundaries as actual folders/modules, request lifecycle, worker implementation pattern, configuration loading, error-handling conventions.
**Does not own:** Technology selection (`03-technical-requirements.md`), process/container topology (`04-system-architecture.md`), schema (`05-database-design.md`), frontend code (`07-frontend-architecture.md`).

---

## 1. Folder Structure

```
src/
  controllers/        # HTTP only — parse request, call one Service method, shape response. No business logic.
  services/            # All business logic. The only layer allowed to coordinate multiple repositories/providers.
  repositories/        # Database access only. Every Prisma import lives here and nowhere else.
  workers/             # BullMQ processors. One file per queue (content-pipeline.worker.ts, cleanup.worker.ts, ...).
  providers/
    ai/                # AIProviderAdapter interface + GeminiAdapter
    publishing/        # PublishingAdapter interface + YouTubeAdapter, InstagramAdapter
    storage/           # StorageProvider interface + LocalDiskStorageProvider
  templates/           # React rendering templates (versioned per Template/TemplateVersion, 05-database-design.md 3.4)
  utils/               # Pure functions only — normalization, hashing, date math. No DB, no network, no state.
  middleware/           # auth, error handler, rate limiter, request validation (Zod)
  events/               # EventBus (in-process) + Redis Pub/Sub bridge (04-system-architecture.md, Section 3)
  config/               # env loading, SystemConfiguration cache, FeatureFlag cache
  jobs/                 # BullMQ queue definitions (one per Job Type) — distinct from workers/: this is "how to enqueue," workers/ is "how to process"
  api.ts                # Express app entrypoint (api container)
  worker.ts             # Worker entrypoint (worker container)
```

This maps directly onto `PROJECT_DECISIONS.md` Section 25's Module Ownership table — the folder boundary *is* the enforcement mechanism. A lint rule (`no-restricted-imports`) blocks `services/**` from importing anything under `../repositories/**`'s Prisma client directly except through a Repository's exported functions, and blocks `controllers/**` from importing `services/**/*.repository.ts` at all. This is cheap to set up and catches the single most common violation (a controller reaching into the DB "just this once") at CI time instead of at code review time.

---

## 2. Request Lifecycle

```
HTTP request
  → middleware: auth (session check)
  → middleware: Zod schema validation of body/params/query
  → Controller: extracts validated input, calls exactly one Service method
  → Service: business logic, calls one or more Repositories/Providers, returns a plain result or throws a typed error
  → Controller: maps result → HTTP response (200/201/204) or maps thrown error → HTTP error response
  → middleware: centralized error handler (catches anything a Controller didn't map, logs it, returns a generic 500 — never leaks a stack trace to the client)
```

**Controllers never call a Repository directly**, even for a "trivial" read — if a Controller finds itself wanting to, that's a signal the read belongs behind a Service method (even a thin pass-through one), not an exception to the rule. The rule has no exceptions specifically *because* "just this once" is how layer boundaries erode over an 18-month project.

---

## 3. Worker Implementation Pattern

Each file under `workers/` exports a single processor function registered against its queue:

```ts
// workers/content-pipeline.worker.ts
export const contentPipelineProcessor = async (job: Job<ContentPipelineJobData>) => {
  const svc = new ContentPipelineService(/* injected repositories/providers */);
  await svc.run(job.data.jobId, { onStageComplete: (stage) => job.updateProgress(stage) });
};
```

The **worker file itself contains no business logic** — it is a thin adapter between BullMQ's `Job` object and a Service method, exactly matching Section 25's "Workers: queue/job processing only." `ContentPipelineService.run()` is the actual 13-stage sequential function described in `04-system-architecture.md` Section 2.1, and it is unit-testable without BullMQ or Redis at all — the Worker layer's only job is wiring, which is precisely why Section 32's unit-test coverage target ("state-machine transitions") is achievable without spinning up Redis in CI.

**Dependency injection is manual, not a DI framework.** Services are constructed with plain constructor parameters (`new ContentPipelineService(jobRepo, generatedContentRepo, aiProvider, ...)`), wired once at process startup in `api.ts`/`worker.ts`. A DI container (InversifyJS, NestJS's own) is explicitly rejected — for a codebase this size, a container adds indirection (magic decorators, runtime reflection) without adding a real capability plain constructors don't already give it. This is Section 31's "avoid unnecessary abstractions" applied concretely.

---

## 4. Provider Adapter Contracts

```ts
interface AIProviderAdapter {
  generate(prompt: PromptVersion, variables: Record<string, unknown>): Promise<StructuredAIResponse>;
}

interface PublishingAdapter {
  platform: PlatformName;
  validate(content: GeneratedContent): PlatformLimitViolation[];   // Section 22 — adapter owns its own limits
  publish(content: GeneratedContent, connection: PlatformConnection): Promise<PublishResult>;
}

interface StorageProvider {
  save(buffer: Buffer, path: string): Promise<string>;   // returns a StorageProvider-relative URL/path
  read(path: string): Promise<Buffer>;
}
```

`StructuredAIResponse` is a Zod schema, not a loosely-typed object — `03-technical-requirements.md`'s decision to enforce `PROJECT_DECISIONS.md` Section 5.1's JSON-in/JSON-out contract happens exactly here, at the boundary of `GeminiAdapter.generate()`. If Gemini returns something that fails the schema, `GeminiAdapter` throws a typed `AIResponseSchemaError` — the Content Pipeline Service catches it and records it as a `Generating Content` stage failure (Reason: schema validation failed), never as a silent retry-with-different-parsing-logic.

Adding a second AI Provider or Publishing platform later means adding one new file implementing one of these three interfaces and registering it at startup — no change to any Service, Controller, or Worker.

---

## 5. Configuration Loading

```ts
// config/system-config.cache.ts
class SystemConfigCache {
  private cache = new Map<string, unknown>();
  private lastLoaded = 0;
  private readonly ttlMs = 30_000;

  async get(key: string): Promise<unknown> {
    if (Date.now() - this.lastLoaded > this.ttlMs) await this.reload();
    return this.cache.get(key);
  }
  private async reload() { /* SELECT * FROM SystemConfiguration WHERE workspaceId = ... */ }
}
```

A 30-second TTL cache, not a live subscription — `SystemConfiguration` values (render concurrency, retry limits) change rarely enough that a short poll interval is simpler than building change-notification plumbing for a table nothing time-critical reads on every request. `FeatureFlag` uses the identical pattern in a sibling `feature-flag.cache.ts`. Both caches are read-through: a cache miss triggers a synchronous reload rather than ever serving `undefined` for a key that genuinely exists in the DB.

Environment variables (`03-technical-requirements.md`, Section 5) are loaded once at process start via a single `config/env.ts` that validates them against a Zod schema and fails fast (process exits non-zero) if a required secret is missing — never a runtime `undefined` surfacing three layers deep during a live request.

---

## 6. Error Handling Conventions

- A small hierarchy of typed errors: `ValidationError`, `NotFoundError`, `ConflictError` (e.g., disabling an Asset still referenced by an active Content Profile), `ExternalProviderError` (wraps any AI/publishing/storage failure with the Provider's raw error attached for logging, never exposed to the client).
- Services throw these; the Controller layer's centralized error-mapping middleware converts each type to the appropriate HTTP status (400/404/409/502) — this mapping table lives in exactly one place (`middleware/error-handler.ts`), so a Controller never hand-writes `res.status(400)` itself.
- Inside a Worker, the same typed errors are caught by the Service's own stage-loop (`04-system-architecture.md`, Section 2.1) and turned into the Job's `failureStage`/`failureReason` columns — the identical error taxonomy serves both the HTTP path and the Job pipeline, so there is one way errors are described across the whole backend, not two.

---

## 7. API Versioning Implementation

```ts
// api.ts
app.use('/api/v1', v1Router);
```
`v1Router` mounts every Controller under `/api/v1/...` (`PROJECT_DECISIONS.md` Section 29). A future `/api/v2` is a second router mounted alongside, never a replacement of `v1Router` — this is enforced by convention (there is nothing to "turn off" v1 with) rather than by a feature flag, since the frozen decision is that v1 keeps running indefinitely once v2 ships.

---

## 8. Seed Data

A `prisma/seed.ts` script populates, on first `docker compose up`:
- One `Workspace` row.
- `SystemConfiguration` defaults: `retry_limit.generation = 3`, `retry_limit.duplicate_regeneration = 5`, `retry_limit.publish = 3`, `render_concurrency = 2`, `default_video_duration_seconds = 15`, `log_retention_days = 30` — placeholder defaults, explicitly tunable by the operator afterward (Section 21's whole point), not re-frozen here.
- `FeatureFlag` defaults: all flags `enabled = false` except `enable_ai_provider` and `enable_platform` (nothing else works without those two).
- Seed `ContentType` rows: Shayari, Motivational Quote, Business Quote, Festival Wish, Poetry (`PROJECT_DECISIONS.md` Section 10's examples, verbatim).

---

## 9. Consistency Check

This document assumes every decision in `03-technical-requirements.md` and `04-system-architecture.md`. No Controller in this design ever touches a Repository or a Provider directly; no Service ever imports Prisma directly; no Worker file contains a business rule — the folder structure is the mechanism by which `PROJECT_DECISIONS.md` Section 25 and Section 31 are actually satisfied, not just stated.

**No contradictions with any prior document were introduced.**

**This document remains a draft pending your approval.**
