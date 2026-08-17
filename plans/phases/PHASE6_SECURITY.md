# Phase 6: Security & Compliance

## Objective
Harden the platform against common vulnerabilities and ensure compliance with OWASP Top 10, payment security standards, and data privacy requirements.

## Tasks

### 1. Full Security Audit
- **Files**: All modules
- **Description**: Systematic review of every endpoint and data flow
- **Skill**: security-review, backend-security-coder
- **Checklist**:
  - Authentication: All routes except public endpoints require valid JWT
  - Authorization: Users can only access their own data (submissions, payments)
  - Input validation: Every endpoint has Zod schema validation
  - Rate limiting: OTP, login, submission, withdrawal endpoints all Redis-backed
  - SQL/NoSQL injection: All DB queries use parameterized/ORM methods
  - XSS: React default escaping, no dangerouslySetInnerHTML without sanitization
  - CSRF: API uses token-based auth (JWT in headers), not cookies

### 2. Payment Security
- **Files**: `apps/api/src/modules/webhook/razorpay.webhook.ts`
- **Actions**:
  - Verify all Razorpay webhooks with HMAC SHA256
  - Never trust client-side payment success callback
  - Idempotency keys on all payment operations
- **Skill**: razorpay, security-review, backend-security-coder

### 3. Code Execution Security
- **Files**: `apps/api/src/modules/judge/`
- **Actions**:
  - Docker containers run with `--network none`, `--read-only`, non-root user
  - Time and memory limits enforced server-side
  - No file system access outside temp directory
  - Kill runaway processes at OS level
  - Limit number of running containers (pool of 5-10)
  - Queue submissions when pool exhausted
- **Skill**: security-review, backend-security-coder

### 4. Data Privacy & Encryption
- **Files**: `apps/api/src/utils/encryption.ts` (already exists, verify/update)
- **Actions**:
  - Encrypt KYC fields (PAN, bank/UPI) at rest using AES-256-GCM
  - Hash passwords with bcrypt or argon2 (already done in auth module)
  - Never log sensitive fields
  - Never return sensitive fields in API responses
- **Skill**: security-review, backend-development

### 5. JWT Hardening
- **Files**: `apps/api/src/modules/auth/services/auth-jwt.ts` (already exists, verify)
- **Actions**:
  - Short-lived access tokens (15 min)
  - Longer-lived refresh tokens (7 days)
  - Refresh rotation on use
  - Revocation list in Redis for logout/ban
- **Skill**: security-review, backend-development, clerk-backend-api

### 6. Turnstile Integration
- **Files**: `apps/api/src/middlewares/turnstile.ts`
- **Actions**:
  - Cloudflare Turnstile verification on: signup, login, contest-join, withdrawal
  - Server-side `siteverify` call required
- **Skill**: security-review

### 7. Audit Logging ✅
- **File**: `apps/api/src/modules/audit/` (model, service, validation, routes, tests)
- **Actions**: Done.
  - `auditService.log({ actorId, actorRole, action, resource, resourceId, details, ip })` — best-effort by design (a failed audit write never rolls back the money mutation it records).
  - Wired into every admin action that mutates money, bans a user, or changes contest state: contest create/update/publish/cancel/freeze/settle, wallet freeze/unfreeze, payment refund, prize redistribute, user status (ban), user role, KYC review.
  - Read-only view: `GET /admin/audit` (admin/creator), paginated + filterable by action/actor/resource.
  - Admin panel page: `apps/admin/src/app/audit/page.tsx` (sidebar → "Audit log").
- **Log includes**: who, what, when, IP, resource ID — stored in the MongoDB `auditlogs` collection.

### 8. Error Handling
- **Files**: `apps/api/src/middlewares/error.ts`
- **Actions**:
  - Centralized Express error-handling middleware (existing, verify/update)
  - Never return raw stack traces in production
  - Log full error details server-side, return user-friendly message to client
- **Skill**: express-typescript, security-review

### 9. Rate Limiting
- **File**: `apps/api/src/middlewares/rate-limit.ts`
- **Actions**:
  - Redis-backed rate limiting using `express-rate-limit` with Redis store
  - Apply to: OTP requests (1/min), login (5/min), submissions (2/min), withdrawals (1/hour)
- **Skill**: backend-development, security-review

### 10. Hidden Test Case Protection
- **Files**: `apps/api/src/modules/contest/problem.model.ts`
- **Actions**:
  - Mongoose `toJSON` transform strips `testCases.$**` from all client responses
  - Hidden test cases only accessible server-side in judge worker
  - Correct solution stored separately (never in problem document)

## Deliverables
- Security audit report (ponytail debt items logged)
- All security fixes applied
- Turnstile integration complete
- Audit logging operational
- Code execution sandbox verified secure

## Dependencies
- Phases 1-4 (all code must exist before security review)

## Verification
- `security-review` skill generates confidence report
- No secrets in client-side code
- All endpoints properly authenticated/authorized
- Payment webhook signature test
- Hidden test cases not exposed in any API response
- Docker sandbox escape test (attempt to access host network)