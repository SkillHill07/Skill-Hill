# Phase 4: Code Execution Environment

## Objective
Build the secure, isolated code execution system — the core leetcode-style judge — with support for multiple languages, time/memory limits, and hidden test case grading.

## Tasks

### 1. Judge Worker Architecture
- **File**: `apps/api/src/modules/judge/judge.worker.ts`
- **Description**: Upstash worker that processes submission jobs from a queue
- **Architecture**:
  ```
  User submits code → API creates submission record → Upstash queue → 
  Judge worker picks up → Spawn Docker container → Run code against test cases →
  Collect results → Update submission record → Emit leaderboard update
  ```
- **Skill**: backend-development, security-review
- **Best Practices**:
  - Worker runs in separate process (not inline in API request thread)
  - Timeout enforced at OS level (docker `timeout` command)
  - No network access from inside container
  - Worker count based on CPU cores

### 2. Docker Sandbox
- **File**: `apps/api/src/modules/judge/docker/sandbox.ts`
- **Description**: Manager for spawning and managing Docker containers for code execution
- **Features**:
  - Language-specific Docker images (Node.js, Python, C++, Java, etc.)
  - Mount code file as volume
  - Run with `docker run --rm --network none --memory 256m --cpus 1 --pids-limit 50`
  - Capture stdout, stderr, exit code
  - Kill container if exceeds `timeLimit` (default: 2s for easy, 5s for medium, 10s for hard)
- **Skill**: security-review, backend-development
- **Best Practices**:
  - Run containers as non-root user (UID 1000 inside container)
  - Use read-only root filesystem (`--read-only`)
  - Temp directories mounted as tmpfs for write permission if needed
  - Remove container after execution (`--rm`)
  - All time limits are server-side enforced

### 3. Judge Service
- **File**: `apps/api/src/modules/judge/services/judge.service.ts`
- **Functions**:
  - `evaluateSubmission(submissionId)` — main entry point
  - `runTestCases(code, language, testCases)` — run code against test cases
  - `compareOutput(actual, expected)` — exact match or whitespace-tolerant comparison
  - `calculateScore(results)` — points per passed test case
- **Skill**: backend-development, express-typescript
- **Best Practices**:
  - Each test case run independently to prevent side effects between cases
  - Hidden test cases never exposed in any response to client

### 4. Submission Model
- **File**: `apps/api/src/modules/submission/submission.model.ts`
- **Schema**: `userId`, `contestId`, `problemId`, `language`, `code`, `status` (pending | running | accepted | rejected | error | timeout), `testResults[]` (public results only stored, hidden results ephemeral), `totalScore`, `executionTime`, `memoryUsed`, `submittedAt`, `judgedAt`
- **Skill**: mongodb-natural-language-querying
- **Best Practices**:
  - Only store public test case results in DB
  - Hidden test case pass/fail stored only as count, not details

### 5. Submission API
- **Files**: `apps/api/src/modules/submission/routes/submission.routes.ts`, `services/submission.service.ts`
- **Endpoints**:
  - `POST /api/contests/:id/submissions` — submit code (user, must be in active contest)
  - `GET /api/contests/:id/submissions` — list user's submissions for contest
  - `GET /api/contests/:id/submissions/:submissionId` — single submission result
- **Skill**: express-typescript, backend-development

### 6. Language Support Configuration
- **File**: `apps/api/src/modules/judge/languages.ts`
- **Description**: Language-specific compiler/interpreter commands and file extensions
- **Languages**:
  - `javascript` — `node {file}.js`
  - `python` — `python3 {file}.py`
  - `cpp` — `g++ -o {file} {file}.cpp && ./{file}`
  - `java` — `javac {file}.java && java {file}`
  - `typescript` — `npx tsx {file}.ts`
- **Skill**: backend-development

### 7. Rate Limiting on Submissions
- **File**: `apps/api/src/modules/submission/middleware/rate-limit.ts`
- **Description**: Redis-backed rate limiting for submissions per user per contest
- **Limits**: 1 submission per 30 seconds per problem during contest
- **Skill**: backend-development, backend-patterns

### 8. Submission Status WebSocket ✅
- **Files**: `apps/api/src/sockets/{socket-server,emitter,submission.socket,index}.ts`
- **Description**: Push submission status updates to client via WebSocket
- **Events**:
  - `submission:queued` — when submission enters Upstash queue (submission.service)
  - `submission:running` — when worker starts processing (judge.service)
  - `submission:completed` — when judging finishes (judge.service `persistResult` — single choke point)
- **Auth**: JWT verified at handshake (`auth.token`, Bearer header, or `accessToken` cookie);
  authenticated clients join `user:{userId}` rooms; invalid/missing tokens rejected
- **Wiring**: `initSocketServer(server)` in `server.ts` (after `app.listen`); `closeSocketServer()`
  on graceful shutdown; `emitToUser` no-ops before init (clients fall back to polling)
- **Tests**: emitter unit tests + socket.io integration tests (auth rejections, room delivery,
  cross-user isolation) + token-extraction unit tests (auth.token / Bearer / cookie) —
  real server + `socket.io-client`
- **Skill**: backend-development
- **Multi-instance (removed)**: `@socket.io/redis-adapter` was dropped — Upstash
  Redis is REST-only (no pub/sub), so realtime relay across instances is not
  wired. The API runs single-instance; scale horizontally only for stateless
  HTTP, not sockets.
- **Deferred (ponytail) — worker extraction**: the socket emits live in `judge.service`,
  which runs in-process today. When the judge worker is extracted to a standalone process,
  its `emitToUser` calls would silently no-op (no socket.io server there). Before that
  extraction, the worker must relay status via Redis pub/sub (or Upstash polling) and the
  API process must forward to socket.io — otherwise realtime delivery breaks silently.

## Deliverables
- Docker sandbox for isolated code execution
- Multi-language support
- Submission lifecycle API
- Hidden test case grading
- Real-time status updates

## Dependencies
- Phase 1 (Docker, Redis)
- Phase 2 (Contest management, Problems)

## Verification
- Code execution E2E (submit code → judge runs → result returned)
- Hidden test cases never appear in client response
- Timeout enforcement (submit infinite loop → killed at timeLimit)
- Rate limiting enforcement
- WebSocket status delivery