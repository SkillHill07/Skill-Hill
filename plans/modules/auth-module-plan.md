# Auth Module Plan

## Status
Already implemented with:
- JWT auth with access/refresh tokens
- OAuth (Google, GitHub)
- OTP-based auth
- KYC verification with encrypted fields
- File upload (avatar)
- Clerk integration (webhooks, sync)
- Admin accounts

## Needed Extensions for Contest Platform

### 1. Contest-Specific Role Checks
- **File**: `apps/api/src/modules/auth/middleware/contest-access.ts`
- **Purpose**: Middleware to verify user has joined/paid for a contest before accessing workspace
- **Logic**: Check participation record in MongoDB
- **Skill**: backend-development, express-typescript

### 2. Contest Join Rate Limit
- **File**: `apps/api/src/modules/auth/middleware/join-rate-limit.ts`
- **Purpose**: Prevent rapid join attempts via Redis-backed rate limiter
- **Limit**: 3 join attempts per minute per user
- **Skill**: backend-development

### 3. Payment Auth Extension
- **Description**: Auth middleware already handles user identity; no extension needed for payment
- **Note**: Webhook endpoint is deliberately excluded from auth middleware

### 4. Admin Verification for Payment Actions
- **File**: `apps/api/src/modules/auth/middleware/admin-only.ts`
- **Purpose**: RBAC check ensuring only `admin` role can perform refunds, manual freeze/settle
- **Skill**: backend-development

## Key Files (already exist)
- `services/auth.service.ts` — core auth logic
- `services/auth-jwt.ts` — JWT handling
- `services/auth-otp.service.ts` — OTP verification
- `services/auth-kyc.service.ts` — KYC processing
- `services/auth-admin-accounts.service.ts` — admin accounts
- `routes/auth.routes.ts` — auth endpoints
- `routes/auth-otp.routes.ts` — OTP endpoints
- `routes/auth-kyc.routes.ts` — KYC endpoints

## Trusted Skills
- clerk-backend-api — for user/session management
- clerk-webhooks — for user sync
- security-review — for auth hardening