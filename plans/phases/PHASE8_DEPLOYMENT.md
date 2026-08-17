# Phase 8: Deployment & Monitoring

## Objective
Set up CI/CD pipeline, production deployment configuration, monitoring, and alerting for the skill contest platform.

## Tasks

### 1. CI/CD Pipeline
- **File**: `.github/workflows/ci.yml`
- **Steps**:
  1. Install dependencies (`pnpm install`)
  2. Type check (`pnpm typecheck`)
  3. Lint (`pnpm lint`)
  4. Run unit/integration tests (`pnpm test`)
  5. Build (`pnpm build`)
  6. Run E2E tests (`pnpm test:e2e`)
  7. Build Docker images
  8. Push to registry
  9. Deploy to staging
  10. Run smoke tests
  11. Deploy to production (manual approval gate)
- **Skill**: backend-development
- **Branch Strategy**:
  - Feature branches → PR to `main`
  - `main` → CI → staging deploy
  - Release tags → production deploy

### 2. Docker Compose (Local Development)
- **File**: `docker-compose.yml`
- **Services**:
  - `mongo` — MongoDB instance
  - `upstash-redis` — Upstash Redis (managed, REST API; creds via env)
  - `api` — Express API server (judge + contest workers run in-process)
  - `web` — Next.js app
- **Skill**: backend-development

### 3. Production Docker Setup
- **Files**: `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/admin/Dockerfile`
- **Features**:
  - Multi-stage builds
  - Minimal production images (distroless)
  - Health check endpoints
  - Non-root user
- **Skill**: backend-development

### 4. Health Checks
- **Files**: `apps/api/src/modules/health/health.routes.ts` (already exists, extend)
- **Endpoints**:
  - `GET /api/health` — basic liveness check
  - `GET /api/health/ready` — readiness (MongoDB, Redis, Razorpay connectivity)
- **Skill**: backend-development

### 5. Monitoring & Observability
- **Files**: `apps/api/src/utils/logger.ts` (already exists, enhance)
- **Stack**: OpenTelemetry + Prometheus + Grafana (optional initially)
- **Metrics to track**:
  - API request latency (p50, p95, p99)
  - Judge queue depth and processing time
  - Payment success/failure rate
  - Contest join rate
  - Submission rate
  - Error rate by endpoint
- **Logging**:
  - Structured JSON logging
  - Log levels: debug, info, warn, error
  - Request ID correlation
- **Skill**: backend-development

### 6. Alerting
- **Description**: Configure alerts for:
  - Judge worker queue growing beyond threshold
  - Payment webhook failure rate > 5%
  - API error rate > 1%
  - Contest freeze job failed
  - Redis/MongoDB connection loss
- **Skill**: backend-development

### 7. Database Backups
- **Description**: Set up automated MongoDB backups (daily)
- **Tools**: `mongodump` cron job or Atlas backup

### 8. Production Checklist
- **Env Vars**: All secrets managed via environment variables or secret manager
- **SSL/TLS**: HTTPS enforced
- **CORS**: Configured for web and admin domains
- **Docker Security**: Images scanned for vulnerabilities
- **Rate Limiting**: Production-grade limits applied
- **Redis**: Production configuration (persistence, maxmemory)

## Deliverables
- CI/CD pipeline operational
- Docker setup for local and production
- Health check endpoints
- Monitoring metrics collection
- Alert configuration
- Production deployment checklist

## Dependencies
- All phases 1-7

## Verification
- `pnpm deploy` builds all services
- Health check endpoints respond
- CI pipeline passes all checks
- Monitoring dashboard shows metrics
- Can simulate judge queue growth and verify alert