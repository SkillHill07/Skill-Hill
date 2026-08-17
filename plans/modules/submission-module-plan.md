# Submission Module Plan

> **Status: BUILT + WebSocket + Admin audit view** — `apps/api/src/modules/submission/`
> implements the model, validation, service, routes, and Redis rate limiter.
> Real-time status push (Phase 4 task 8) is done — socket.io server at
> `apps/api/src/sockets/` emits `submission:queued` / `submission:running` /
> `submission:completed` to per-user rooms (JWT handshake auth). Admin audit
> view `GET /admin/contests/:id/submissions` is done (filters + pagination,
> user/problem populated, full detail incl. code). Participation score is
> updated in `judge.service` (`updateParticipationScore` — best score wins).

## Purpose
Track user code submissions during contests, manage submission lifecycle (pending → running → completed), and store results.

## Architecture

```
apps/api/src/modules/submission/
├── submission.model.ts       # Mongoose schema
├── submission.service.ts     # Business logic
├── submission.routes.ts      # HTTP routes
├── submission.validation.ts  # Zod schemas
├── middleware/
│   └── rate-limit.ts         # Submission rate limiter
└── index.ts                  # Module exports
```

## Data Model

### Submission Schema
| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId | Who submitted |
| `contestId` | ObjectId | Which contest |
| `problemId` | ObjectId | Which problem |
| `language` | String | e.g., `javascript`, `python` |
| `code` | String | Submitted source code |
| `status` | Enum | `pending` → `running` → `accepted` / `rejected` / `error` / `timeout` |
| `testResults` | [TestResult] | Only public test case results stored permanently |
| `publicPassed` | Number | Count of passed public test cases |
| `publicTotal` | Number | Total public test cases |
| `hiddenPassed` | Number | Count of passed hidden test cases (stored, not detailed) |
| `hiddenTotal` | Number | Total hidden test cases |
| `totalScore` | Number | Computed score |
| `executionTime` | Number | Max execution time across test cases (ms) |
| `memoryUsed` | Number | Peak memory usage (KB) |
| `compilerOutput` | String | Compilation errors or warnings |
| `submittedAt` | Date | When submitted |
| `judgedAt` | Date | When judging completed |

### TestResult Sub-document (stored only for public cases)
| Field | Type | Notes |
|-------|------|-------|
| `testCaseId` | ObjectId | Reference |
| `passed` | Boolean | Pass/fail |
| `executionTime` | Number | ms |
| `output` | String | Actual output |
| `expectedOutput` | String | Expected (only for public) |

## Submission Flow
```
User submits code
  → POST /api/contests/:id/submissions
    → Validate problem exists, user is in contest, contest is active
    → Rate limit check
    → Create submission record (status: pending)
    → Enqueue judge job in BullMQ
    → Return submission ID (202 Accepted)

Worker picks up job
  → Update status to 'running'
  → Spawn Docker container
  → Run code against public test cases first
  → If public pass, run hidden test cases
  → Update submission record with results
  → Update leaderboard score
  → Emit WebSocket event to client
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/contests/:id/submissions | User | Submit code |
| GET | /api/contests/:id/submissions | User | List own submissions |
| GET | /api/contests/:id/submissions/:sid | User | Single submission details |
| GET | /api/admin/contests/:id/submissions | Admin/Creator | Audit view — all submissions, filters + pagination, user/problem populated |

## Rate Limiting
- 1 submission per 30 seconds per user per problem (`rl:submit:{userId}:{problemId}`)
- Redis-backed via the shared `createMiddleware` factory (`middlewares/rate-limiter.ts`)
- Resets after contest ends

## MCQ Submissions
- For `problem.type === "mcq"`, `language` is `null` and `code` holds the chosen option index (string)
- The service validates the index is within `problem.options` before enqueueing (`INVALID_MCQ_ANSWER`)
- The judge compares it to `correctAnswer` without a container run

## Best Practices
- Only public test case results stored permanently in submission
- Hidden test case results stored as counts only (no details)
- Race condition: use Redis lock to prevent concurrent submissions for same user+problem
- Submission status updates pushed via WebSocket

## Skills
- backend-development — core implementation
- express-typescript — route patterns
- mongodb-query-optimizer — indexing by userId+contestId
- backend-patterns — rate limiting