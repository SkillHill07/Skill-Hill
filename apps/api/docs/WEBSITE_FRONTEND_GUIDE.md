# SkillHill API — Website Frontend Guide

> **For website frontend developers implementing user-facing features.**
> Last updated: July 2026 | API Version: 0.4.0

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
9. [Health](#9-health)
10. [Error Reference](#10-error-reference)
11. [Environment Variables](#11-environment-variables)
12. [User Schema Reference](#12-user-schema-reference)
13. [Implementation Order](#13-implementation-order)

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

### Rate Limiting

All auth-sensitive endpoints are rate-limited per IP using Redis-backed rate-limiter-flexible:

| Endpoint | Limit |
|----------|-------|
| Register | 3 requests/minute |
| Login | 5 requests/minute |
| Refresh | 10 requests/minute |
| Forgot Password | 3 requests/minute |
| Reset Password | 5 requests/minute |
| OTP Send | 1 request/60s per user |
| OTP Verify | 5 requests/minute |

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

**Success (200):** Returns new `user` + `tokens`.

**Error codes:** `INVALID_REFRESH_TOKEN` (401), `TOKEN_REVOKED` (401)

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
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "phoneCountryCode": "+91",
    "isEmailVerified": false,
    "isPhoneVerified": false,
    "accountStatus": "active",
    "role": "user",
    "authProvider": "email",
    "googleId": null,
    "githubId": null,
    "avatarUrl": null,
    "panVerified": false,
    "kycStatus": "pending",
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
- Data is cached server-side for 60 seconds

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
| `GET` | `/auth/google/callback` | No | Handles OAuth callback, sets cookies, redirects to frontend |
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
| `GET` | `/auth/github/callback` | No | Handles callback, sets cookies, redirects to frontend |
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

**Frontend notes:**
- Use for edit mode or when user needs to see their data
- For read-only status display, prefer the lighter `/auth/kyc/status` endpoint

---

## 9. Health

### GET /health

**What it does:** Simple health check.

**Success (200):**
```json
{
  "success": true,
  "data": { "status": "ok" }
}
```

---

## 10. Error Reference

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

---

## 11. Environment Variables

### Required

```
PORT=4000
MONGODB_URI=mongodb://localhost:27017/skillcontest
REDIS_URL=redis://localhost:6379
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

---

## 12. User Schema Reference

```typescript
{
  _id: string                    // MongoDB ObjectId
  firstName: string              // 1-50 chars
  lastName: string               // 1-50 chars
  fullName: string               // Virtual: firstName + lastName
  email: string                  // Unique, lowercase
  phone: string | null           // 5-15 digits
  phoneCountryCode: string | null // e.g., "+91"
  isEmailVerified: boolean       // Default: false
  isPhoneVerified: boolean       // Default: false
  accountStatus: string          // 'active' | 'inactive' | 'flagged' | 'banned'
  role: string                   // 'user' | 'admin' | 'creator'
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
  status: string                 // 'draft' | 'published' | 'archived' | 'deleted'
}
```

---

## 13. Implementation Order

Recommended build sequence for website frontend:

1. **Auth flow** — Register, login, refresh, logout, get profile
2. **Session check** — `/auth/check` for protected route guards
3. **Profile** — Update profile with avatar upload, set/change password
4. **Google OAuth** — Popup flow using `/auth/google/url` → callback handler
5. **GitHub OAuth** — Same pattern as Google
6. **Email verification** — OTP send + verify
7. **Password reset** — Forgot password + reset password
8. **KYC** — Update details, view status, view decrypted details
