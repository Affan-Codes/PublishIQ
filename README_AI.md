# PublishIQ - AI Content Generation and Media Rendering Pipeline

PublishIQ is a modern, premium social media management and automation platform designed to orchestrate the generation, verification, and publishing of short-form video and image assets to platforms like Instagram, Facebook, and YouTube Shorts.

## Directory Layout

```
docs/               # Architectural Decisions and System Requirements (Source of truth)
backend/            # Express, Node, BullMQ, Prisma server-side stack
frontend/           # React, TypeScript, Vite client-side dashboard
docker-compose.yml  # Development orchestration setup
docker-compose.prod.yml # Production orchestration setup
```

## Technology Stack Summary

### Backend
- **Framework**: Express.js with TypeScript.
- **ORM**: Prisma connecting to PostgreSQL database.
- **Job Engine**: BullMQ backed by a Redis instance.
- **Image/Video Rendering**: Playwright headless browser screenshots and FFmpeg transcoding pipelines.

### Frontend
- **Framework**: React with TypeScript.
- **Client Bundler**: Vite.
- **Cache Management**: TanStack React Query.
- **State Store**: React context and local states.

## Key Deployment and Security Configurations

### 1. Enforced Password Security (SEC-001)
- The system enforces a **12-character minimum password** length on all user signup/updates.
- Startup fails automatically in `production` environment if `OPERATOR_EMAIL` or `OPERATOR_PASSWORD` are left as the default or are unset.

### 2. Session Cookies Signed (SEC-006)
- Client session cookies are signed using `SESSION_SECRET`.
- This adds tamper-proof cryptographic defense on top of PostgreSQL database session storage.

### 3. Production Deployment (PROD-001 & SEC-004)
- Run production with `docker-compose.prod.yml` and the root `.env`:
  ```bash
  docker compose -f docker-compose.prod.yml --env-file .env up --build -d
  ```
- **Caddy** serves as the thin reverse proxy, automatically terminating SSL and proxying requests internally to the frontend client and the REST API.
- Ports for PostgreSQL and Redis are bound internally only.
- Every service features a `restart: unless-stopped` recovery policy.

## Health Check and Diagnostics (SEC-005)
- Public Liveness: `/api/v1/health` (Returns liveness without credentials).
- Detailed Diagnostics: `/api/v1/health/diagnostics` (Gated to authenticated operators only).
