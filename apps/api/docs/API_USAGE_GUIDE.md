# SkillHill API Usage Guide

> **For frontend, website, and admin panel developers.**
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
9. [Admin — KYC Review](#9-admin--kyc-review)
10. [Admin — Account Management](#10-admin--account-management)
11. [Health](#11-health)
12. [Error Reference](#12-error-reference)
13. [Environment Variables](#13-environment-variables)

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

All auth-sensitive endpoints are rate-limited per IP using fixed-window counters on Upstash Redis:

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
  "firstName": "John",           // required, 1-50 chars, letters/spaces/hyphens/apostrophes only
  "lastName": "Doe",             // required, 1-50 chars, letters/spaces/hyphens/apostrophes only
  "email": "john@example.com",   // required, valid email
  "password": "secret123",       // required, min 8 chars, max 128 chars
  "turnstileToken": "0."         // required, Cloudflare Turnstile token
}
```

**Success response (201):**
```json
{
  "success": true,
  "data": {
    "user": { /* User object (see schema below) */ },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "expiresIn": 604800
    }
  },
  "message": "Registration successful"
}
```

**Error codes:** `TURNSTILE_FAILED` (400), `EMAIL_EXISTS` (409), validation (400)

**Frontend notes:**
- Show a Cloudflare Turnstile widget on the registration form and send the token
- Store both tokens in localStorage/sessionStorage on success
- Redirect to dashboard

---

### POST /auth/login

**What it does:** Authenticates with email and password. Returns JWT tokens.

**Auth required:** No (but requires Turnstile CAPTCHA token)

**Request body:**
```json
{
  "email": "john@example.com",
  "password": "secret123",
  "turnstileToken": "0."
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "user": { /* User object */ },
    "tokens": { /* accessToken, refreshToken, expiresIn */ }
  },
  "message": "Login successful"
}
```

**Error codes:**
| Code | Status | Meaning |
|------|--------|---------|
| `TURNSTILE_FAILED` | 400 | CAPTCHA failed |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password (generic, prevents enumeration) |
| `ACCOUNT_BANNED` | 403 | Account is banned — show "contact support" message |
| `ACCOUNT_FLAGGED` | 403 | Account under review — show "contact support" message |
| `NO_PASSWORD_SET` | 400 | Google/GitHub-only account — tell user to sign in via OAuth or set a password |

**Frontend notes:**
- Check `accountStatus` on the returned user. If `banned` or `flagged`, show the appropriate error
- On success, store tokens and redirect to dashboard
- The 401 error is intentionally generic ("Invalid email or password") to prevent email enumeration

---

### POST /auth/refresh

**What it does:** Exchanges a refresh token for a new access+refresh token pair. Implements token rotation (old refresh token is invalidated).

**Auth required:** No

**Request body:**
```json
{
  "refreshToken": "eyJ..."  // required
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "user": { /* User object */ },
    "tokens": { /* accessToken, refreshToken, expiresIn */ }
  },
  "message": "Tokens refreshed"
}
```

**Error codes:** `INVALID_REFRESH_TOKEN` (401), `TOKEN_REVOKED` (401)

**Frontend notes:**
- Implement an axios/fetch interceptor that catches 401 errors and automatically calls `/auth/refresh`
- If refresh also fails (401), redirect to login
- Token rotation means the old refresh token is invalidated after use — always store the new one

---

### POST /auth/logout

**What it does:** Revokes the specified refresh token. Logs the user out of that session.

**Auth required:** Yes (Bearer token)

**Request body:**
```json
{
  "refreshToken": "eyJ..."  // required
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": null,
  "message": "Logged out successfully"
}
```

**Frontend notes:**
- Clear tokens from storage after successful logout
- Redirect to login page

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
- Call this on app mount to check if the user is logged in and load profile data
- Check `accountStatus` to determine if the user is banned/flagged
- Check `isEmailVerified` to show email verification prompts

---

### PUT /auth/me

**What it does:** Updates the user's profile fields. Supports avatar image upload. Accepts `multipart/form-data`.

**Auth required:** Yes

**Content-Type:** `multipart/form-data`

**Form fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `firstName` | string | No | 1-50 chars, letters/spaces/hyphens/apostrophes |
| `lastName` | string | No | 1-50 chars, letters/spaces/hyphens/apostrophes |
| `phone` | string | No | 5-15 digits. Send empty string to clear |
| `phoneCountryCode` | string | No | Format: +91. Send empty string to clear |
| `avatar` | file | No | JPEG, PNG, or WebP, max 5MB |

**Success response (200):** Returns updated `User` object.

**Frontend notes:**
- Use `FormData` to build the request (not JSON)
- The avatar is compressed server-side to WebP 400×400px and uploaded to Cloudflare R2
- `avatarUrl` on the user object will contain the public URL after upload
- Only send fields that changed — omitted fields are left unchanged

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

**What it does:** Soft-deletes the authenticated user's account. Sets `deletedAt`, marks account as `inactive`, and revokes all sessions.

**Auth required:** Yes

**Success response (200):**
```json
{
  "success": true,
  "data": null,
  "message": "Account deleted successfully"
}
```

**Error codes:** `ALREADY_DELETED` (400) — account was already deleted

**Frontend notes:**
- Show a confirmation dialog before calling this endpoint
- On success, clear all local tokens/storage and redirect to login or home
- Account can potentially be restored by an admin — this is NOT a permanent deletion

---

### GET /auth/check

**What it does:** Lightweight endpoint to validate the current session and return essential user info. Useful for checking auth state on page load or route navigation.

**Auth required:** Yes

**Success response (200):**
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
- Called on every protected route mount to verify the session is still valid
- Returns lightweight data (no full user object) for speed
- Check `accountStatus === "active"` — if banned/flagged, show appropriate page
- Check `isEmailVerified` to show verification prompts
- Automatically redirect to login if 401 is returned

---

### POST /auth/set-password

**What it does:** Sets or changes the user's password.
- **Google/GitHub users:** Use this to add a password to your account (enables email-password login as an alternative)
- **Email users:** Use this to change your existing password (requires currentPassword)

**Auth required:** Yes

**Request body:**
```json
{
  "password": "newPassword123",     // required, min 8 chars
  "currentPassword": "oldPassword"  // required ONLY when changing existing password
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": null,
  "message": "Password set successfully. You can now log in with email and password."
}
```

**Error codes:** `PASSWORD_TOO_SHORT` (400), `CURRENT_PASSWORD_REQUIRED` (400), `INVALID_CURRENT_PASSWORD` (401)

**Frontend notes:**
- For OAuth-only users (no password set), show a "Set Password" form with just the new password field
- For email-password users, show a "Change Password" form with both current + new password fields
- On success, the user can now log in with either OAuth or email-password

---

## 4. Auth — Google OAuth

### GET /auth/google

**What it does:** Redirects the user to Google's OAuth consent screen.

**Auth required:** No

**Response:** 302 redirect to Google

**Error codes:** `503` — Google OAuth not configured (missing env vars)

**Frontend notes:**
- Open this URL in a new popup window or redirect the current page
- The callback will redirect back to `{FRONTEND_URL}/auth/callback?accessToken=...&refreshToken=...&isNewUser=...`

---

### GET /auth/google/callback

**What it does:** Handles the Google OAuth callback. Exchanges the authorization code for tokens, finds or creates the user, and redirects the frontend with JWT tokens.

**Auth required:** No

**Query params:** `?code=AUTHORIZATION_CODE&error=...`

**Response:** 302 redirect to `{FRONTEND_URL}/auth/callback?accessToken=...&refreshToken=...&isNewUser=true/false`

**On error:** Redirects to `{FRONTEND_URL}/auth/callback?error=...`

**Frontend notes:**
- The redirect URL (`/auth/callback`) must be handled by your frontend router
- Parse `accessToken`, `refreshToken`, and `isNewUser` from the query string
- Store tokens, redirect to dashboard or onboarding (for new users)
- The `isNewUser` flag helps decide whether to show onboarding

---

### POST /auth/google/link

**What it does:** Links a Google account to the currently logged-in user. After linking, the user can sign in with either email/password or Google.

**Auth required:** Yes

**Request body:**
```json
{
  "code": "AUTHORIZATION_CODE_FROM_GOOGLE"  // required
}
```

**Success response (200):** Returns updated `User` object.

**Error codes:** `GOOGLE_ALREADY_LINKED` (409) — this Google account is linked to another user

**Frontend notes:**
- First, open Google OAuth popup (via the URL from `GET /auth/google/url`)
- After user consents, Google redirects back to your callback page with a code
- Send that code to this endpoint
- Show "Linked successfully" on success

---

### GET /auth/google/url

**What it does:** Returns the Google OAuth URL as JSON (instead of redirecting). Useful for popup-based OAuth flows.

**Auth required:** No

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."
  }
}
```

**Frontend notes:**
- Use this for popup windows: open the URL in a new window, listen for the redirect
- The popup will redirect to your callback page with tokens in the URL

---

## 5. Auth — GitHub OAuth

GitHub OAuth follows the exact same pattern as Google OAuth. The frontend integration is identical.

### GET /auth/github

Redirects user to GitHub's OAuth consent screen. Same pattern as `/auth/google`.

### GET /auth/github/callback

Handles GitHub OAuth callback. Same pattern as `/auth/google/callback`.

**Note:** GitHub may not expose the user's public email. The server fetches the primary email via GitHub's `/user/emails` API automatically.

### POST /auth/github/link

Links a GitHub account to the currently logged-in user. Same pattern as `/auth/google/link`.

### GET /auth/github/url

Returns the GitHub OAuth URL as JSON. Same pattern as `/auth/google/url`.

---

## 6. Auth — Email OTP

### POST /auth/otp/send

**What it does:** Sends a 6-digit OTP code to the authenticated user's email address for verification.

**Auth required:** Yes

**Request body:** None (uses authenticated user's email)

**Success response (200):**
```json
{
  "success": true,
  "data": { "expiresInSeconds": 600 },
  "message": "OTP sent to your email"
}
```

**Error codes:** `OTP_COOLDOWN` (429) with `cooldown` (seconds remaining), `EMAIL_ALREADY_VERIFIED` (400), `ACCOUNT_BANNED` (403)

**Frontend notes:**
- Call this when user clicks "Send verification code"
- Show a countdown timer for 60 seconds (cooldown) before allowing re-send
- OTP expires in 10 minutes

---

### POST /auth/otp/verify

**What it does:** Verifies the 6-digit OTP submitted by the user. On success, marks the user's email as verified.

**Auth required:** Yes

**Request body:**
```json
{
  "otp": "482913"  // required, exactly 6 digits
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": null,
  "message": "Email verified successfully"
}
```

**Error codes:**
| Code | Status | Meaning |
|------|--------|---------|
| `OTP_EXPIRED` | 410 | OTP expired — request a new one |
| `OTP_TOO_MANY_ATTEMPTS` | 429 | 5 incorrect attempts — OTP invalidated |
| `INVALID_OTP` | 400 | Wrong OTP — shows remaining attempts |

**Frontend notes:**
- Show the remaining attempts count to the user
- On `OTP_EXPIRED` or `OTP_TOO_MANY_ATTEMPTS`, disable the verify button and prompt to request a new OTP
- On success, mark the email as verified in the UI (no further action needed)

---

## 7. Auth — Password Reset

### POST /auth/forgot-password

**What it does:** Sends a password reset link to the user's email. Always returns success regardless of whether the email exists (prevents email enumeration).

**Auth required:** No (requires Turnstile)

**Request body:**
```json
{
  "email": "john@example.com",
  "turnstileToken": "0."
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": null,
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Frontend notes:**
- Show the same success message regardless of whether the email exists
- The reset link is `{FRONTEND_URL}/auth/reset-password?token=...&email=...` and expires in 15 minutes

---

### POST /auth/reset-password

**What it does:** Resets the user's password using the token from the email. Revokes all existing sessions.

**Auth required:** No

**Request body:**
```json
{
  "email": "john@example.com",  // from the reset link
  "token": "abc123...",          // from the reset link
  "password": "newPassword123"   // min 8 chars
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": null,
  "message": "Password reset successfully. Please login with your new password."
}
```

**Error codes:** `PASSWORD_TOO_SHORT` (400), `RESET_TOKEN_INVALID` (410), `NO_PASSWORD_SET` (400)

**Frontend notes:**
- The reset token is a hex string from the URL query params
- After successful reset, redirect to login page (all sessions revoked, user must login again)

---

## 8. Auth — KYC Details

### PUT /auth/kyc

**What it does:** Updates the authenticated user's KYC details (PAN, bank account, IFSC, UPI). Sensitive fields are encrypted at rest using AES-256-GCM. When any field changes, `kycStatus` resets to `pending` for admin re-verification.

**Auth required:** Yes

**Request body:**
```json
{
  "panNumber": "ABCDE1234F",          // optional, 10 chars, format: ABCDE1234F
  "bankAccountNumber": "123456789012", // optional, 9-18 digits
  "ifscCode": "HDFC0001234",          // optional, 11 chars, format: HDFC0001234
  "upiId": "user@paytm"               // optional, format: username@handle
}
```

At least one field must be provided.

**Success response (200):** Returns updated `User` object.

**Frontend notes:**
- Only send the fields that changed — omitted fields are left unchanged
- Show progress indicators for which fields are submitted (use `GET /auth/kyc/status`)
- After submission, admin must review and approve KYC before `kycStatus` becomes `verified`

---

### GET /auth/kyc/status

**What it does:** Returns which KYC fields have been submitted and the current verification status. Does NOT return actual encrypted values.

**Auth required:** Yes

**Success response (200):**
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
- Use the `has*` booleans to show which fields have been filled in
- Use `kycStatus` to show the overall verification progress (pending → verified → rejected)

---

### GET /auth/kyc/details

**What it does:** Returns the user's own KYC details with decrypted values (PAN, bank account, IFSC, UPI). Only the authenticated user can access their own KYC details.

**Auth required:** Yes

**Success response (200):**
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
- Only call this when the user needs to see/verify their own KYC data (e.g., edit mode)
- For read-only status display, use the lighter `GET /auth/kyc/status` endpoint instead

---

## 9. Admin — KYC Review

All admin KYC endpoints require authentication + `admin` or `creator` role.

### GET /admin/kyc/pending

**What it does:** Lists all users with `kycStatus: "pending"` (awaiting review). Sorted by most recent update first.

**Auth required:** Yes (admin/creator)

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "total": 5,
    "users": [
      {
        "_id": "64a1b2c3...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "accountStatus": "active",
        "panVerified": false,
        "kycStatus": "pending",
        "createdAt": "2026-07-19T10:30:00.000Z",
        "updatedAt": "2026-07-19T11:00:00.000Z"
      }
    ]
  }
}
```

**Admin panel notes:**
- Show this list as the main KYC review queue
- Each user card/row should have a "Review" button that opens the review page

---

### GET /admin/kyc/:userId

**What it does:** Returns the full KYC details (decrypted) for a specific user. Includes PAN, bank account, IFSC, UPI values.

**Auth required:** Yes (admin/creator)

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "64a1b2c3...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "accountStatus": "active",
      "panVerified": false,
      "kycStatus": "pending"
    },
    "kyc": {
      "panNumber": "ABCDE1234F",
      "bankAccountNumber": "123456789012",
      "ifscCode": "HDFC0001234",
      "upiId": "user@paytm"
    }
  }
}
```

**Admin panel notes:**
- Show the decrypted KYC data so the admin can verify it against submitted documents
- This data is sensitive — the admin panel should be behind strict access control

---

### PUT /admin/kyc/:userId/review

**What it does:** Approves or rejects a user's KYC submission. When approved, also sets `panVerified = true`. The admin's identity is logged for audit.

**Auth required:** Yes (admin/creator)

**Request body:**
```json
{
  "action": "approved",            // "approved" or "rejected"
  "rejectionReason": "PAN number does not match document"  // required if rejected
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": { /* Updated User object */ },
  "message": "KYC approved successfully"
}
```

**Admin panel notes:**
- Show a two-button UI: "Approve" and "Reject"
- If rejecting, show a text field for the reason (required)
- After action, refresh the pending list and toast the result

---

## 10. Admin — Account Management

All admin account management endpoints require authentication + `admin` or `creator` role (status/role changes require `admin` only).

### GET /admin/accounts

**What it does:** Paginated user listing with optional filters. Supports text search across name and email.

**Auth required:** Yes (admin/creator)

**Query params:**

| Param | Type | Example | Notes |
|-------|------|---------|-------|
| `page` | int | 1 | Default: 1 |
| `limit` | int | 20 | Default: 20, max: 100 |
| `accountStatus` | string | `active` | One of: active, inactive, flagged, banned |
| `role` | string | `user` | One of: user, admin, creator |
| `kycStatus` | string | `pending` | One of: pending, verified, rejected |
| `search` | string | `john` | Case-insensitive search across firstName, lastName, email |

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "users": [ /* Array of user objects */ ],
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

**Admin panel notes:**
- Build a filter bar with dropdowns for accountStatus, role, kycStatus
- Add a text search input for name/email search
- Show pagination controls

---

### GET /admin/accounts/:userId

**What it does:** Returns the complete user profile for a specific user (excluding decrypted KYC).

**Auth required:** Yes (admin/creator)

**Success response (200):** Returns full `User` object.

**Admin panel notes:**
- Navigate here from the user list to see all details
- Show action buttons for status change and role change
- Include a link to view KYC details (the GET /admin/kyc/:userId endpoint)

---

### PATCH /admin/accounts/:userId/status

**What it does:** Changes a user's account status. Banning or flagging revokes all active sessions. Admin cannot change their own status.

**Auth required:** Yes (admin only)

**Request body:**
```json
{
  "status": "banned",     // required: active, inactive, flagged, banned
  "reason": "Cheating in contest"  // optional, max 500 chars
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": { /* Updated User object */ },
  "message": "Account status changed to banned"
}
```

**Error codes:** `CANNOT_SELF_MODIFY` (400), `USER_NOT_FOUND` (404)

**Admin panel notes:**
- Show a dropdown or radio buttons for the new status
- Show a reason text field (especially important for ban/flag actions)
- Confirmation dialog before applying ban/flag changes
- After the change, the user is logged out of all devices if banned/flagged

---

### PATCH /admin/accounts/:userId/role

**What it does:** Changes a user's role (e.g., promote to admin, demote to user). Revokes all active sessions to force re-login with new permissions. Admin cannot change their own role.

**Auth required:** Yes (admin only)

**Request body:**
```json
{
  "role": "admin"  // required: user, admin, creator
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": { /* Updated User object */ },
  "message": "Role changed to admin"
}
```

**Admin panel notes:**
- Show a dropdown with available roles
- Confirmation dialog before changing
- The target user will be logged out and need to re-login to get the new permissions

---

## 11. Health

### GET /health

**What it does:** Simple health check endpoint. Returns the server status.

**Auth required:** No

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

---

## 12. Error Reference

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `USER_NOT_FOUND` | 404 | User document not found in database |
| `VALIDATION_ERROR` | 400 | Request body failed Zod validation |
| `NO_TOKEN` | 401 | Authorization header missing or invalid format |
| `TOKEN_EXPIRED` | 401 | Access token has expired (call /auth/refresh) |
| `TOKEN_REVOKED` | 401 | Refresh token was revoked (re-login required) |

### User Status Control

The `status` field on documents (different from `accountStatus`) controls visibility on the website:

| Status | Visibility |
|--------|------------|
| `draft` | Hidden from public |
| `published` | Visible on website |
| `archived` | Hidden (deprecated content) |
| `deleted` | Hidden (soft-deleted) |

### Account Status Meanings

| Status | Meaning | Can login? |
|--------|---------|------------|
| `active` | Normal account | ✅ Yes |
| `inactive` | Not active / soft-deleted | ❌ No |
| `flagged` | Under review (suspicious activity) | ❌ No — "contact support" |
| `banned` | Permanently blocked | ❌ No — "contact support" |

---

## 13. Environment Variables

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

### Razorpay (Payments)

```
RAZORPAY_KEY_ID=<your-key-id>
RAZORPAY_KEY_SECRET=<your-key-secret>
RAZORPAY_WEBHOOK_SECRET=<your-webhook-secret>
```

---

## User Schema Reference

```typescript
{
  _id: string                    // MongoDB ObjectId
  firstName: string              // 1-50 chars
  lastName: string               // 1-50 chars
  fullName: string               // Virtual: firstName + lastName
  email: string                  // Unique, lowercase
  password: string               // Hashed (bcrypt, 12 rounds), never returned
  phone: string | null           // 5-15 digits
  phoneCountryCode: string | null // e.g., "+91"
  isEmailVerified: boolean       // Default: false
  isPhoneVerified: boolean       // Default: false
  accountStatus: string          // 'active' | 'inactive' | 'flagged' | 'banned'
  role: string                   // 'user' | 'admin' | 'creator'
  authProvider: string           // 'email' | 'google' | 'github'
  googleId: string | null        // Google OAuth ID
  githubId: string | null        // GitHub OAuth ID
  avatarUrl: string | null       // R2 avatar URL
  panVerified: boolean           // Default: false
  kycStatus: string              // 'pending' | 'verified' | 'rejected'
  walletBalance: number              // Wallet balance in paise (1 INR = 100 paise)
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null         // Soft delete timestamp
  status: string                 // 'draft' | 'published' | 'archived' | 'deleted'
}
```

---

## Implementation Order (Recommended for Frontend)

1. **Auth flow** — `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me` (GET)
2. **Session check** — `/auth/check` (protected route guard)
3. **Profile** — `/auth/me` (PUT with avatar), `/auth/set-password`
4. **Google OAuth** — `/auth/google/url` → popup → `/auth/google/callback` handler
5. **GitHub OAuth** — same pattern as Google
6. **Email verification** — `/auth/otp/send`, `/auth/otp/verify`
7. **Password reset** — `/auth/forgot-password`, `/auth/reset-password`
8. **KYC** — `/auth/kyc` (PUT), `/auth/kyc/status` (GET), `/auth/kyc/details` (GET)
9. **Admin Login** — `/admin/auth/login` (same as login, but requires admin/creator role)
10. **Admin KYC** — `/admin/kyc/pending`, `/admin/kyc/:userId`, `/admin/kyc/:userId/review`
11. **Admin Accounts** — `/admin/accounts` (list), user details, status/role changes
