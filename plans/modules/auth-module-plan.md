# Auth Module Plan

## Status
Implemented. Session model (updated 2026-08):
- JWT auth: **15-minute access tokens** + **7-day single-use refresh tokens**, rotated on every refresh with reuse detection (reuse ⇒ all sessions revoked). Tokens live in HttpOnly cookies only — never in response bodies.
- Both frontends auto-refresh on 401 via their `lib/api.ts` clients (single-flight, cross-tab lock) and retry the original request.
- OAuth (Google, GitHub): one-time CSRF `state` values stored in Redis (10-min TTL); banned/flagged accounts are rejected at callback before tokens are issued; callbacks set cookies and redirect to `/auth/callback` on the frontend.
- OTP-based email verification
- KYC verification with AES-256-GCM encrypted fields
- File upload (avatar)
- Admin accounts (`/admin/auth/login`, RBAC roles admin/creator)
- Turnstile verified server-side on signup, login, forgot-password, contest-join, **withdrawal**
- Rate limits (Redis fixed-window): login 5/min, register 3/min, refresh 10/min, OTP 5/min, forgot-pw 3/min, join 3/min/user, withdraw 3/5min/user

Note: no Clerk integration exists in this codebase (earlier draft of this plan mentioned it); identity is fully self-hosted.

## Needed Extensions for Contest Platform

### 1. Contest-Specific Role Checks
- Implemented inline in contest/submission services (participation check before workspace actions).

### 2. Contest Join Rate Limit
- Implemented: `joinLimiter` in `apps/api/src/middlewares/rate-limiter.ts` (3/min per user).

### 3. Payment Auth Extension
- Webhook endpoint is deliberately excluded from auth middleware; HMAC signature is mandatory instead.

### 4. Admin Verification for Payment Actions
- Implemented via `requireRole("admin")` on refund/freeze/settle/admin routes.

## Key Files
- `services/auth.service.ts` — core auth logic (register/login/refresh rotation/logout/reset/delete/set-password)
- `services/auth-jwt.ts` — token generation/verification + Redis allow-list
- `services/auth-google.service.ts`, `services/auth-github.service.ts` — OAuth + CSRF state
- `services/auth-otp.service.ts` — OTP verification
- `services/auth-kyc.service.ts` — KYC processing
- `services/auth-admin-accounts.service.ts` — admin accounts
- `routes/auth.routes.ts` and sibling route files

## Trusted Skills
- security-review / backend-security-coder — for future auth hardening passes
