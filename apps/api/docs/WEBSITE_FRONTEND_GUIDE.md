# SkillHill API — Website Frontend Guide

> **For website frontend developers implementing user-facing features.**
> Last updated: August 2026 | API Version: 0.5.0

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Auth — Email/Password](#2-auth--emailpassword)
3. [Auth — Profile & Session](#3-auth--profile--session)
4. [Auth — Google OAuth](#4-auth--google-oauth)
5. [Auth — GitHub OAuth](#5-auth--github-oauth)
6. [Auth — Email OTP](#6-auth--email-otp)
7. [Auth — Password Reset](#7-auth--password-reset)
8. [Auth — KYC Details](#8-auth--kyc-details)
9. [Contests](#9-contests)
10. [Problems](#10-problems)
11. [Submissions](#11-submissions)
12. [Leaderboard](#12-leaderboard)
13. [Prizes](#13-prizes)
14. [Wallet](#14-wallet)
15. [Payments](#15-payments)
16. [Languages](#16-languages)
17. [Site Content](#17-site-content)
18. [Health](#18-health)
19. [Error Reference](#19-error-reference)
20. [Environment Variables](#20-environment-variables)
21. [Schema Reference](#21-schema-reference)
22. [Implementation Order](#22-implementation-order)

---

## 1. Getting Started

### Base URL

```
Development: http://localhost:4000
Production:  https://api.skillshill.com
```

### Authentication

Tokens are stored in **HttpOnly, Secure (prod), SameSite=Lax cookies** and also returned in the response body for backward compatibility.

- **Access token** — 7 days, sent via `accessToken` cookie or `Authorization: Bearer <token>` header
- **Refresh token** — 30 days, sent via `refreshToken` cookie or in request body

The `authenticate` middleware checks the `Authorization` header first, then falls back to the `accessToken` cookie. The refresh endpoint reads from the request body first, then falls back to the `refreshToken` cookie.

### Token Flow

| Token | Lifetime | Storage |
|-------|----------|---------|
| `accessToken` | 7 days | HttpOnly cookie + response body (`Authorization` header also accepted) |
| `refreshToken` | 30 days | HttpOnly cookie + response body (rotated on use) |

When the access token expires, call `/auth/refresh` with the refresh token (in body or cookie) to get a new pair.

### Standard Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Human-readable message"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Human-readable error",
  "code": "MACHINE_READABLE_CODE",
  "message": "Optional developer message"
}
```

### Money Units

All monetary values (`entryFee`, `prizePool`, `amount`, `balance`, `prizeAmount`, wallet fields) are in **paise** — 1 INR = 100 paise. Convert with `(paise / 100)` for display.

### Rate Limiting

Auth and contest endpoints are rate-limited per IP (or per user) using fixed-window counters on Upstash Redis:

| Endpoint | Limit |
|----------|-------|
| Register | 3 requests/minute |
| Login (also admin login) | 5 requests/minute |
| Refresh | 10 requests/minute |
| Forgot Password | 3 requests/minute |
| Reset Password | 5 requests/minute |
| OTP Send | 5 requests/minute (plus a 60-second per-user cooldown → `OTP_COOLDOWN`) |
| OTP Verify | 5 requests/minute |
| Join contest | 3 requests/60s per user |
| Submit code | 1 request/30s per (user, problem) |

On limit: `429` with `Retry-After` header and body `{ "success": false, "error": "...", "retryAfterSeconds": <n> }`.

---

## 2. Auth — Email/Password

### POST /auth/register

**What it does:** Creates a new user account with email and password. Returns JWT tokens for immediate login.

**Auth required:** No (but requires Turnstile CAPTCHA token)

**Request body:**
```json
{
  "firstName": "John",           // required, 1-50 chars
  "lastName": "Doe",             // required, 1-50 chars
  "email": "john@example.com",   // required, valid email
  "password": "secret123",       // required, min 8 chars, max 128 chars
  "turnstileToken": "0."         // required, Cloudflare Turnstile token
}
```

**Success (201):**
```json
{
  "success": true,
  "data": {
    "user": { /* User object */ },
    "tokens": { "accessToken": "eyJ...", "refreshToken": "eyJ...", "expiresIn": 604800 }
  },
  "message": "Registration successful"
}
```

**Error codes:** `TURNSTILE_FAILED` (400), `EMAIL_EXISTS` (409)

**Frontend notes:**
- Show a Cloudflare Turnstile widget on the registration form and include the token
- Store both tokens on success, redirect to dashboard
- firstName/lastName: letters, spaces, hyphens, and apostrophes only

---

### POST /auth/login

**What it does:** Authenticates with email and password. Returns JWT tokens.

**Auth required:** No (requires Turnstile)

**Request body:**
```json
{
  "email": "john@example.com",
  "password": "secret123",
  "turnstileToken": "0."
}
```

**Error codes:**

| Code | Status | Meaning |
|------|--------|---------|
| `TURNSTILE_FAILED` | 400 | CAPTCHA failed |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password (generic message) |
| `ACCOUNT_BANNED` | 403 | Banned — show "contact support" |
| `ACCOUNT_FLAGGED` | 403 | Under review — show "contact support" |
| `NO_PASSWORD_SET` | 400 | OAuth-only account — tell user to use Google/GitHub sign-in |

**Frontend notes:**
- Check `accountStatus` on returned user to handle banned/flagged
- The 401 message is intentionally generic to prevent email enumeration
- `NO_PASSWORD_SET` means the user registered via Google/GitHub — offer them the option to set a password via `/auth/set-password`

---

### POST /auth/refresh

**What it does:** Exchanges a refresh token for a new access+refresh token pair (rotation).

**Auth required:** No

**Request body:**
```json
{ "refreshToken": "eyJ..." }
```

**Success (200):** Returns new `user` + `tokens` (note: `expiresIn` here is `900` seconds).

**Error codes:** `INVALID_REFRESH_TOKEN` (401), `TOKEN_REVOKED` (401 — all sessions revoked, re-login required)

**Frontend notes:**
- Implement an axios/fetch interceptor that catches 401 errors and auto-calls `/auth/refresh`
- If refresh also fails (401), redirect to login
- Always store the new refresh token (rotation invalidates the old one)

---

### POST /auth/logout

**What it does:** Revokes the specified refresh token.

**Auth required:** Yes

**Request body:**
```json
{ "refreshToken": "eyJ..." }
```

**Success:** `200` with null data.

**Frontend notes:** Clear tokens from storage after success, redirect to login.

---

## 3. Auth — Profile & Session

### GET /auth/me

**What it does:** Returns the full profile of the currently authenticated user.

**Auth required:** Yes

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "64a1b2c3...",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "phoneCountryCode": "+91",
    "isEmailVerified": false,
    "isPhoneVerified": false,
    "accountStatus": "active",
    "role": "user",
    "status": "published",
    "authProvider": "email",
    "googleId": null,
    "githubId": null,
    "avatarUrl": null,
    "panVerified": false,
    "kycStatus": "pending",
    "walletBalance": 0,
    "lastLoginAt": "2026-07-19T10:30:00.000Z",
    "createdAt": "2026-07-19T10:30:00.000Z",
    "updatedAt": "2026-07-19T10:30:00.000Z"
  }
}
```

**Frontend notes:**
- Call on app mount to check login state and load profile
- Check `accountStatus` for banned/flagged
- Check `isEmailVerified` to prompt email verification
- Data is cached server-side for 60 seconds (invalidated on profile/status changes)

---

### PUT /auth/me

**What it does:** Updates profile fields. Supports avatar image upload via `multipart/form-data`.

**Auth required:** Yes

**Content-Type:** `multipart/form-data`

**Form fields:**

| Field | Type | Notes |
|-------|------|-------|
| `firstName` | string | Optional, 1-50 chars |
| `lastName` | string | Optional, 1-50 chars |
| `phone` | string | Optional, 5-15 digits. Send empty to clear |
| `phoneCountryCode` | string | Optional, format: +91 |
| `avatar` | file | Optional, JPEG/PNG/WebP, max 5MB |

**Frontend notes:**
- Use `FormData` to build the request (not JSON)
- Avatar is compressed server-side to WebP 400×400px → Cloudflare R2
- `avatarUrl` on user object will contain the public URL after upload
- Only send fields that changed — omitted fields left unchanged
- Clearing `phone` resets `isPhoneVerified` to `false`

**Example (React/JS):**
```javascript
const formData = new FormData()
formData.append('firstName', 'John')
formData.append('avatar', fileInput.files[0])

fetch('/auth/me', {
  method: 'PUT',
  headers: { Authorization: `Bearer ${accessToken}` },
  body: formData,
})
```

---

### DELETE /auth/me

**What it does:** Soft-deletes your account. Sets `deletedAt`, marks inactive, revokes all sessions.

**Auth required:** Yes

**Success:** `200` with null data.

**Error codes:** `ALREADY_DELETED` (400)

**Frontend notes:**
- Show a confirmation dialog before calling
- On success, clear all tokens and redirect to home
- Account can be restored by an admin — this is NOT permanent

---

### GET /auth/check

**What it does:** Lightweight session validation. Returns essential user info.

**Auth required:** Yes

**Success (200):**
```json
{
  "success": true,
  "data": {
    "userId": "64a1b2c3...",
    "email": "john@example.com",
    "role": "user",
    "accountStatus": "active",
    "isEmailVerified": false
  }
}
```

**Frontend notes:**
- Call on every protected route mount to verify session validity
- Check `accountStatus === "active"` — redirect to appropriate page if banned/flagged
- Redirect to login if 401 is returned

---

### POST /auth/set-password

**What it does:** Sets or changes your password.
- **OAuth users (Google/GitHub):** Adds email-password login as an alternative
- **Email users:** Changes existing password (requires `currentPassword`)

**Auth required:** Yes

**Request body:**
```json
{
  "password": "newPassword123",      // required, min 8 chars
  "currentPassword": "oldPassword"   // required WHEN changing existing password
}
```

**Error codes:** `PASSWORD_TOO_SHORT` (400), `CURRENT_PASSWORD_REQUIRED` (400), `INVALID_CURRENT_PASSWORD` (401)

**Frontend notes:**
- OAuth-only users: show "Set Password" form (no currentPassword field)
- Email users: show "Change Password" form (both fields)
- On success, user can log in with either OAuth or email-password

---

## 4. Auth — Google OAuth

### OAuth Flow (Popup)

1. Call `GET /auth/google/url` to get the Google consent URL
2. Open the URL in a popup window
3. User consents on Google → Google redirects to `GET /auth/google/callback`
4. Callback sets HttpOnly cookies on the API domain and redirects to `{FRONTEND_URL}/auth/callback?isNewUser=...`
5. The browser automatically sends the cookies on subsequent API calls — no manual token storage needed
6. Call `GET /auth/check` to verify the session

### Available Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/auth/google` | No | Redirects to Google consent screen |
| `GET` | `/auth/google/url` | No | Returns consent URL as JSON (for popups) |
| `GET` | `/auth/google/callback?code=...` | No | Handles OAuth callback, sets cookies, redirects to frontend |
| `POST` | `/auth/google/link` | Yes | Links Google account to existing logged-in user |

### Account Linking

After logging in, users can link their Google account via `POST /auth/google/link`:
1. Open Google OAuth popup (same as sign-in flow)
2. Get the `code` from the callback URL
3. Send `{ "code": "..." }` to `/auth/google/link`
4. User can now sign in with either email/password or Google

**Error codes:** `GOOGLE_ALREADY_LINKED` (409)

---

## 5. Auth — GitHub OAuth

GitHub OAuth follows the exact same pattern as Google OAuth. The frontend integration is identical.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/auth/github` | No | Redirects to GitHub consent screen |
| `GET` | `/auth/github/url` | No | Returns consent URL as JSON |
| `GET` | `/auth/github/callback?code=...` | No | Handles callback, sets cookies, redirects to frontend |
| `POST` | `/auth/github/link` | Yes | Links GitHub account to existing user |

**Note:** GitHub may not expose the user's public email. The server fetches the primary email via GitHub's API automatically.

---

## 6. Auth — Email OTP

### POST /auth/otp/send

**What it does:** Sends a 6-digit OTP to the authenticated user's email for verification.

**Auth required:** Yes

**Request body:** None (uses authenticated user's email)

**Success (200):**
```json
{
  "success": true,
  "data": { "expiresInSeconds": 600 },
  "message": "OTP sent to your email"
}
```

**Error codes:** `OTP_COOLDOWN` (429) with `cooldown` (seconds), `EMAIL_ALREADY_VERIFIED` (400)

**Frontend notes:**
- Show a 60-second countdown before allowing re-send
- OTP expires in 10 minutes

---

### POST /auth/otp/verify

**What it does:** Verifies the 6-digit OTP. On success, marks email as verified.

**Auth required:** Yes

**Request body:**
```json
{ "otp": "482913" }  // exactly 6 digits
```

**Error codes:**

| Code | Status | Meaning |
|------|--------|---------|
| `OTP_EXPIRED` | 410 | OTP expired — request a new one |
| `OTP_TOO_MANY_ATTEMPTS` | 429 | 5 incorrect attempts, OTP invalidated |
| `INVALID_OTP` | 400 | Wrong OTP — response includes `remainingAttempts` |

**Frontend notes:**
- Show remaining attempts count to the user
- On `OTP_EXPIRED` or `OTP_TOO_MANY_ATTEMPTS`, prompt to request a new OTP

---

## 7. Auth — Password Reset

### POST /auth/forgot-password

**What it does:** Sends a password reset link to the user's email. Always returns the same message (prevents email enumeration).

**Auth required:** No (requires Turnstile)

**Request body:**
```json
{
  "email": "john@example.com",
  "turnstileToken": "0."
}
```

**Success response:**
```json
{
  "success": true,
  "data": null,
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Frontend notes:**
- Show the same success message regardless of whether the email exists
- Reset link format: `{FRONTEND_URL}/auth/reset-password?token=...&email=...`
- Link expires in 15 minutes

---

### POST /auth/reset-password

**What it does:** Resets password using the token from the email. Revokes all sessions.

**Auth required:** No

**Request body:**
```json
{
  "email": "john@example.com",   // from reset link
  "token": "abc123...",           // from reset link
  "password": "newPassword123"    // min 8 chars
}
```

**Error codes:** `PASSWORD_TOO_SHORT` (400), `RESET_TOKEN_INVALID` (410)

**Frontend notes:**
- After success, redirect to login (all sessions revoked)
- The reset token is a hex string from URL query params

---

## 8. Auth — KYC Details

### PUT /auth/kyc

**What it does:** Updates your KYC details (PAN, bank account, IFSC, UPI). Sensitive fields are AES-256-GCM encrypted. Resets `kycStatus` to `pending` for admin re-verification.

**Auth required:** Yes

**Request body:**
```json
{
  "panNumber": "ABCDE1234F",           // optional, format: ABCDE1234F
  "bankAccountNumber": "123456789012", // optional, 9-18 digits
  "ifscCode": "HDFC0001234",          // optional, format: HDFC0001234
  "upiId": "user@paytm"               // optional, format: username@handle
}
```

At least one field required.

**Frontend notes:**
- Only send fields that changed — omitted fields are left unchanged
- Use `GET /auth/kyc/status` to show progress indicators
- Admin must approve KYC before `kycStatus` becomes `verified`

---

### GET /auth/kyc/status

**What it does:** Returns which KYC fields are submitted and the current status. Does NOT return actual encrypted values.

**Auth required:** Yes

**Success (200):**
```json
{
  "success": true,
  "data": {
    "panVerified": false,
    "kycStatus": "pending",
    "hasPan": true,
    "hasBankAccount": false,
    "hasIfsc": false,
    "hasUpiId": true
  }
}
```

**Frontend notes:**
- Use `has*` booleans to show which fields have been filled
- Use `kycStatus` to show overall progress: pending → verified → rejected
- Cached server-side for 60 seconds

---

### GET /auth/kyc/details

**What it does:** Returns your own KYC details decrypted (self only). PAN, bank account, IFSC, UPI values.

**Auth required:** Yes

**Success (200):**
```json
{
  "success": true,
  "data": {
    "panNumber": "ABCDE1234F",
    "bankAccountNumber": "123456789012",
    "ifscCode": "HDFC0001234",
    "upiId": "user@paytm",
    "panVerified": false,
    "kycStatus": "pending"
  }
}
```

**Frontend notes:**
- Use for edit mode or when user needs to see their data
- For read-only status display, prefer the lighter `/auth/kyc/status` endpoint

---

## 9. Contests

### GET /contests

**What it does:** Lists contests with live participant counts. Sorted by `startTime` ascending.

**Auth required:** No (optional auth — logged-in viewers get no extra data here, but non-staff cannot request draft/cancelled)

**Query parameters:**

| Param | Type | Default | Values |
|-------|------|---------|--------|
| `status` | string | `active` | `active`, `upcoming`, `settled`, `frozen`, `cancelled`, `draft` |
| `page` | int | 1 | ≥ 1 |
| `limit` | int | 20 | 1–100 |

**Success (200):**
```json
{
  "success": true,
  "data": {
    "contests": [
      { "contest": { /* Contest object */ }, "participantCount": 42 }
    ],
    "total": 57,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

**Error codes:**
| Code | Status | Meaning |
|------|--------|---------|
| `VALIDATION_ERROR` | 400 | Bad query value (e.g. invalid status) |
| `FORBIDDEN_STATUS` | 403 | Non-staff requested `draft` or `cancelled` |

**Frontend notes:**
- `active` = currently running (startTime ≤ now ≤ endTime); `upcoming` = not started yet
- `draft`/`cancelled` lists are staff-only (403 for regular users)
- `problemIds` is a raw array of IDs — fetch problems via `/contests/:id` or `/contests/:contestId/problems`

---

### GET /contests/:id

**What it does:** Returns a single contest with its problems **populated** (sorted by `order`, hidden test data stripped).

**Auth required:** No (optional auth)

**Success (200):**
```json
{
  "success": true,
  "data": {
    "_id": "64a1b2c3...",
    "title": "Weekly Sprint",
    "slug": "weekly-sprint",
    "description": "...",
    "problemIds": [ /* Problem objects, hidden test cases + correctAnswer removed */ ],
    "startTime": "2026-08-01T10:00:00.000Z",
    "endTime": "2026-08-01T12:00:00.000Z",
    "type": "paid",
    "entryFee": 2000,
    "prizePool": 50000,
    "maxParticipants": 100,
    "status": "active",
    "rules": "...",
    "createdBy": "64a1b2c3...",
    "createdAt": "...", "updatedAt": "..."
  }
}
```

**Error codes:** `CONTEST_NOT_FOUND` (404 — also returned for draft contests when the viewer is not staff; no leak)

---

### POST /contests/:id/join

**What it does:** Joins a contest. For paid contests, atomically deducts `entryFee` from the user's wallet (and refunds it if participation creation fails).

**Auth required:** Yes

**Rate limit:** 3 requests/60s per user

**Request body:**
```json
{ "turnstileToken": "0." }   // required, Cloudflare Turnstile
```

**Success (201):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "userId": "64a1b2c3...",
    "contestId": "64a1b2c3...",
    "joinedAt": "...",
    "startedAt": null,
    "submittedAt": null,
    "totalScore": 0,
    "rank": null,
    "status": "registered",
    "createdAt": "...", "updatedAt": "..."
  },
  "message": "Joined contest"
}
```

**Error codes:**
| Code | Status | Meaning |
|------|--------|---------|
| `TURNSTILE_FAILED` | 400 | CAPTCHA failed |
| `CONTEST_NOT_FOUND` | 404 | Contest doesn't exist |
| `CONTEST_NOT_ACTIVE` | 400 | Contest not accepting participants |
| `ALREADY_JOINED` | 409 | Already a participant |
| `CONTEST_FULL` | 400 | Reached `maxParticipants` |
| `INSUFFICIENT_BALANCE` | 400 | Paid contest, not enough wallet balance |
| `WALLET_FROZEN` | 403 | Wallet is frozen |

**Frontend notes:**
- Show Turnstile widget on the join button/dialog
- For paid contests, show the wallet balance and entry fee before confirming
- On `429`, show the `retryAfterSeconds` countdown

---

### POST /contests/:id/start

**What it does:** Marks your participation as started (`registered → started`). One-time transition; only while the contest is `active`.

**Auth required:** Yes

**Request body:** None

**Success (200):** Returns the Participation object with `status: "started"` and `startedAt` set to server time. Message: `"Contest started"`.

**Error codes:**
| Code | Status | Meaning |
|------|--------|---------|
| `CONTEST_NOT_FOUND` | 404 | Contest doesn't exist |
| `CONTEST_NOT_ACTIVE` | 400 | Contest is not running |
| `NOT_JOINED` | 403 | Join the contest before starting it |
| `ALREADY_STARTED` | 400 | Participation already started/completed |

**Frontend notes:** Start the contest timer when this succeeds; store the `startedAt` value for display.

---

## 10. Problems

### GET /problems

**What it does:** Lists practice problems from the public practice library. Only problems whose contest is `active`, `frozen`, or `settled` are visible.

**Auth required:** No (optional auth)

**Query parameters:**

| Param | Type | Values |
|-------|------|--------|
| `difficulty` | string | `easy`, `medium`, `hard` |
| `type` | string | `coding`, `mcq` |
| `search` | string | Case-insensitive title search, max 100 chars |
| `language` | string | Language key, max 50 chars |
| `page` | int | ≥ 1 (default 1) |
| `limit` | int | 1–100 (default 20) |

**Success (200):**
```json
{
  "success": true,
  "data": {
    "problems": [
      {
        "_id": "...",
        "title": "Two Sum",
        "description": "...",
        "type": "coding",
        "difficulty": "easy",
        "points": 100,
        "timeLimit": 2000,
        "memoryLimit": 256,
        "languageSupport": ["javascript"],
        "solutionTemplate": { "javascript": "..." },
        "testCases": [ { "input": "1 2", "expectedOutput": "3", "isPublic": true } ],
        "status": "published",
        "contestId": { "_id": "...", "title": "Weekly Sprint", "slug": "weekly-sprint", "status": "active", "type": "paid", "entryFee": 2000 }
      }
    ],
    "total": 12,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Frontend notes:** Public problem payloads never include hidden test cases or `correctAnswer`.

---

### GET /problems/:id

**What it does:** Returns one practice problem (same public-safe shape as above, `contestId` populated).

**Auth required:** No

**Error codes:** `PROBLEM_NOT_FOUND` (404 — also returned for problems whose contest is draft/cancelled; no status leak)

---

### GET /contests/:contestId/problems

**What it does:** Lists all problems of a contest (works for contests in any status, hidden data stripped).

**Auth required:** No (optional auth)

**Query parameters:**

| Param | Type | Notes |
|-------|------|-------|
| `includeHidden` | string | Only the literal `"true"` enables it. **Staff only** (admin/creator) |

**Error codes:** `CONTEST_NOT_FOUND` (404), `403` (non-staff + `includeHidden=true`)

---

### GET /contests/:contestId/problems/:problemId

**What it does:** Returns one contest problem.

**Auth required:** No (optional auth)

**Query parameters:** `includeHidden` — same semantics as above (staff only).

**Error codes:** `PROBLEM_NOT_FOUND` (404), `403` (non-staff + `includeHidden=true`)

---

## 11. Submissions

### POST /contests/:contestId/submissions

**What it does:** Submits code (or an MCQ answer) for judging. Enqueues the judge job and returns immediately (202).

**Auth required:** Yes

**Rate limit:** 1 request/30s per (user, problem)

**Request body:**
```json
{
  "problemId": "64a1b2c3...",     // required, problem in this contest
  "language": "javascript",       // required for coding problems (language key); omit for MCQ
  "code": "console.log('hi')"     // required, max 200000 chars. For MCQ: the chosen option index as a string (e.g. "2")
}
```

**Success (202):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "userId": "...",
    "contestId": "...",
    "problemId": "...",
    "language": "javascript",
    "code": "console.log('hi')",
    "status": "pending",
    "testResults": [],
    "publicPassed": 0, "publicTotal": 0,
    "hiddenPassed": 0, "hiddenTotal": 0,
    "totalScore": 0,
    "executionTime": 0,
    "memoryUsed": 0,
    "compilerOutput": null,
    "submittedAt": "...",
    "judgedAt": null,
    "createdAt": "...", "updatedAt": "..."
  },
  "message": "Submission queued for judging"
}
```

**Error codes:**
| Code | Status | Meaning |
|------|--------|---------|
| `CONTEST_NOT_FOUND` | 404 | Contest doesn't exist |
| `CONTEST_NOT_ACTIVE` | 400 | Contest not accepting submissions |
| `NOT_JOINED` | 403 | Join the contest before submitting |
| `PROBLEM_NOT_FOUND` | 404 | Problem not in this contest |
| `INVALID_MCQ_ANSWER` | 400 | MCQ answer index out of range |
| `LANGUAGE_REQUIRED` | 400 | Coding problem needs a language |
| `UNSUPPORTED_LANGUAGE` | 400 | Language key unknown/disabled |

**Frontend notes:**
- Live status updates arrive over **Socket.IO** (see below)
- MCQ: send the chosen option index (0-based) as the `code` string; `language` is ignored
- Submission `status` lifecycle: `pending → running → accepted | rejected | error | timeout`
- Scoring: `round(points × (0.3 × publicRatio + 0.7 × hiddenRatio))` — only final `accepted`/`rejected` updates your participation score (best score wins)

### Socket.IO Events

Connect to `/` with the access token cookie (or `auth.token` in the handshake). Events emitted by the server:

| Event | Payload |
|-------|---------|
| `submissionQueued` | Submission object |
| `submissionRunning` | Submission object |
| `submissionCompleted` | Submission object (judged, final) |

**Frontend notes:** Listen for `submissionCompleted` for the submission id you submitted; update the submission row with the result.

---

### GET /contests/:contestId/submissions

**What it does:** Lists the **current user's** submissions for a contest, newest first. No pagination.

**Auth required:** Yes

**Success (200):** `data` = array of Submission objects (shape above).

---

### GET /contests/:contestId/submissions/:submissionId

**What it does:** Returns one submission (owner or staff only). `testResults` contains only public test cases.

**Auth required:** Yes

**Error codes:** `SUBMISSION_NOT_FOUND` (404), `FORBIDDEN` (403 — not the owner and not staff)

---

## 12. Leaderboard

### GET /contests/:contestId/leaderboard

**What it does:** Public leaderboard. Only participations with `submittedAt` set are ranked. Ties on (score, submission time) share a rank (1, 1, 3).

**Auth required:** No (optional auth)

**Query parameters:** `limit` — int, 1–100, default 100.

**Success (200):**
```json
{
  "success": true,
  "data": {
    "contestId": "64a1b2c3...",
    "returned": 25,
    "entries": [
      {
        "rank": 1,
        "userId": "64a1b2c3...",
        "totalScore": 500,
        "submittedAt": "2026-08-01T11:00:00.000Z",
        "user": { "firstName": "John", "lastName": "Doe", "avatarUrl": null }
      }
    ]
  }
}
```

**Error codes:** `CONTEST_NOT_FOUND` (404 — also for draft/cancelled contests when the viewer is not staff)

---

### GET /contests/:contestId/leaderboard/me

**What it does:** Returns the current user's rank and score in a contest.

**Auth required:** Yes

**Success (200):**
```json
{
  "success": true,
  "data": {
    "contestId": "64a1b2c3...",
    "participated": true,
    "submitted": false,
    "rank": null,
    "totalScore": 0
  }
}
```

`rank` is null until the user has submitted; `totalScore` is 0 when not participated.

**Error codes:** `CONTEST_NOT_FOUND` (404)

---

## 13. Prizes

### GET /contests/:id/prizes

**What it does:** Prize breakdown for a contest: pool size, platform fee, share structure (ranks 1–10), and winners once settled.

**Auth required:** No (optional auth)

**Success (200):**
```json
{
  "success": true,
  "data": {
    "contestId": "64a1b2c3...",
    "type": "paid",
    "participantCount": 40,
    "pool": 80000,
    "netPool": 72000,
    "platformFeeRate": 0.1,
    "structure": [
      { "rank": 1, "share": 0.4, "amount": 28800 },
      { "rank": 2, "share": 0.25, "amount": 18000 }
    ],
    "winners": [
      {
        "rank": 1,
        "prizeAmount": 28800,
        "status": "credited",
        "userId": "64a1b2c3...",
        "user": { "firstName": "John", "lastName": "Doe", "avatarUrl": null }
      }
    ]
  }
}
```

**Notes:**
- Share table: 1st 40%, 2nd 25%, 3rd 15%, 4th 5%, 5th 5%, 6th–10th 2% each (of the net pool)
- `pool = entryFee × participantCount` (0 for free contests); `netPool = floor(pool × (1 − platformFeeRate))`
- `winners` is empty until the contest is settled; ties split the rank's share

**Error codes:** `CONTEST_NOT_FOUND` (404 — also for draft/cancelled when not staff)

---

### GET /prizes/recent

**What it does:** Recent credited winners (public "winners wall").

**Auth required:** No

**Query parameters:** `limit` — int, 1–50, default 10.

**Success (200):** `data` = array, newest credited first:
```json
[
  {
    "rank": 1,
    "prizeAmount": 28800,
    "creditedAt": "2026-08-02T10:00:00.000Z",
    "user": { "firstName": "John", "lastName": "Doe", "avatarUrl": null },
    "contest": { "title": "Weekly Sprint", "slug": "weekly-sprint" }
  }
]
```

---

### GET /prizes

**What it does:** The current user's prize history (paginated, newest first).

**Auth required:** Yes

**Query parameters:** `page` (default 1), `limit` (1–100, default 20).

**Success (200):**
```json
{
  "success": true,
  "data": {
    "prizes": [
      {
        "_id": "...",
        "contestId": { "_id": "...", "title": "Weekly Sprint", "slug": "weekly-sprint" },
        "userId": "64a1b2c3...",
        "rank": 1,
        "prizeAmount": 28800,
        "status": "credited",
        "failureReason": null,
        "creditedAt": "2026-08-02T10:00:00.000Z",
        "createdAt": "...", "updatedAt": "..."
      }
    ],
    "total": 3,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

Prize `status` enum: `pending | credited | failed`.

---

## 14. Wallet

> The wallet is the central ledger. All amounts in paise. Wallet is lazily created on first access. Credits happen via Razorpay webhook (`payment.captured`) — never by calling an API directly.

### GET /wallet/balance

**What it does:** Current wallet balance and lifetime totals.

**Auth required:** Yes

**Success (200):**
```json
{
  "success": true,
  "data": {
    "userId": "64a1b2c3...",
    "balance": 50000,
    "locked": 0,
    "available": 50000,
    "status": "active",
    "totalDeposited": 100000,
    "totalWithdrawn": 0,
    "totalWon": 28800,
    "totalSpentOnFees": 2000
  }
}
```

**Frontend notes:** `available = balance - locked`. Show `available` as spendable.

---

### GET /wallet/transactions

**What it does:** Paginated transaction history, newest first.

**Auth required:** Yes

**Query parameters:**

| Param | Type | Values |
|-------|------|--------|
| `type` | string | `deposit`, `contest_fee`, `prize`, `refund`, `withdrawal` |
| `page` | int | ≥ 1 (default 1) |
| `limit` | int | 1–100 (default 20) |

**Success (200):**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "_id": "...",
        "userId": "64a1b2c3...",
        "type": "contest_fee",
        "amount": 2000,
        "balanceBefore": 50000,
        "balanceAfter": 48000,
        "referenceType": "contest",
        "referenceId": "64a1b2c3...",
        "description": "Entry fee for Weekly Sprint",
        "status": "completed",
        "createdAt": "2026-08-01T09:00:00.000Z"
      }
    ],
    "total": 24,
    "page": 1,
    "limit": 20,
    "totalPages": 2
  }
}
```

Transaction `status` enum: `completed | pending | failed`.

---

### POST /wallet/deposit

**What it does:** Creates a Razorpay order to add money to the wallet. **The wallet is credited only after the Razorpay webhook confirms capture.** Thin wrapper over `POST /payments/create-order` with `purpose: "deposit"`.

**Auth required:** Yes

**Request body:**
```json
{ "amount": 50000 }   // required, integer paise, min 1000 (₹10), max 500000 (₹5000)
```

**Success (200):** Same response shape as `POST /payments/create-order` (see below), message `"Razorpay order created"`.

**Error codes:** `PAYMENTS_NOT_CONFIGURED` (503), `DUPLICATE_ORDER` (409), `PAYMENT_PROVIDER_ERROR` (502)

---

### POST /wallet/withdraw

**What it does:** Withdraws balance to UPI (RazorpayX payout). Requires **verified KYC** (admin-approved).

**Auth required:** Yes

**Request body:**
```json
{
  "amount": 50000,       // required, integer paise, min 10000 (₹100)
  "upiId": "user@paytm"  // optional; falls back to the UPI saved in KYC
}
```

**Success (201):** Returns the withdrawal `IWalletTransaction` doc (`type: "withdrawal"`, `status: "completed"`, `referenceType: "withdrawal"`). Message: `"Withdrawal requested"`.

**Error codes:**
| Code | Status | Meaning |
|------|--------|---------|
| `KYC_REQUIRED` | 403 | KYC not verified — complete KYC first |
| `WALLET_FROZEN` | 403 | Wallet frozen |
| `INSUFFICIENT_BALANCE` | 400 | Balance below amount |
| `WITHDRAWAL_MIN_NOT_MET` | 400 | Below ₹100 minimum |
| `UPI_REQUIRED` | 400 | No UPI id and no UPI saved in KYC |
| `PAYMENTS_NOT_CONFIGURED` | 503 | RazorpayX not configured |

**Frontend notes:** Disable the withdraw button until `kycStatus === "verified" && panVerified`.

---

## 15. Payments

### POST /payments/create-order

**What it does:** Creates a Razorpay order (used for wallet deposits and contest entry payments). The client then runs the Razorpay Checkout with `keyId` + `orderId`; the wallet/entry is credited server-side via webhook.

**Auth required:** Yes

**Request body:**
```json
{
  "amount": 50000,              // required, integer paise, min 1000 (₹10), max 500000 (₹5000)
  "purpose": "deposit",         // optional, "deposit" | "contest", default "deposit"
  "contestId": "64a1b2c3..."    // optional (required when purpose = "contest")
}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "orderId": "order_O6P1cT9...",   // Razorpay order id
    "amount": 50000,
    "currency": "INR",
    "keyId": "rzp_live_...",         // Razorpay public key (for Checkout)
    "paymentId": "64a1b2c3...",      // our Payment record id
    "receipt": "deposit:2c3d:l8x9f0",
    "purpose": "deposit"
  },
  "message": "Razorpay order created"
}
```

**Error codes:**
| Code | Status | Meaning |
|------|--------|---------|
| `PAYMENTS_NOT_CONFIGURED` | 503 | Razorpay env vars missing |
| `INVALID_AMOUNT` | 400 | Amount ≤ 0 |
| `CONTEST_NOT_FOUND` | 404 | `contestId` given but contest missing |
| `FREE_CONTEST` | 400 | `contestId` given but contest is free |
| `DUPLICATE_ORDER` | 409 | Duplicate order attempt (idempotency key collision) |
| `PAYMENT_PROVIDER_ERROR` | 502 | Razorpay API call failed |

**Frontend notes:**
- Open Razorpay Checkout with `keyId`, `orderId`, `amount`, `currency`, and the user's contact/name
- Do NOT call this twice for the same intent — use the returned `paymentId` to track state
- For contest join flow with a pending payment: after capture, call `POST /contests/:id/join`

---

### GET /payments

**What it does:** The current user's payment history, newest first.

**Auth required:** Yes

**Query parameters:** `status` (`created | attempted | paid | failed | refunded`), `page` (default 1), `limit` (1–100, default 20).

**Success (200):**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "_id": "...",
        "userId": "64a1b2c3...",
        "contestId": null,
        "purpose": "deposit",
        "amount": 50000,
        "currency": "INR",
        "status": "paid",
        "razorpayOrderId": "order_O6P1cT9...",
        "razorpayPaymentId": "pay_O6P...",
        "receipt": "deposit:2c3d:l8x9f0",
        "refundId": null,
        "failureReason": null,
        "paidAt": "2026-08-01T10:00:00.000Z",
        "refundedAt": null,
        "createdAt": "...", "updatedAt": "..."
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

Payment `status` enum: `created | attempted | paid | failed | refunded`.

---

## 16. Languages

### GET /languages

**What it does:** Lists supported judge languages, sorted by `order` then `name`. Public callers see only `enabled: true`.

**Auth required:** No (optional auth)

**Query parameters:** `includeDisabled` — only the literal `"true"` enables it; **staff only** (admin/creator), otherwise 403.

**Success (200):** `data` = array of Language objects:
```json
[
  {
    "_id": "...",
    "key": "javascript",
    "name": "JavaScript",
    "version": "Node 20",
    "extension": "js",
    "compileCommand": null,
    "runCommand": "node {file}",
    "dockerImage": "node:20",
    "logoUrl": null,
    "enabled": true,
    "order": 1,
    "createdAt": "...", "updatedAt": "..."
  }
]
```

---

### GET /languages/:key

**What it does:** Returns one language by key. Disabled languages 404 for non-staff.

**Auth required:** No (optional auth)

**Error codes:** `LANGUAGE_NOT_FOUND` (404)

---

## 17. Site Content

Public read endpoints for the marketing site. All write endpoints require admin/creator and are documented in the Admin Panel Guide.

### GET /site/logo

**What it does:** Returns the site logo singleton (auto-created on first call).

**Auth required:** No

**Success (200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "key": "primary",
    "logoUrl": "https://pub-xxx.r2.dev/site/logo/abc.webp",
    "altText": "SkillHill",
    "tagline": "Code. Compete. Win.",
    "createdAt": "...", "updatedAt": "..."
  }
}
```

**Frontend notes:** `logoUrl` may be null (fall back to a text logo).

---

### GET /site/banners

**What it does:** Lists active banners (hero/announcement), sorted by `order` then `createdAt`.

**Auth required:** No (optional auth)

**Query parameters:** `includeInactive` — only `"true"`; staff only, else 403.

**Success (200):** `data` = array:
```json
[
  {
    "_id": "...",
    "title": "Weekly Sprint is live!",
    "subtitle": "₹500 prize pool",
    "imageUrl": "https://pub-xxx.r2.dev/site/banner-abc/123.webp",
    "ctaText": "Join now",
    "ctaLink": "/contests/weekly-sprint",
    "order": 0,
    "active": true,
    "createdAt": "...", "updatedAt": "..."
  }
]
```

---

### GET /site/faqs

**What it does:** Lists active FAQs, sorted by `order` then `createdAt`.

**Auth required:** No (optional auth)

**Query parameters:** `category` (exact match), `includeInactive` (staff only, else 403).

**Success (200):** `data` = array:
```json
[
  {
    "_id": "...",
    "question": "How do prizes work?",
    "answer": "The pool is split...",
    "category": "Prizes",
    "order": 0,
    "active": true,
    "createdAt": "...", "updatedAt": "..."
  }
]
```

---

### GET /site/why-choose-us

**What it does:** Lists active "why choose us" items, sorted by `order` then `createdAt`.

**Auth required:** No (optional auth)

**Query parameters:** `includeInactive` (staff only, else 403).

**Success (200):** `data` = array:
```json
[
  {
    "_id": "...",
    "title": "Real prizes",
    "description": "Win real money...",
    "icon": "🏆",
    "order": 0,
    "active": true,
    "createdAt": "...", "updatedAt": "..."
  }
]
```

---

## 18. Health

### GET /health

**What it does:** Simple health check.

**Success (200):**
```json
{
  "success": true,
  "data": { "status": "ok", "timestamp": "2026-08-17T10:23:21.343Z" }
}
```

---

## 19. Error Reference

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `USER_NOT_FOUND` | 404 | User not found |
| `VALIDATION_ERROR` | 400 | Request body failed validation |
| `NO_TOKEN` | 401 | Authorization header missing |
| `TOKEN_EXPIRED` | 401 | Access token expired (call /auth/refresh) |
| `TOKEN_REVOKED` | 401 | Refresh token revoked (re-login required) |

### Account Status Meanings

| Status | Meaning | Can login? |
|--------|---------|------------|
| `active` | Normal | ✅ Yes |
| `inactive` | Not active / deleted | ❌ No |
| `flagged` | Under review | ❌ No — show "contact support" |
| `banned` | Permanently blocked | ❌ No — show "contact support" |

### Contest / Participation Codes

| Code | Status | Meaning |
|------|--------|---------|
| `CONTEST_NOT_FOUND` | 404 | Contest missing (or draft/cancelled for non-staff) |
| `CONTEST_NOT_ACTIVE` | 400 | Contest not accepting participants/submissions |
| `CONTEST_NOT_DRAFT` | 400 | Draft-only operation on a published contest |
| `CONTEST_FULL` | 400 | Max participants reached |
| `ALREADY_JOINED` | 409 | Already a participant |
| `NOT_JOINED` | 403 | Join before starting/submitting |
| `ALREADY_STARTED` | 400 | Participation already started |
| `FORBIDDEN_STATUS` | 403 | Non-staff requested draft/cancelled list |

### Submission Codes

| Code | Status | Meaning |
|------|--------|---------|
| `PROBLEM_NOT_FOUND` | 404 | Problem missing (or not in this contest) |
| `INVALID_MCQ_ANSWER` | 400 | MCQ option index out of range |
| `LANGUAGE_REQUIRED` | 400 | Coding problem requires a language |
| `UNSUPPORTED_LANGUAGE` | 400 | Language key unknown/disabled |
| `SUBMISSION_NOT_FOUND` | 404 | Submission missing |
| `FORBIDDEN` | 403 | Not the owner and not staff |

### Wallet / Payment Codes

| Code | Status | Meaning |
|------|--------|---------|
| `INSUFFICIENT_BALANCE` | 400 | Wallet balance below required amount |
| `WALLET_FROZEN` | 403 | Wallet frozen (admin action) |
| `KYC_REQUIRED` | 403 | KYC not verified (withdrawal) |
| `WITHDRAWAL_MIN_NOT_MET` | 400 | Below withdrawal minimum |
| `UPI_REQUIRED` | 400 | No UPI destination |
| `PAYMENTS_NOT_CONFIGURED` | 503 | Razorpay env vars missing |
| `DUPLICATE_ORDER` | 409 | Duplicate payment order |
| `PAYMENT_PROVIDER_ERROR` | 502 | Razorpay API failure |

---

## 20. Environment Variables

### Required

```
PORT=4000
MONGODB_URI=mongodb://localhost:27017/skillcontest
UPSTASH_REDIS_REST_URL=<from Upstash console>
UPSTASH_REDIS_REST_TOKEN=<from Upstash console>
JWT_SECRET=<random-64-char-string>
JWT_REFRESH_SECRET=<random-64-char-string>
ENCRYPTION_KEY=<32-char-hex-string>
```

### Google OAuth

```
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
```

### GitHub OAuth

```
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
GITHUB_CALLBACK_URL=http://localhost:4000/auth/github/callback
```

### Email (Gmail App Password)

```
EMAIL_USER=your@gmail.com
EMAIL_APP_PASSWORD=<16-char-app-password>
```

SMTP is hardcoded to Gmail (smtp.gmail.com:587). The EMAIL_USER address is used as the sender.

### Cloudflare Turnstile

```
TURNSTILE_SECRET=0x4AAAAAAA...
```

### Cloudflare R2 (Avatar Uploads)

```
R2_ACCOUNT_ID=<your-account-id>
R2_ACCESS_KEY_ID=<your-access-key>
R2_SECRET_ACCESS_KEY=<your-secret-key>
R2_PUBLIC_BUCKET=skillshill-avatars
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

### Razorpay (Payments, Wallet, Payouts)

```
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=<your-key-secret>
RAZORPAY_WEBHOOK_SECRET=<webhook secret for /webhooks/razorpay>
RAZORPAYX_ACCOUNT_NUMBER=<RazorpayX account for UPI payouts>
```

### Platform

```
PLATFORM_FEE_RATE=0.1
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

---

## 21. Schema Reference

### User

```typescript
{
  _id: string                    // MongoDB ObjectId
  firstName: string              // 1-50 chars
  lastName: string               // 1-50 chars
  fullName: string               // Virtual: firstName + lastName (document responses only)
  email: string                  // Unique, lowercase
  phone: string | null           // 5-15 digits
  phoneCountryCode: string | null // e.g., "+91"
  isEmailVerified: boolean       // Default: false
  isPhoneVerified: boolean       // Default: false
  accountStatus: string          // 'active' | 'inactive' | 'flagged' | 'banned'
  role: string                   // 'user' | 'admin' | 'creator'
  status: string                 // 'draft' | 'published' | 'archived' | 'deleted'
  authProvider: string           // 'email' | 'google' | 'github'
  googleId: string | null
  githubId: string | null
  avatarUrl: string | null       // R2 avatar URL
  panVerified: boolean
  kycStatus: string              // 'pending' | 'verified' | 'rejected'
  walletBalance: number          // Wallet balance in paise (1 INR = 100 paise)
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null         // Soft delete
}
```

### Contest

```typescript
{
  _id: string
  title: string                  // 3-200 chars
  slug: string                   // unique, kebab-case
  description: string
  problemIds: string[]           // Problem ids (ObjectIds; populated in GET /contests/:id)
  startTime: Date
  endTime: Date                  // must be after startTime
  type: 'free' | 'paid'
  entryFee: number               // paise (0 for free)
  prizePool: number              // paise
  maxParticipants: number | null
  status: 'draft' | 'active' | 'frozen' | 'settled' | 'cancelled'
  rules: string
  createdBy: string              // creator/admin user id
  createdAt: Date
  updatedAt: Date
}
```

Status flow: `draft → active → frozen → settled` (plus `draft|active → cancelled`).

### Problem

```typescript
{
  _id: string
  contestId: string | { _id, title, slug, status, type, entryFee }  // populated in practice routes
  title: string                  // 3-300 chars
  slug: string                   // unique per contest
  description: string
  imageUrls: string[]            // R2 URLs
  type: 'coding' | 'mcq'
  difficulty: 'easy' | 'medium' | 'hard'
  points: number                 // min 1
  order: number
  timeLimit: number              // ms, 100-30000 (coding)
  memoryLimit: number            // MB, 16-1024 (coding)
  languageSupport: string[]      // judge language keys (coding)
  solutionTemplate: Record<string, string>  // key -> starter code (coding)
  testCases: Array<{ _id, input, expectedOutput, isPublic, order, description }>  // public only
  options: string[]              // MCQ choices
  status: 'draft' | 'published'
  createdAt: Date
  updatedAt: Date
}
```

`correctAnswer` (MCQ) and hidden test cases are **never** returned publicly; staff can see them with `includeHidden=true`.

### Submission

```typescript
{
  _id: string
  userId: string
  contestId: string
  problemId: string
  language: string | null        // null for MCQ
  code: string                   // source code, or MCQ option index as string
  status: 'pending' | 'running' | 'accepted' | 'rejected' | 'error' | 'timeout'
  testResults: Array<{ testCaseId, passed, executionTime, output, expectedOutput }>  // public cases only
  publicPassed: number
  publicTotal: number
  hiddenPassed: number
  hiddenTotal: number
  totalScore: number
  executionTime: number          // ms
  memoryUsed: number             // KB
  compilerOutput: string | null
  submittedAt: Date
  judgedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

### Participation

```typescript
{
  _id: string
  userId: string
  contestId: string
  joinedAt: Date
  startedAt: Date | null
  submittedAt: Date | null
  totalScore: number             // best score across accepted/rejected submissions
  rank: number | null            // set at settle time
  status: 'registered' | 'started' | 'completed' | 'timedout'
  createdAt: Date
  updatedAt: Date
}
```

### Prize

```typescript
{
  _id: string
  contestId: string | { _id, title, slug }   // populated in GET /prizes
  userId: string
  rank: number                   // competition ranking (may skip numbers)
  prizeAmount: number            // paise
  status: 'pending' | 'credited' | 'failed'
  failureReason: string | null
  creditedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

### WalletTransaction

```typescript
{
  _id: string
  userId: string
  type: 'deposit' | 'contest_fee' | 'prize' | 'refund' | 'withdrawal'
  amount: number                 // paise, positive
  balanceBefore: number
  balanceAfter: number
  referenceType: 'payment' | 'contest' | 'prize' | 'withdrawal'
  referenceId: string | null
  description: string            // max 500
  status: 'completed' | 'pending' | 'failed'
  createdAt: Date
}
```

### Payment

```typescript
{
  _id: string
  userId: string
  contestId: string | null
  purpose: 'deposit' | 'contest'
  amount: number                 // paise
  currency: 'INR'
  status: 'created' | 'attempted' | 'paid' | 'failed' | 'refunded'
  razorpayOrderId: string | null
  razorpayPaymentId: string | null
  receipt: string
  refundId: string | null
  failureReason: string | null
  paidAt: Date | null
  refundedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

### Language

```typescript
{
  _id: string
  key: string                    // unique, lowercase alphanumeric (e.g. "javascript")
  name: string                   // max 50
  version: string                // max 50
  extension: string              // no leading dot
  compileCommand: string | null
  runCommand: string             // contains {file} placeholder
  dockerImage: string
  logoUrl: string | null
  enabled: boolean
  order: number
  createdAt: Date
  updatedAt: Date
}
```

---

## 22. Implementation Order

Recommended build sequence for website frontend:

1. **Auth flow** — Register, login, refresh, logout, get profile
2. **Session check** — `/auth/check` for protected route guards
3. **Profile** — Update profile with avatar upload, set/change password
4. **Google OAuth** — Popup flow using `/auth/google/url` → callback handler
5. **GitHub OAuth** — Same pattern as Google
6. **Email verification** — OTP send + verify
7. **Password reset** — Forgot password + reset password
8. **KYC** — Update details, view status, view decrypted details
9. **Contest browsing** — `GET /contests`, `GET /contests/:id`, prize breakdown `GET /contests/:id/prizes`
10. **Join + start** — `POST /contests/:id/join` (Turnstile), `POST /contests/:id/start`
11. **Practice** — `GET /problems` with difficulty/type/language filters
12. **Competition** — Contest problems (`GET /contests/:contestId/problems`), submissions (`POST` + polling via Socket.IO events), leaderboard
13. **Wallet** — Balance + transactions, deposit via `/payments/create-order` + Razorpay Checkout, withdrawal (KYC-gated)
14. **Prizes** — `/prizes` history, `/prizes/recent` winners wall
15. **Site content** — Logo, banners, FAQs, why-choose-us (render from public GETs)