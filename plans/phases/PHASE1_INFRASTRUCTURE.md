# Phase 1: Infrastructure Setup

## Objective
Set up the foundational infrastructure for the skill contest platform, including Redis for shared state, Docker for code execution isolation, and core project structure.

## Tasks

### 1. Redis Setup
- **File**: `apps/api/src/config/redis.ts`
- **Description**: Configure Redis connection for:
  - Contest state management (leaderboards, locks, rate-limit counters)
  - Payment idempotency keys
  - Session storage
- **Skill**: backend-development, backend-patterns
- **Best Practices**:
  - Use connection pooling
  - Implement graceful shutdown
  - Add health check endpoint
  - Configure proper timeouts

### 2. Docker Environment for Code Execution
- **File**: `apps/api/src/modules/judge/Dockerfile`
- **Description**: Create isolated Docker containers for code execution
- **Skill**: security-review, backend-development
- **Best Practices**:
  - Use minimal base images (e.g., Alpine)
  - Run as non-root user
  - Set memory and CPU limits
  - Implement network isolation
  - Add timeout enforcement

### 3. MongoDB Schema Design
- **File**: `apps/api/src/models/`
- **Description**: Design schemas for:
  - User profiles
  - Contests
  - Problems
  - Submissions
  - Payments
  - Leaderboards
- **Skill**: mongodb-natural-language-querying, mongodb-query-optimizer
- **Best Practices**:
  - Use explicit validation
  - Index for query patterns
  - Store money as paise integers
  - Encrypt sensitive fields (PAN, bank details)

### 4. Core Project Structure
- **Files**: `apps/api/src/modules/`, `apps/web/src/modules/`, `apps/admin/src/modules/`
- **Description**: Create feature-based module directories
- **Skill**: backend-development, frontend-dev
- **Best Practices**:
  - Feature-based modules (not layer-based)
  - Each module owns its routes, services, models
  - Shared types in packages/shared-types

### 5. Environment Configuration
- **File**: `apps/api/src/config/env.ts`
- **Description**: Centralize environment variables with validation
- **Skill**: backend-development
- **Best Practices**:
  - Use Zod for validation
  - Never expose secrets to clients
  - Support multiple environments

## Deliverables
- Redis connection configured and tested
- Docker sandbox environment ready
- MongoDB schemas defined
- Project structure scaffolded
- Environment configuration validated

## Dependencies
- None (foundational phase)

## Verification
- `pnpm typecheck` passes
- `pnpm lint` passes
- Redis connection test succeeds
- Docker build succeeds
- MongoDB schema validation tests pass