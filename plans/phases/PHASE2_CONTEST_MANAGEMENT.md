# Phase 2: Contest Management System

## Objective
Build the core contest management APIs — create, schedule, join, run, and settle contests with proper state transitions and integrity guarantees.

## Tasks

### 1. Contest Model & Schema
- **File**: `apps/api/src/modules/contest/contest.model.ts`
- **Schema fields**: `title`, `slug`, `description`, `startTime`, `endTime`, `entryFee` (in paise), `prizePool`, `status` (draft | active | frozen | settled | cancelled), `maxParticipants`, `createdBy`
- **Skill**: mongodb-natural-language-querying, backend-development
- **Best Practices**:
  - Money stored as paise integers
  - Explicit Mongoose validation on all fields
  - Index on `status + startTime` for listing queries
  - `endTime` must be > `startTime`

### 2. Contest Lifecycle API
- **Files**: `apps/api/src/modules/contest/routes/contest.routes.ts`, `services/contest.service.ts`
- **Endpoints**:
  - `GET /api/contests` — list upcoming/active contests (filtered by status, paginated)
  - `GET /api/contests/:id` — single contest details (strips hidden fields)
  - `POST /api/contests` — create draft (admin only)
  - `PATCH /api/contests/:id` — update draft (admin only)
  - `POST /api/contests/:id/publish` — transition draft → active
  - `POST /api/contests/:id/join` — user joins (requires payment first)
  - `POST /api/contests/:id/start` — start contest for user
  - `POST /api/contests/:id/freeze` — transition active → frozen (Upstash job at endTime)
  - `POST /api/contests/:id/settle` — transition frozen → settled (triggers prize distribution)
  - `POST /api/contests/:id/cancel` — cancel contest, refund all participants
- **Skill**: express-typescript, backend-patterns, backend-development
- **Best Practices**:
  - Route handlers call service, zero business logic in handlers
  - All input validated with Zod at route boundary
  - State machine transitions enforced in service layer
  - Upstash delayed job at `endTime` to auto-freeze
  - Server-authoritative timing only

### 3. Problem/Question Management
- **Files**: `apps/api/src/modules/contest/problem.model.ts`, `routes/`, `services/`
- **Schema fields**: `contestId`, `title`, `description`, `difficulty` (easy/medium/hard), `points`, `order`, `testCases` (public[], hidden[] — hidden stripped from response), `languageSupport`[], `timeLimit`, `memoryLimit`, `solutionTemplate`{}
- **Endpoints**:
  - `POST /api/contests/:id/problems` — add problem (admin)
  - `GET /api/contests/:id/problems` — list problems (public details only, no hidden test cases)
  - `GET /api/contests/:id/problems/:problemId` — single problem
  - `PATCH /api/contests/:id/problems/:problemId` — update (admin, only if contest is draft)
  - `DELETE /api/contests/:id/problems/:problemId` — remove (admin)
- **Skill**: backend-development, security-review, mongodb-query-optimizer
- **Best Practices**:
  - Hidden test cases stripped from all client responses via Mongoose `toJSON` transform
  - Correct solution never stored alongside problem data
  - Problems cannot be edited once contest is active

### 4. User Participation
- **Files**: `apps/api/src/modules/contest/participation.model.ts`, `services/`
- **Schema**: `userId`, `contestId`, `joinedAt`, `startedAt`, `submittedAt`, `totalScore`, `status` (registered | started | completed | timedout)
- **Endpoints**:
  - `POST /api/contests/:id/join` — registers user after payment check
  - `POST /api/contests/:id/start` — marks participation as started (one-time)
- **Skill**: backend-development, backend-patterns

### 5. Upstash Jobs
- **File**: `apps/api/src/jobs/contest.jobs.ts`
- **Jobs**:
  - `freeze-contest` — delayed job at contest `endTime`
  - `settle-contest` — runs after freeze, distributes prizes
  - `timeout-participant` — per-user timeout if overtime allowed
- **Skill**: backend-development
- **Best Practices**:
  - Idempotent job handlers
  - Dead-letter queue for failed jobs
  - Retry with exponential backoff

### 6. Data Caching
- **Files**: `apps/api/src/utils/cache.ts` (already exists)
- **Description**: Cache contest lists with Next.js `use cache` directive
- **Skill**: backend-patterns
- **Cache tags**: `contest:{id}`, `contest:list`, `contest:leaderboard:{id}`
- **Rules**:
  - Never cache active contest state at Next.js layer
  - Cache settled contest results permanently
  - Revalidate on transition (publish, settle)

## Deliverables
- Contest CRUD with full lifecycle
- Problem management with hidden test case security
- Participation tracking
- Auto-freeze via Upstash
- Proper state machine transitions

## Dependencies
- Phase 1 (Redis, MongoDB schemas)

## Verification
- Contest lifecycle E2E test (create → publish → join → start → freeze → settle)
- Hidden test cases never leak in API response
- Upstash freeze job fires at correct time