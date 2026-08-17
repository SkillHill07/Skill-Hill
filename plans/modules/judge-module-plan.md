# Judge Module Plan

> **Status: BUILT (Phase 4, first pass)** — `apps/api/src/modules/judge/`
> implements `languages.ts` (catalog-driven exec config), `docker/sandbox.ts`
> (dockerode sandbox), `judge.service.ts`, `judge.queue.ts`, `judge.worker.ts`.
> Deviations from this plan: `dockerode` is used instead of a hand-rolled CLI
> wrapper; per-test-case Docker runs are compile+run combined (recompiled per
> case for C++/Java — acceptable for v1); score weighting (public 30% / hidden
> 70%) is implemented in `calculateScore`; WebSocket status delivery is
> deferred (no socket.io server yet — clients poll the submission endpoint).

## Purpose
Execute user-submitted code against test cases in isolated Docker containers and produce results. This is the core "code runner" — equivalent to Judge0 or LeetCode's judge system.

## Architecture

```
apps/api/src/modules/judge/
├── judge.worker.ts           # BullMQ worker (separate process)
├── judge.service.ts          # Core judging logic
├── docker/
│   ├── sandbox.ts            # Docker container manager
│   └── images/               # Language-specific Dockerfiles
│       ├── javascript.Dockerfile
│       ├── python.Dockerfile
│       ├── cpp.Dockerfile
│       └── java.Dockerfile
├── languages.ts              # Language config (compile/run commands)
├── test-runner.ts            # Test case execution engine
├── score-calculator.ts       # Score computation
└── index.ts                  # Module exports
```

## How It Works

```
judge.worker.ts                        docker/sandbox.ts
┌─────────────────────┐               ┌─────────────────┐
│ 1. Dequeue job      │               │ spawn container  │
│ 2. Update status →  │──────────────→│ mount code file  │
│    running          │               │ set limits       │
│ 3. Call judge       │               │ execute          │
│    service          │               │ capture output   │
│ 4. Update status →  │←──────────────│ return result    │
│    accepted/rejected│               └─────────────────┘
│ 5. Emit WebSocket   │
│ 6. Update leaderboard│
└─────────────────────┘
```

## Judge Service Flow
1. Receive submission data (code, language, test cases)
2. For each test case:
   a. Write code to temp file
   b. Run in Docker container with test case input
   c. Capture stdout, stderr, exit code, execution time
   d. Compare output with expected
   e. Return pass/fail
3. Calculate total score
4. Return aggregated results

## Docker Sandbox Configuration
- Image: Language-specific (Node, Python, GCC, JDK)
- Resources:
  - Memory: 256MB (configurable per problem)
  - CPU: 1 core
  - Network: none (`--network none`)
  - PIDs: limit 50
  - Filesystem: read-only root, tmpfs for temp
  - User: non-root (UID 1000)
- Kill container if exceeds time limit + 1s grace period
- Container auto-removed after execution (`--rm`)

## Language Support
| Language | Command | Image |
|----------|---------|-------|
| JavaScript | `node {file}.js` | node:20-alpine |
| TypeScript | `npx tsx {file}.ts` | node:20-alpine |
| Python | `python3 {file}.py` | python:3.12-alpine |
| C++ | `g++ -o {file} {file}.cpp && ./{file}` | gcc:13-alpine |
| Java | `javac {file}.java && java {file}` | openjdk:21-alpine |

## Score Calculation
- Each test case grants equal weight
- Public test cases: 30% of total score
- Hidden test cases: 70% of total score
- Partial credit: points × (passed / total)
- Time bonus: none in v1 (ponytail: consider for v2)

## BullMQ Queue
- Queue name: `judge`
- Concurrency: 5 (limited by Docker host capacity)
- Retry: 2 attempts on infrastructure failure (not on wrong answer)
- Timeout: problem timeLimit + 10s overhead
- Dead letter queue: submissions that repeatedly fail infrastructure

## Implementation Notes (v1)
- **Docker client**: `dockerode` (new dependency). Honors `DOCKER_HOST` env; on Windows Docker Desktop set `DOCKER_HOST=npipe:////./pipe/docker_engine`.
- **Idempotency**: `evaluateSubmission` never re-judges a finished submission (worker retries are safe).
- **MCQ branch**: `problem.type === "mcq"` compares the submitted option index to `correctAnswer` — no container run.
- **Hidden test cases** only fetched via `problemService.getTestCases(id, true)` inside the worker.
- **Compile errors**: detected from the first failing run's stderr when a compile step exists (`compilerOutput`, capped 4000 chars).
- **Memory**: peak usage via `container.stats()` (`memory_stats.usage`, bytes → KB).
- **Status semantics**: any timeout → `timeout`; infra/compile failure → `error`; all pass → `accepted`; else `rejected`.

## ponytail Notes
- Compile+run per test case recompiles C++/Java per case — optimize by compiling once and sharing the binary when volume grows.
- `fileBase` is hardcoded per key (`java` → `Main`) — promote to a catalog field if another language needs a different base name.
- TypeScript judging needs a custom image with `tsx` preinstalled (`--network none` blocks on-demand npm fetch).
- WebSocket status push (plan §8) deferred until a socket.io server exists.

## Best Practices
- Judge worker runs as separate process, never in API request thread
- Docker containers are ephemeral and stateless
- Each test case runs independently to prevent side effects
- Hidden test cases never leave the judge worker process
- Worker pool size limited to prevent resource exhaustion
- Queue submissions when pool is full
- All timing is server-side (never trust client)

## Security Measures
- `--network none` prevents data exfiltration
- `--read-only` prevents file system tampering
- Non-root user prevents privilege escalation
- Time limit kills runaway processes
- Memory limit prevents DoS
- PIDs limit prevents fork bombs

## Skills
- backend-development — core infrastructure
- security-review — sandbox hardening
- express-typescript — BullMQ integration
- mongodb-query-optimizer — submission query performance