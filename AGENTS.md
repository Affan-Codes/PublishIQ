# AGENTS.md

# AI Agent Instructions

This repository is implemented using a **Documentation First** workflow.

The architecture has already been designed.

Your responsibility is implementation.

Do NOT redesign the architecture.

---

# Repository Structure

```
docs/
backend/
frontend/
```

## docs/

Contains the approved project documentation.

These documents are the source of truth.

Read the relevant documents before implementing any feature.

Priority order:

1. PROJECT_DECISIONS.md
2. 00-glossary.md
3. 01-vision-and-scope.md
4. 02-product-requirements-prd.md
5. 03-technical-requirements.md
6. 04-system-architecture.md
7. 05-database-design.md
8. 06-backend-architecture.md
9. 07-frontend-architecture.md

Higher-priority documents override lower-priority documents.

Never contradict them.

---

# Repository Layout

```
backend/
```

Backend application.

```
frontend/
```

Frontend application.

Never mix frontend and backend code.

---

# General Rules

Always implement production-quality code.

Never leave TODOs.

Never leave placeholders.

Never generate fake implementations.

Never comment out code.

Never duplicate logic.

Never introduce unnecessary abstractions.

Keep changes minimal and focused.

Every completed task should leave the repository in a runnable state.

---

# Before Writing Code

For every task:

1. Read the relevant documentation.
2. Determine affected modules.
3. Create an implementation plan.
4. Implement only the requested scope.

Never redesign the architecture.

---

# Backend Architecture

Must follow:

```
Routes
    ↓
Controllers
    ↓
Services
    ↓
Repositories
    ↓
Database
```

## Controllers

Responsibilities:

- Receive requests
- Validate requests
- Call Services
- Return responses

Must NOT:

- Contain business logic
- Access Prisma
- Access external APIs

---

## Services

Responsibilities:

- Business logic
- Orchestration
- Transactions
- Validation coordination

Must NOT:

- Return HTTP responses
- Access Express request/response objects

---

## Repositories

Responsibilities:

- Database access only

Rules:

- Prisma may only be used here.
- Never place business logic inside repositories.

---

## Workers

Responsibilities:

- Execute asynchronous jobs.

Must NOT:

- Own business rules.

---

## Providers

Responsibilities:

External integrations only.

Examples:

- AI Provider
- Publishing Provider
- Storage Provider

Never place business logic inside providers.

---

## Utilities

Utilities must:

- Be pure functions
- Have no side effects
- Never access databases
- Never call HTTP APIs

---

# Frontend

Use:

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS v4
- shadcn/ui
- React Hook Form
- Zod
- Axios
- Lucide React

Do not introduce another UI framework.

Do not introduce Redux, MobX, Context-based global stores, or another state library unless explicitly required by the documentation.

Use:

React Query

for server state.

Use:

React state

for local UI state.

---

# Forms

Use:

React Hook Form

+

Zod

for every form.

Never build manual form validation.

---

# Validation

Every request:

Validate with Zod.

Every external provider response:

Validate with Zod.

Never trust external data.

---

# API Responses

Success

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Failure

```json
{
  "success": false,
  "error": {
    "code": "",
    "message": "",
    "details": {}
  }
}
```

Maintain this format consistently.

---

# Error Handling

Create typed application errors.

Do not throw generic Error objects for expected application failures.

Centralize error handling.

---

# Logging

Use:

Pino

Never use:

console.log()

except during temporary local debugging.

---

# Database

Use:

Prisma

Rules:

- Only repositories access Prisma.
- Avoid raw SQL.
- Keep migrations clean.
- Never bypass repositories.

---

# Configuration

Never hardcode:

- Secrets
- API keys
- URLs
- Tokens

Use environment variables.

Supported files:

```
.env
.env.local
.env.example
.env.production
```

---

# Dependencies

If a dependency is required:

Install it.

Run the correct npm command.

Update package.json.

Do not ask the user to install packages manually.

Only install dependencies that are actually required.

---

# Refactoring

Do not perform unrelated refactoring.

Do not rename files without reason.

Do not change formatting across unrelated files.

Keep pull requests focused.

---

# Testing

When implementing features:

Add or update tests whenever practical.

Do not break existing tests.

If a task affects no tests, explain why.

---

# Security

Never expose secrets.

Validate all external input.

Sanitize user input where appropriate.

Follow the principle of least privilege.

Never leak stack traces in production responses.

---

# Performance

Avoid premature optimization.

Optimize only when required.

Prefer readable code over clever code.

---

# Documentation

If implementation requires changing architecture:

STOP.

Explain:

- why
- consequences
- alternatives

Do not implement the change until approved.

---

# Completion Checklist

Before considering a task complete, verify:

- Project builds successfully.
- TypeScript compiles.
- Lint passes.
- Tests pass (where applicable).
- Documentation remains consistent.
- No architecture violations.
- No dead code.
- No unused dependencies.
- No duplicated logic.

---

# Implementation Philosophy

Implement incrementally.

One feature at a time.

One vertical slice at a time.

Never attempt to build the entire application in one change.

Small, reviewable, production-quality implementations are always preferred over large, risky changes.