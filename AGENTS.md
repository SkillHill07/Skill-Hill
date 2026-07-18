# DOX framework — Skill Contest Platform

- DOX is the governing instruction hierarchy for this project.
- Every AI agent must follow DOX instructions across any edit.

## Purpose

This repository holds a skill-based coding contest platform (users pay ₹20 to join, win a prize). The monorepo uses pnpm workspaces + Turborepo with three apps (api, web, admin) and three shared packages.

## Ownership

Root AGENTS.md owns project-wide rules and the Child DOX Index. Individual AGENTS.md files may be created under `apps/` or `packages/` as those folders develop durable conventions.

## Local Contracts

### Before editing

1. Read this root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

### Mandatory reads

- **Read `AI_rules.md` in full** before making any change. Treat it as binding.
- If a user request conflicts with `AI_rules.md`, flag it — do not silently override.
- Before finishing any task that touches `apps/web`, `apps/admin`, or `apps/api`, re-check:
  - The 600-line component limit (section B)
  - The security rules (section D)

### Skill usage

Point to the relevant installed skill for the type of work being done instead of guessing:
- `backend-development`, `express-typescript` — API work
- `mongodb-natural-language-querying`, `mongodb-query-optimizer`, `mongodb-search-and-ai` — database queries
- `razorpay` — payment integration
- `security-review`, `backend-security-coder` — security-sensitive changes
- `frontend-design`, `design-taste-frontend`, `accessibility`, `performance` — frontend work
- `ponytail` — debt tracking on every task

## Work Guidance

- Architecture follows feature-based modules. See `AI_rules.md` section A.
- All new features require a branch and a PR. No direct pushes to `main`.
- Use conventional commits (`feat:`, `fix:`, `refactor:`, etc.).

## Verification

- Run `pnpm typecheck` and `pnpm lint` before marking any task done.
- For tasks that touch `apps/api`, also verify the health endpoint responds.

## Child DOX Index

This root AGENTS.md owns the entire repo. Child AGENTS.md files may be added later under specific `apps/` or `packages/` directories as those sub-trees develop durable local rules.

## After Editing

Every meaningful change requires a DOX pass before the task is done:

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why
