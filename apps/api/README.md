# @skillcontest/api

Express + TypeScript REST API — the backend for SkillHill.

All routes return a standard envelope:

```jsonc
{ "success": true,  "data": { ... }, "message": "..." }  // success
{ "success": false, "error": "...."                      }  // error
```

## Skills

| Skill | Used for |
|---|---|
| `express-typescript` | Route patterns, middleware, auth |
| `backend-development` | General backend conventions |
| `backend-patterns` | Architecture decisions |
| `backend-security-coder` | Input validation, secure coding |
| `security-review` | Auditing auth/payment routes |
| `nodejs-express-server` | Express setup patterns |
| `mongodb-natural-language-querying` | Writing Mongoose queries |
| `mongodb-query-optimizer` | Indexing / slow query fixes |
| `mongodb-search-and-ai` | Atlas Search / Vector Search |
| `razorpay` | Payment integration |
| `ponytail` | Debt tracking |

## Quick start

```bash
pnpm dev           # tsx watch src/server.ts :4000
pnpm build         # tsc
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint src --ext ts
```

## Docs

OpenAPI spec at [/api-docs.json](http://localhost:4000/api-docs.json) and Swagger UI at [/docs](http://localhost:4000/docs).

---

## Auth System — Overview

The auth system is built **from scratch** using battle-tested libraries (jsonwebtoken, bcrypt, zod) and follows all rules in `AI_rules.md`.

### Authentication

Tokens are stored in **HttpOnly, Secure (prod), SameSite=Lax cookies** and also returned in the response body for backward compatibility.

- **Access token** (`accessToken` cookie + response body): 7 days
- **Refresh token** (`refreshToken` cookie + response body): 30 days (rotated on use)

The `authenticate` middleware checks the `Authorization: Bearer <token>` header first, then falls back to the `accessToken` cookie. The `/auth/refresh` endpoint reads the refresh token from the request body or the `refreshToken` cookie.

### Authentication Flow

1. **Register** (`POST /auth/register`) — Creates a user with firstName + lastName + email + password. Requires Turnstile CAPTCHA. Returns JWT tokens + sets HttpOnly cookies.
2. **Login** (`POST /auth/login`) — Validates credentials + account status. Returns access token (7d) + refresh token (30d) + sets cookies.
3. **Token Refresh** (`POST /auth/refresh`) — Rotates refresh token (old one revoked in Redis). Detects token reuse and revokes ALL tokens. Sets new cookies.
4. **Logout** (`POST /auth/logout`) — Revokes the refresh token in Redis and clears cookies.

### Account Statuses

| Status | Meaning |
|--------|---------|
| `active` | Normal account |
| `inactive` | Account not active |
| `flagged` | Under review for suspicious activity |
| `banned` | Permanently blocked |

### Google OAuth

- **`GET /auth/google`** — Redirects to Google consent screen
- **`GET /auth/google/callback?code=...`** — Handles OAuth callback, creates/links user, sets cookies, redirects to frontend
- **`GET /auth/google/url`** — Returns OAuth URL as JSON (for popup-based flows)
- **`POST /auth/google/link`** — Links a Google account to the currently logged-in user

Google users are created without a password. If a user already exists with the same email, their account is linked to Google (both email-password and Google sign-in work). Google-only accounts are blocked from using email-password login or password reset.

### Email OTP Verification

- **`POST /auth/otp/send`** (auth required) — Generates 6-digit OTP, stores in Redis (10min TTL), sends via email
- **`POST /auth/otp/verify`** (auth required) — Verifies OTP against Redis, marks `isEmailVerified: true`

Security: 60s cooldown between sends, max 5 verify attempts, OTP invalidated after too many failures.

### KYC (Know Your Customer)

- **`PUT /auth/kyc`** (auth required) — Update PAN, bank account, IFSC, UPI. All fields encrypted at rest with AES-256-GCM.
- **`GET /auth/kyc/status`** (auth required) — Returns verification status + which fields exist (booleans only)
- **`GET /auth/kyc/details`** (auth required) — Returns decrypted values (self only)

KYC fields reset to `pending` when any value changes. Validation: PAN (ABCDE1234F), IFSC (HDFC0001234), UPI (user@handle), bank account (9-18 digits).

### Password Reset

- **`POST /auth/forgot-password`** — Sends reset link via email (no email enumeration — always returns success)
- **`POST /auth/reset-password`** — Resets password using token from email, revokes all sessions

Reset tokens are `crypto.randomBytes(32)` hex strings stored in Redis (15min TTL). Google-only accounts are excluded.

### Admin Login

- **`POST /admin/auth/login`** — Same as `/auth/login` but also verifies the user has `admin` or `creator` role. Sets cookies + returns tokens.

### Token Security

- Access token: 7 days (JWT, set as HttpOnly cookie)
- Refresh token: 30 days (JWT, rotated on each use, set as HttpOnly cookie)
- Redis-backed revocation list for logout + password change
- Token reuse detection: using a revoked token revokes ALL sessions

### Rate Limiting

All limiters are **per-IP** fixed-window counters on Upstash Redis (shared across instances).

| Endpoint | Limit | Window |
|----------|-------|--------|
| Login | 5 | 1 minute |
| Register | 3 | 1 minute |
| Refresh | 10 | 1 minute |
| Forgot Password | 3 | 1 minute |
| Reset Password | 5 | 1 minute |
| OTP Send | 5 | 1 minute |
| OTP Verify | 5 | 1 minute |

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 4000 | Server port |
| `NODE_ENV` | No | development | Environment (development, production, test) |
| `MONGODB_URI` | No* | mongodb://localhost:27017/skillcontest | MongoDB connection |
| `UPSTASH_REDIS_REST_URL` | No* | — | Upstash Redis REST URL (cache, OTP, rate limits, tokens, jobs) |
| `UPSTASH_REDIS_REST_TOKEN` | No* | — | Upstash Redis REST token |
| `JWT_SECRET` | No* | dev-only | JWT signing key |
| `JWT_REFRESH_SECRET` | No* | dev-only | Refresh token signing key |
| `ENCRYPTION_KEY` | No* | dev-only | AES-256-GCM encryption key |
| `CORS_ORIGINS` | No | http://localhost:3000,http://localhost:3001 | Comma-separated allowed CORS origins |
| `FRONTEND_URL` | No | http://localhost:3000 | Primary frontend URL for OAuth redirects |
| `TURNSTILE_SECRET` | No* | dev-only | Cloudflare Turnstile secret |
| `GOOGLE_CLIENT_ID` | For Google OAuth | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | For Google OAuth | — | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | No | http://localhost:4000/auth/google/callback | Google OAuth redirect URI |
| `GITHUB_CLIENT_ID` | For GitHub OAuth | — | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | For GitHub OAuth | — | GitHub OAuth client secret |
| `GITHUB_CALLBACK_URL` | No | http://localhost:4000/auth/github/callback | GitHub OAuth redirect URI |
| `EMAIL_USER` | For email | — | Gmail address for sending emails |
| `EMAIL_APP_PASSWORD` | For email | — | Gmail app password (16 chars) |
| `R2_ACCOUNT_ID` | For avatars | — | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | For avatars | — | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | For avatars | — | Cloudflare R2 secret key |
| `R2_PUBLIC_BUCKET` | No | skillshill-avatars | R2 bucket name |
| `R2_PUBLIC_URL` | No | https://pub-xxxxx.r2.dev | R2 bucket public URL |
| `RAZORPAY_KEY_ID` | For payments | — | Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | For payments | — | Razorpay key secret |
| `RAZORPAY_WEBHOOK_SECRET` | For webhooks | — | Razorpay webhook secret |

*\*Has a dev-only default. **Must be changed in production.***
