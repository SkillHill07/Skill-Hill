# Phase 7: Testing & Verification

## Objective
Build comprehensive test coverage across all modules, including unit tests, integration tests, E2E tests, and security tests.

## Tasks

### 1. Unit Tests
- **Files**: Co-located `*.test.ts` next to each service file
- **Test Runner**: Vitest (recommended) or Jest
- **Coverage Areas**:
  - **Contest Service**: State machine transitions, validation, scoring logic
  - **Payment Service**: Order creation, webhook processing, refund logic
  - **Judge Service**: Test case comparison, score calculation
  - **Auth Service**: JWT generation/validation, OTP verification
  - **Utility Functions**: Encryption, caching, response formatting
- **Skill**: backend-development
- **Recommended Tools**: Vitest, Supertest (for HTTP tests)
- **Best Practices**:
  - Mock external services (Razorpay, Docker, Redis, MongoDB)
  - Test each business rule independently
  - Aim for 80%+ line coverage on service files

### 2. Integration Tests
- **Files**: `apps/api/src/__tests__/integration/`
- **Coverage Areas**:
  - **Contest Lifecycle**: Full create → publish → join → freeze → settle flow
  - **Payment Flow**: Create order → simulate Razorpay webhook → verify participation
  - **Submission Flow**: Submit code → judge runs → result stored → leaderboard updated
- **Skill**: backend-development, mongodb-query-optimizer
- **Setup**: Use MongoDB memory server, Redis mock, in-memory Upstash

### 3. E2E Tests
- **Files**: `apps/web/__tests__/e2e/`
- **Framework**: Playwright
- **Coverage Areas**:
  - **Contest Browser**: Browse contests, view details, join contest
  - **Payment Checkout**: Click join → Razorpay modal opens → mock payment
  - **Workspace**: Load problem → write code → run tests → submit
  - **Leaderboard**: View leaderboard, see ranking update
  - **Admin Panel**: Create contest, add problems, manage payments
- **Skill**: clerk-testing, frontend-dev
- **Best Practices**:
  - Use Playwright for browser automation
  - Mock Razorpay checkout for CI
  - Test responsive layouts

### 4. Security Tests
- **Files**: `apps/api/src/__tests__/security/`
- **Coverage Areas**:
  - **JWT**: Test expired tokens, malformed tokens, missing auth header
  - **Webhook HMAC**: Test invalid signature rejection
  - **Rate Limiting**: Test limit enforcement and reset
  - **Input Validation**: Test XSS, injection payloads
  - **Hidden Test Cases**: Verify stripped from all responses
- **Skill**: security-review

### 5. Load Tests
- **Files**: `apps/api/k6/`
- **Framework**: k6
- **Coverage Areas**:
  - **Submission Endpoint**: Simulate 100 concurrent submissions
  - **Payment Endpoint**: Simulate 50 concurrent order creations
  - **Leaderboard**: Simulate high read volume during contest end
- **Skill**: backend-development
- **Best Practices**:
  - Run after all phases complete
  - Identify bottlenecks in judge worker pool
  - Test Redis under load

### 6. Ponytail Debt Item Recording
- **Description**: As tests reveal shortcuts or deferred decisions, log `ponytail:` comments in relevant code
- **Skill**: ponytail

## Deliverables
- Unit test suite (80%+ coverage on services)
- Integration tests for all critical flows
- E2E tests for main user journeys
- Security test suite
- Load test reports
- Ponytail debt items logged

## Dependencies
- Phases 1-6

## Verification
- `pnpm test` passes (all test suites)
- `pnpm test:e2e` passes
- `pnpm test:security` passes
- Coverage report meets threshold
- Load test shows acceptable response times