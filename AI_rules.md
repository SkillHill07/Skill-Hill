# AI Rules — Skill Contest Platform

This file is binding. Every AI agent working on this repo must read it in full before making any change. If a request conflicts with these rules, flag it to the user — do not silently override.

---

## A. Architecture Rules

- **Feature-based modules**: inside each app, organize by module/domain (`modules/auth/`, `modules/contest/`), not by technical layer (`controllers/`, `services/`). A module owns its routes, services, models, and validation.
- **Backend is stateless**: no in-memory state that must survive restarts. Anything shared across instances (leaderboard, locks, rate-limit counters, contest state) lives in Redis.
- **App boundary**: `apps/api`, `apps/web`, `apps/admin` never import each other's code. Only `packages/*` may be shared.
- **Data flow**: client → React Query → API route → service layer → model layer. Express route handlers contain zero business logic; they parse input, call a service function, and return the result.
- **API route handlers** accept `(req, res, next)` only. Business logic lives in service files under the module.

## B. Component Rules (web + admin)

- **Hard limit: every component file must be under 600 lines.** If a component approaches 600 lines, split it into subcomponents, custom hooks, or extracted helpers before merging.
- One component per file; colocate its hook, types, and tests next to it.
- Use shadcn/ui primitives (`@skillcontest/ui`) as the base for all UI. Do not hand-roll components that shadcn already provides (Button, Input, Dialog, etc.).
- Use `motion` (Framer Motion) for transitions and animations. Keep animations subtle and consistent. No animation libraries beyond `motion`.
- All server data fetching goes through TanStack Query custom hooks per resource (`useContest`, `useLeaderboard`). No ad hoc `fetch` / `axios` calls inside components.
- Use Next.js Server Components by default. Mark Client Components explicitly with `"use client"` and keep them as small and leaf-level as possible.

## C. Caching Rules

- Use Next.js `use cache` directive / `unstable_cache` for cacheable server reads (published quiz lists, settled contest results) with explicit revalidation tags.
- Never cache live leaderboard or in-progress contest state at the Next.js layer. Those must always come from Redis via the API, live.
- Define cache tags per resource (`contest:{id}`, `quiz:{id}`) and revalidate on mutation (publish, settle, edit).
- TanStack Query `staleTime` / `gcTime`: short or zero for live contest data; longer (5+ min) for static reference data.

## D. Backend & Security Rules

- All money fields stored as integers in **paise** (₹1 = 100 paise). Never use floats.
- Razorpay webhook route is excluded from auth middleware but **must** verify the HMAC signature before processing. Reject unsigned/invalid requests with 400.
- Idempotency: every payment-affecting job or webhook handler checks an idempotency key (MongoDB or Redis) before crediting or refunding. Never process the same event twice.
- JWT: short-lived access tokens (15 min), longer-lived refresh tokens (7 days), refresh rotation on use, revocation list in Redis for logout/ban.
- Turnstile verification (server-side `siteverify` call) required on: signup, login, contest-join, withdrawal. No other endpoints.
- All input validated with Zod at the route boundary before reaching a service function.
- Rate limiting (Redis-backed) on: OTP requests, login attempts, submissions, withdrawal requests.
- Contest timing and final score freeze are **always server-authoritative** (Upstash Redis delayed job, polled by the contest worker at `endTime`). Never trust a client-reported "time's up."
- Never trust a client-side "payment success" callback. Only the verified webhook or a server-side payment status check confirms payment.
- Code judge / untrusted code execution runs in an isolated worker, never inline in the API request thread.
- Hidden test cases and correct-answer fields are stripped before any response is sent to a client.
- KYC fields (PAN, bank/UPI) are encrypted at rest. Passwords are hashed with bcrypt or argon2. Never logged, never returned in any API response.
- Every Mongoose schema has explicit validation. No `strict: false` schemas in production models.
- Centralized Express error-handling middleware. No raw stack traces returned to clients in production (`NODE_ENV=production`).

## E. Admin Panel Rules

- Separate auth/session from the user app. `apps/admin` has its own login and RBAC roles: `admin`, `creator`.
- Every admin action that mutates money, bans a user, or edits a live-adjacent resource is logged (who, what, when) to an audit collection.
- Publishing a quiz is a one-way state transition. Editing a published quiz's answer key is disallowed; must clone the quiz instead.

## F. Git / Workflow Rules

- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`.
- No direct commits to `main`. Feature branches and PRs required.
- `pnpm typecheck` and `pnpm lint` must pass before any commit is considered done.

## G. Ongoing Debt Tracking

- Use the ponytail skill continuously throughout every task. Log any shortcut, TODO, or deferred hardening decision as it happens, not retroactively. Each ponytail entry should name the shortcut taken, the ceiling it has, and when to upgrade.
