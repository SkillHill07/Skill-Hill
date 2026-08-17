# SkillHill API — Admin Panel Guide

> **For admin panel developers implementing admin-specific features.**
> Last updated: August 2026 | API Version: 0.5.0

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Admin — Login](#2-admin--login)
3. [Admin — KYC Review](#3-admin--kyc-review)
4. [Admin — Account Management](#4-admin--account-management)
5. [Admin — Contests](#5-admin--contests)
6. [Admin — Problems](#6-admin--problems)
7. [Admin — Submissions](#7-admin--submissions)
8. [Admin — Languages](#8-admin--languages)
9. [Admin — Prizes](#9-admin--prizes)
10. [Admin — Wallets](#10-admin--wallets)
11. [Admin — Payments](#11-admin--payments)
12. [Admin — Site Content](#12-admin--site-content)
13. [Admin — Audit Trail](#13-admin--audit-trail)
14. [Webhooks](#14-webhooks)
15. [Health](#15-health)
16. [Error Reference](#16-error-reference)
17. [Schema Reference](#17-schema-reference)

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

The `authenticate` middleware checks the `Authorization` header first, then falls back to the `accessToken` cookie.

### Admin Login

Admin users login via **`POST /admin/auth/login`** — same as regular login but also verifies the user has `admin` or `creator` role. Sets HttpOnly cookies and returns tokens.

### Role Requirements

| Endpoint Group | Required Role |
|----------------|---------------|
| Admin — Login | `admin` or `creator` (checked after credential validation) |
| Admin — KYC Review | `admin` or `creator` |
| Admin — Account Listing & Details | `admin` or `creator` |
| Admin — Account Status Changes | `admin` only |
| Admin — Account Role Changes | `admin` only |
| Admin — Contest Create/Edit/Publish/Cancel/Freeze | `admin` or `creator` |
| Admin — Contest Settle | `admin` only |
| Admin — Problem CRUD, Test Cases, Images | `admin` or `creator` |
| Admin — Submissions List | `admin` or `creator` |
| Admin — Languages Create/Update/Logo | `admin` or `creator` |
| Admin — Language Delete | `admin` only |
| Admin — Prize Redistribute | `admin` only |
| Admin — Wallet Status | `admin` only |
| Admin — Payments List | `admin` or `creator` |
| Admin — Payment Refund | `admin` only |
| Admin — Site Content (banners/FAQs/why-choose-us/logo) | `admin` or `creator` |
| Admin — Audit Log | `admin` or `creator` |

### Token Flow

| Token | Lifetime | Storage |
|-------|----------|---------|
| `accessToken` | 7 days | HttpOnly cookie + response body |
| `refreshToken` | 30 days | HttpOnly cookie + response body (rotated on use) |

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
  "code": "MACHINE_READABLE_CODE"
}
```

### Money Units

All monetary values are in **paise** — 1 INR = 100 paise.

---

## 2. Admin — Login

### POST /admin/auth/login

**What it does:** Logs in as an admin/creator. Runs the full standard login (Turnstile + credentials + account status checks) and then verifies the role.

**Auth required:** No (requires Turnstile)

**Rate limit:** 5 requests/minute per IP

**Request body:**
```json
{
  "email": "admin@skillshill.com",
  "password": "secret123",
  "turnstileToken": "0."
}
```

**Success (200):**
```json
{
  "success": true,
  "data": {
    "user": { /* User object (role: "admin" or "creator") */ },
    "tokens": { "accessToken": "eyJ...", "refreshToken": "eyJ...", "expiresIn": 604800 }
  },
  "message": "Admin login successful"
}
```

**Error codes:**
| Code | Status | Meaning |
|------|--------|---------|
| `TURNSTILE_FAILED` | 400 | CAPTCHA failed |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `ACCOUNT_BANNED` | 403 | Banned |
| `ACCOUNT_FLAGGED` | 403 | Under review |
| `NO_PASSWORD_SET` | 400 | OAuth-only account |
| `ADMIN_REQUIRED` | 403 | Valid credentials but role is not admin/creator |

**Admin panel notes:** On `ADMIN_REQUIRED`, do NOT log the user in — redirect to the regular site login instead.

---

## 3. Admin — KYC Review

All endpoints in this section require `admin` or `creator` role.

---

### GET /admin/kyc/pending

**What it does:** Lists all users with KYC status `"pending"` (awaiting review). Sorted by most recent update first.

**Auth required:** Yes (admin/creator)

**Success (200):**
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
- This is the main KYC review queue
- Each user card/row should have a "Review" button that navigates to the review page
- The `total` field indicates queue size

---

### GET /admin/kyc/:userId

**What it does:** Returns full KYC details (decrypted) for a specific user. Includes PAN, bank account, IFSC, and UPI values.

**Auth required:** Yes (admin/creator)

**Success (200):**
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
- Shows decrypted KYC data so the admin can verify against uploaded documents
- This data is **highly sensitive** — the admin panel must be behind strict access control
- Navigate here from the pending list when clicking "Review"

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

**Success (200):**
```json
{
  "success": true,
  "data": { /* Updated User object */ },
  "message": "KYC approved successfully"
}
```

**Admin panel notes:**
- Show "Approve" and "Reject" buttons
- If rejecting, show a text field for the reason (required)
- After action, refresh the pending list and show a toast notification
- Writes an audit log entry (`action: "kyc.review"`)

---

## 4. Admin — Account Management

All endpoints in this section are mounted under `/admin/accounts`.

### GET /admin/accounts

**What it does:** Paginated user listing with optional filters and text search.

**Auth required:** Yes (admin/creator)

**Query parameters:**

| Param | Type | Default | Values |
|-------|------|---------|--------|
| `page` | int | 1 | — |
| `limit` | int | 20 | Max 100 |
| `accountStatus` | string | — | `active`, `inactive`, `flagged`, `banned` |
| `role` | string | — | `user`, `admin`, `creator` |
| `kycStatus` | string | — | `pending`, `verified`, `rejected` |
| `search` | string | — | Case-insensitive search across name/email |

**Success (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "64a1b2c3...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "role": "user",
        "accountStatus": "active",
        "isEmailVerified": false,
        "authProvider": "email",
        "kycStatus": "pending",
        "panVerified": false,
        "createdAt": "...",
        "updatedAt": "...",
        "lastLoginAt": null
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

**Admin panel notes:**
- Build a filter bar with dropdowns for `accountStatus`, `role`, `kycStatus`
- Add a text search input for name/email search
- Show pagination controls using `page`, `totalPages`

---

### GET /admin/accounts/:userId

**What it does:** Returns the complete user profile for a specific user (no decrypted KYC).

**Auth required:** Yes (admin/creator)

**Success:** Returns full `User` object.

**Admin panel notes:**
- Navigate here from the user list to see all details
- Include buttons for status change, role change, and KYC review
- Link to `GET /admin/kyc/:userId` for KYC details

---

### PATCH /admin/accounts/:userId/status

**What it does:** Changes a user's account status. Banning or flagging revokes all active sessions. Admin cannot modify their own status.

**Auth required:** Yes (**admin only**)

**Request body:**
```json
{
  "status": "banned",               // "active" | "inactive" | "flagged" | "banned"
  "reason": "Cheating in contest"   // optional, max 500 chars
}
```

**Success (200):**
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
- Show a reason text field (important for ban/flag actions — provides audit trail)
- **Show a confirmation dialog** before applying ban/flag — this logs the user out of all devices
- The user's cached profile will update within 60 seconds
- Writes an audit log entry (`action: "user.status"`)

---

### PATCH /admin/accounts/:userId/role

**What it does:** Changes a user's role (promote/demote). Revokes all active sessions to force re-login with new permissions. Admin cannot change their own role.

**Auth required:** Yes (**admin only**)

**Request body:**
```json
{
  "role": "admin"  // "user" | "admin" | "creator"
}
```

**Success (200):**
```json
{
  "success": true,
  "data": { /* Updated User object */ },
  "message": "Role changed to admin"
}
```

**Error codes:** `CANNOT_SELF_MODIFY` (400), `USER_NOT_FOUND` (404)

**Admin panel notes:**
- Show a dropdown with available roles
- Show a confirmation dialog before changing
- The target user will be logged out and must re-login for new permissions to take effect
- Writes an audit log entry (`action: "user.role"`)

---

## 5. Admin — Contests

All contest management endpoints require `admin` or `creator` (settle is **admin only**). Money fields are in paise.

### Contest Lifecycle

```
draft → active → frozen → settled
draft|active → cancelled    (refunds all paid participants)
```

- `publish` requires at least one problem and schedules the **auto-freeze job** (Upstash) at `endTime` — the worker freezes automatically; manual freeze stays available.
- `cancel` refunds every participant's entry fee to their wallet (idempotent, best-effort).
- `freeze` is idempotent — calling it on a non-active contest returns the contest as-is.
- `settle` triggers prize distribution (winners' wallets credited); failures are logged, not thrown — re-run via `/admin/contests/:id/prizes/redistribute`.

---

### POST /contests

**What it does:** Creates a contest draft.

**Auth required:** Yes (admin/creator)

**Request body:**
```json
{
  "title": "Weekly Sprint",           // required, 3-200 chars
  "slug": "weekly-sprint",            // optional, lowercase letters/numbers/hyphens; default: slugified title
  "description": "...",               // optional, max 10000
  "type": "paid",                     // optional, "free" | "paid", default "free"
  "startTime": "2026-08-01T10:00:00.000Z",  // required
  "endTime": "2026-08-01T12:00:00.000Z",    // required, must be after startTime
  "entryFee": 2000,                   // optional int paise; required > 0 when type = "paid"; must be 0 when type = "free"
  "prizePool": 50000,                 // required, int paise
  "maxParticipants": 100,             // optional, positive int
  "rules": "..."                      // optional, max 20000
}
```

**Success (201):** Returns the Contest object (`status: "draft"`). Message: `"Contest draft created"`.

**Error codes:** `SLUG_EXISTS` (409), validation (400)

**Admin panel notes:** Writes an audit log entry (`action: "contest.create"`).

---

### PATCH /contests/:id

**What it does:** Updates a **draft** contest. All fields optional; omitted fields unchanged.

**Auth required:** Yes (admin/creator)

**Request body:** Same fields as create (all optional). `maxParticipants` accepts `null` to clear.

**Success (200):** Returns the updated Contest. Message: `"Contest updated"`.

**Error codes:** `CONTEST_NOT_DRAFT` (400), `SLUG_EXISTS` (409)

---

### POST /contests/:id/publish

**What it does:** Publishes the contest (`draft → active`). Requires at least one problem. Schedules the auto-freeze job at `endTime`.

**Auth required:** Yes (admin/creator)

**Request body:** None

**Success (200):** Returns the Contest (`status: "active"`). Message: `"Contest published"`.

**Error codes:** `INVALID_STATE_TRANSITION` (400), `NO_PROBLEMS` (400)

---

### POST /contests/:id/cancel

**What it does:** Cancels a draft or active contest (`draft|active → cancelled`). **Refunds entry fees to all paid participants** (idempotent, best-effort — refund failures are logged, not thrown).

**Auth required:** Yes (admin/creator)

**Request body:**
```json
{ "reason": "Double booking" }   // optional, max 500 chars
```

**Success (200):** Returns the Contest. Message: `"Contest cancelled"`.

**Error codes:** `INVALID_STATE_TRANSITION` (400)

---

### POST /contests/:id/freeze

**What it does:** Freezes a contest (`active → frozen`), closing submissions. Idempotent — non-active contests return as-is.

**Auth required:** Yes (admin/creator)

**Request body:** None

**Success (200):** Returns the Contest. Message: `"Contest frozen"`.

---

### POST /contests/:id/settle

**What it does:** Settles a frozen contest (`frozen → settled`), triggering prize distribution to winners' wallets.

**Auth required:** Yes (**admin only**)

**Request body:** None

**Success (200):** Returns the Contest. Message: `"Contest settled"`.

**Error codes:** `CONTEST_NOT_FROZEN` (400)

**Admin panel notes:** Distribution is best-effort — if it fails, check `/admin/audit` and re-run via `POST /admin/contests/:id/prizes/redistribute`.

---

### GET /contests (with staff filters)

**What it does:** Lists contests. With `status=draft` or `status=cancelled`, the full list (including hidden drafts) is returned to staff.

**Auth required:** Yes (admin/creator for draft/cancelled)

**Query parameters:** `status` (`active|upcoming|settled|frozen|cancelled|draft`), `page`, `limit` (1–100).

**Success (200):** `data: { contests: [{ contest, participantCount }], total, page, limit, totalPages }`

---

### GET /contests/:id/prizes

**What it does:** Prize breakdown for a contest (see the Website guide for the full shape). Useful pre-settle to preview `structure`, post-settle to see `winners`.

**Auth required:** No (optional auth)

---

## 6. Admin — Problems

All problem routes require `admin` or `creator`. **Every write route requires the owning contest to be `draft`** (`CONTEST_NOT_DRAFT` otherwise). Money-free; points are contest scoring weights.

### GET /contests/:contestId/problems?includeHidden=true

**What it does:** Lists contest problems with hidden test cases + `correctAnswer` included (staff only; non-staff gets 403).

**Auth required:** Yes (admin/creator, when `includeHidden=true`)

**Success (200):** `data` = array of raw Problem objects (all test cases incl. `isPublic: false`, plus `correctAnswer` for MCQ).

---

### POST /contests/:contestId/problems

**What it does:** Adds a problem to a draft contest.

**Auth required:** Yes (admin/creator)

**Request body:**
```json
{
  "title": "Two Sum",                    // required, 3-300 chars
  "slug": "two-sum",                     // optional; unique per contest
  "description": "...",                  // required
  "imageUrls": ["https://..."],          // optional, valid URLs
  "type": "coding",                      // optional, "coding" | "mcq", default "coding"
  "difficulty": "easy",                  // required, "easy" | "medium" | "hard"
  "points": 100,                         // required, min 1
  "order": 1,                            // optional, default 0
  "timeLimit": 2000,                     // optional, ms, 100-30000 (coding), default 2000
  "memoryLimit": 256,                    // optional, MB, 16-1024 (coding), default 256
  "languageSupport": ["javascript"],     // coding only, required ≥ 1 (valid judge language keys)
  "solutionTemplate": { "javascript": "..." },  // coding only
  "testCases": [                         // optional
    { "input": "1 2", "expectedOutput": "3", "isPublic": true, "order": 0, "description": "sample" }
  ],
  "options": ["A", "B", "C", "D"],       // mcq only, required ≥ 2
  "correctAnswer": 1                     // mcq only, required, 0-based option index
}
```

**Success (201):** Returns the Problem (public-safe serialization). Message: `"Problem created"`.

**Error codes:** `CONTEST_NOT_DRAFT` (400), `CONTEST_NOT_FOUND` (404), `SLUG_EXISTS` (409), `LANGUAGE_REQUIRED` (400)

**Admin panel notes:** Creating a problem auto-appends it to `contest.problemIds`. MCQ problems ignore language fields; coding problems ignore options.

---

### PATCH /contests/:contestId/problems/:problemId

**What it does:** Updates a problem (draft contest only). All fields optional (same constraints as create). `status` (`draft|published`) can be set directly.

**Success (200):** Returns the updated Problem. Message: `"Problem updated"`.

**Error codes:** `CONTEST_NOT_DRAFT` (400), `PROBLEM_NOT_FOUND` (404), `SLUG_EXISTS` (409), `MCQ_INVALID_ANSWER` (400), `LANGUAGE_REQUIRED` (400)

---

### DELETE /contests/:contestId/problems/:problemId

**What it does:** Removes a problem from the contest and `$pull`s it from `contest.problemIds`.

**Success (200):** `data: null`. Message: `"Problem removed"`.

**Error codes:** `CONTEST_NOT_DRAFT` (400), `PROBLEM_NOT_FOUND` (404)

---

### POST /contests/:contestId/problems/:problemId/test-cases

**What it does:** Adds a test case to a problem.

**Request body:**
```json
{
  "input": "5",              // required
  "expectedOutput": "25",    // required
  "isPublic": false,         // optional, default false (public cases are shown to users)
  "order": 0,                // optional, default: next index
  "description": "large n"   // optional, max 500
}
```

**Success (200):** Returns the Problem. Message: `"Test case added"`.

**Error codes:** `CONTEST_NOT_DRAFT` (400), `MCQ_NO_TEST_CASES` (400 — MCQ problems have no test cases)

---

### DELETE /contests/:contestId/problems/:problemId/test-cases/:testCaseId

**What it does:** Removes a test case (unknown id is silently ignored).

**Success (200):** Returns the Problem. Message: `"Test case removed"`.

**Error codes:** `CONTEST_NOT_DRAFT` (400), `PROBLEM_NOT_FOUND` (404)

---

### POST /contests/:contestId/problems/:problemId/images

**What it does:** Uploads a problem statement image (`multipart/form-data`, field `image`). Compressed server-side to WebP (max 1280×1024) → Cloudflare R2, URL appended to `imageUrls`.

**Auth required:** Yes (admin/creator)

**Request:** `multipart/form-data` — `image`: JPEG/PNG/WebP, max 5 MB.

**Success (200):** Returns the Problem with the new URL in `imageUrls`. Message: `"Problem image uploaded"`.

**Error codes:** `INVALID_PROBLEM_IMAGE` (400), `IMAGE_REQUIRED` (400), `CONTEST_NOT_DRAFT` (400), `UPLOAD_NOT_CONFIGURED` (503), `UPLOAD_FAILED` (500)

---

### DELETE /contests/:contestId/problems/:problemId/images/:index

**What it does:** Removes the image URL at `:index` (0-based) from `imageUrls`. The R2 object itself is NOT deleted.

**Success (200):** Returns the Problem. Message: `"Problem image removed"`.

**Error codes:** `INVALID_IMAGE_INDEX` (400), `CONTEST_NOT_DRAFT` (400), `PROBLEM_NOT_FOUND` (404)

---

## 7. Admin — Submissions

### GET /admin/contests/:contestId/submissions

**What it does:** Paginated audit listing of all submissions in a contest, newest first, with user and problem populated.

**Auth required:** Yes (admin/creator)

**Query parameters:**

| Param | Type | Values |
|-------|------|--------|
| `status` | string | `pending`, `running`, `accepted`, `rejected`, `error`, `timeout` |
| `problemId` | string | ObjectId |
| `userId` | string | ObjectId |
| `language` | string | Language key |
| `page` | int | ≥ 1, default 1 |
| `limit` | int | 1–100, default 20 |

**Success (200):**
```json
{
  "success": true,
  "data": {
    "submissions": [
      {
        "_id": "...",
        "userId": { "_id": "...", "firstName": "John", "lastName": "Doe", "email": "john@example.com" },
        "contestId": "...",
        "problemId": { "_id": "...", "title": "Two Sum", "slug": "two-sum", "type": "coding", "difficulty": "easy", "points": 100 },
        "language": "javascript",
        "code": "console.log('hi')",
        "status": "accepted",
        "testResults": [],
        "publicPassed": 1, "publicTotal": 1,
        "hiddenPassed": 3, "hiddenTotal": 3,
        "totalScore": 100,
        "executionTime": 12,
        "memoryUsed": 5120,
        "compilerOutput": null,
        "submittedAt": "...", "judgedAt": "...",
        "createdAt": "...", "updatedAt": "..."
      }
    ],
    "total": 240,
    "page": 1,
    "limit": 20,
    "totalPages": 12
  }
}
```

**Error codes:** `CONTEST_NOT_FOUND` (404)

**Admin panel notes:** Use the `status` filter for a "pending/rejected review" queue. Full code is included — display with a code viewer.

---

## 8. Admin — Languages

### POST /languages

**What it does:** Creates a judge language.

**Auth required:** Yes (admin/creator)

**Request body:**
```json
{
  "key": "javascript",              // required, lowercase letters/numbers only
  "name": "JavaScript",             // required, max 50
  "version": "Node 20",             // required, max 50
  "extension": "js",                // required, alphanumeric, no leading dot
  "compileCommand": null,           // optional, max 500
  "runCommand": "node {file}",      // required, max 500, must contain {file}
  "dockerImage": "node:20",         // required, max 200
  "logoUrl": "https://...",         // optional valid URL
  "enabled": true,                  // optional, default true
  "order": 1                        // optional int ≥ 0
}
```

**Success (201):** Returns the Language. Message: `"Language created"`.

**Error codes:** `LANGUAGE_KEY_EXISTS` (409)

---

### PATCH /languages/:key

**What it does:** Updates a language (`key` itself is not updatable). All fields optional.

**Success (200):** Returns the updated Language. Message: `"Language updated"`.

**Error codes:** `LANGUAGE_NOT_FOUND` (404)

---

### DELETE /languages/:key

**What it does:** Deletes a language. **Admin only.**

**Auth required:** Yes (**admin only**)

**Success (200):** `data: null`. Message: `"Language deleted"`.

**Error codes:** `LANGUAGE_NOT_FOUND` (404), `LANGUAGE_IN_USE` (409 — referenced by problems; disable it instead)

---

### POST /languages/:key/logo

**What it does:** Uploads a language logo (`multipart/form-data`, field `logo`). Compressed to WebP 256×256 → R2.

**Auth required:** Yes (admin/creator)

**Request:** `multipart/form-data` — `logo`: JPEG/PNG/WebP, max 5 MB.

**Success (200):** Returns the Language with `logoUrl` set. Message: `"Logo uploaded"`.

**Error codes:** `LOGO_REQUIRED` (400), `INVALID_LOGO` (400), `LANGUAGE_NOT_FOUND` (404)

---

## 9. Admin — Prizes

### POST /admin/contests/:id/prizes/redistribute

**What it does:** Re-runs prize distribution for a settled contest. **Idempotent** — already-credited winners are skipped; stuck `pending`/`failed` winners are retried. **Admin only.**

**Auth required:** Yes (**admin only**)

**Request body:** None

**Success (200):**
```json
{
  "success": true,
  "data": { "distributed": 10, "failed": 0, "netPool": 72000 },
  "message": "Prize distribution re-run"
}
```

**Error codes:** `CONTEST_NOT_FOUND` (404), `CONTEST_NOT_SETTLED` (400)

**Distribution rules:**
- Winners = submitted participants with `totalScore > 0`, top 10 by `(totalScore desc, submittedAt asc)`
- Ties split the rank's share: `amount = floor(netPool × share / tieCount)`
- Share table: 1st 40%, 2nd 25%, 3rd 15%, 4th 5%, 5th 5%, 6th–10th 2% (of netPool)
- `netPool = floor(entryFee × participantCount × (1 − PLATFORM_FEE_RATE))`
- Non-submitters forfeit the win, not their fee

**Admin panel notes:** Use after settle failures or manual wallet fixes. Writes an audit log entry (`action: "prize.redistribute"`).

---

## 10. Admin — Wallets

### PATCH /admin/wallets/:userId/status

**What it does:** Freezes or unfreezes a user's wallet. **Admin only.** A frozen wallet blocks contest joins and withdrawals.

**Auth required:** Yes (**admin only**)

**Request body:**
```json
{ "status": "frozen" }   // "active" | "frozen"
```

**Success (200):** Returns the Wallet document:
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "userId": "64a1b2c3...",
    "balance": 50000,
    "locked": 0,
    "totalDeposited": 100000,
    "totalWithdrawn": 0,
    "totalWon": 28800,
    "totalSpentOnFees": 2000,
    "status": "frozen",
    "createdAt": "...", "updatedAt": "..."
  }
}
```

**Error codes:** `WALLET_NOT_FOUND` (404 — user never transacted)

**Admin panel notes:** Writes an audit log entry (`action: "wallet.status"`).

---

## 11. Admin — Payments

### GET /admin/payments

**What it does:** Paginated listing of ALL payments, newest first, with the user populated.

**Auth required:** Yes (admin/creator)

**Query parameters:**

| Param | Type | Values |
|-------|------|--------|
| `status` | string | `created`, `attempted`, `paid`, `failed`, `refunded` |
| `userId` | string | ObjectId |
| `page` | int | ≥ 1, default 1 |
| `limit` | int | 1–100, default 20 |

**Success (200):**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "_id": "...",
        "userId": { "_id": "...", "firstName": "John", "lastName": "Doe", "email": "john@example.com" },
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
        "paidAt": "...", "refundedAt": null,
        "createdAt": "...", "updatedAt": "..."
      }
    ],
    "total": 87,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

---

### POST /admin/payments/refund

**What it does:** Refunds a **paid** payment to the user's wallet (reverse deposit). **Admin only.** Idempotent — already-refunded payments return as-is.

**Auth required:** Yes (**admin only**)

**Request body:**
```json
{ "paymentId": "64a1b2c3..." }   // our Payment id (not the Razorpay id)
```

**Success (200):** Returns the Payment (`status: "refunded"`, `refundId` + `refundedAt` set). Message: `"Payment refunded"`.

**Error codes:**
| Code | Status | Meaning |
|------|--------|---------|
| `PAYMENT_NOT_FOUND` | 404 | Payment id unknown |
| `PAYMENT_NOT_PAID` | 400 | Status not `paid` |
| `NO_WALLET_DEPOSIT` | 400 | No matching deposit ledger row |
| `PAYMENT_PROVIDER_ERROR` | 502 | Razorpay refund call failed (wallet is re-credited on retry) |

**Admin panel notes:**
- Refunds the wallet FIRST, then calls Razorpay; a provider failure re-credits the wallet and keeps the payment `paid` so retry is safe
- Fails with 400 if the user already spent the refunded amount (blocks double-pay)
- Writes an audit log entry (`action: "payment.refund"`)

---

## 12. Admin — Site Content

All site-content routes require `admin` or `creator`. Public GETs are documented in the Website guide; the write routes mirror them.

### Banners

| Method | Path | Body / Notes |
|--------|------|--------------|
| `POST` | `/site/banners` | `{ title (req, ≤120), subtitle, imageUrl, ctaText (≤60), ctaLink (http/https only — executable schemes blocked), order, active }` → 201 Banner |
| `PATCH` | `/site/banners/:id` | Same fields, all optional → 200 Banner |
| `DELETE` | `/site/banners/:id` | → 200 null (R2 object not deleted) |
| `POST` | `/site/banners/:id/image` | `multipart/form-data` field `image` (JPEG/PNG/WebP, ≤5MB) → 200 Banner with `imageUrl` set (WebP max 1920×720, R2) |

**Error codes:** `BANNER_NOT_FOUND` (404), `INVALID_BANNER_IMAGE` (400), `BANNER_IMAGE_REQUIRED` (400), `UPLOAD_NOT_CONFIGURED` (503)

### FAQs

| Method | Path | Body / Notes |
|--------|------|--------------|
| `POST` | `/site/faqs` | `{ question (req, ≤300), answer (req, ≤5000), category (≤60), order, active }` → 201 FAQ |
| `PATCH` | `/site/faqs/:id` | Same fields, all optional → 200 FAQ |
| `DELETE` | `/site/faqs/:id` | → 200 null |

**Error codes:** `FAQ_NOT_FOUND` (404)

### Why Choose Us

| Method | Path | Body / Notes |
|--------|------|--------------|
| `POST` | `/site/why-choose-us` | `{ title (req, ≤120), description (req, ≤1000), icon (≤100, default "✨"), order, active }` → 201 item |
| `PATCH` | `/site/why-choose-us/:id` | Same fields, all optional → 200 item |
| `DELETE` | `/site/why-choose-us/:id` | → 200 null |

**Error codes:** `WHY_CHOOSE_US_NOT_FOUND` (404)

### Site Logo

| Method | Path | Body / Notes |
|--------|------|--------------|
| `PUT` | `/site/logo` | `{ logoUrl, altText (≤120), tagline (≤200) }` — all optional → 200 logo singleton |
| `POST` | `/site/logo/upload` | `multipart/form-data` field `image` (JPEG/PNG/WebP, ≤5MB) → 200 logo with `logoUrl` set (WebP 512×512, R2) |

**Error codes:** `INVALID_LOGO_IMAGE` (400), `LOGO_IMAGE_REQUIRED` (400), `UPLOAD_NOT_CONFIGURED` (503)

**Admin panel notes:** Logo is a singleton (`key: "primary"`) — uploading replaces the previous image URL.

---

## 13. Admin — Audit Trail

### GET /admin/audit

**What it does:** Read-only paginated audit log, newest first. Entries are written by admin actions (kyc.review, user.status, user.role, contest.create/update/publish/cancel/freeze/settle, prize.redistribute, wallet.status, payment.refund).

**Auth required:** Yes (admin/creator)

**Query parameters:**

| Param | Type | Values |
|-------|------|--------|
| `action` | string | Exact action, e.g. `contest.publish`, `user.status`, `payment.refund` |
| `actorId` | string | Exact admin user id |
| `resource` | string | Exact resource, e.g. `user`, `contest`, `wallet`, `payment` |
| `page` | int | ≥ 1, default 1 |
| `limit` | int | 1–100, default 20 |

**Success (200):**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "_id": "...",
        "actorId": "64a1b2c3...",
        "actorRole": "admin",
        "action": "payment.refund",
        "resource": "payment",
        "resourceId": "64a1b2c3...",
        "details": { "status": "banned", "reason": "..." },
        "ip": "127.0.0.1",
        "createdAt": "...", "updatedAt": "..."
      }
    ],
    "total": 43,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

## 14. Webhooks

### POST /webhooks/razorpay

**What it does:** Razorpay webhook receiver. **No auth middleware** — trust comes from HMAC signature verification. Handles `payment.captured` (credits wallet), `payment.failed`, `refund.processed`/`refund.created`; safely ignores all other events.

**Headers:** `x-razorpay-signature` (required).

**Body:** Raw Razorpay event JSON (server verifies the HMAC over the exact raw bytes).

**Success:** `200 { success: true }` for valid signatures (including safely ignored events).

**Errors:**
| Code | Status | Meaning |
|------|--------|---------|
| — | 503 | `Webhooks are not configured` (missing `RAZORPAY_WEBHOOK_SECRET`) |
| — | 400 | `Missing signature or request body` |
| — | 400 | `Invalid signature` |
| — | 500 | `Processing failed` — Razorpay will retry |

**Admin panel notes:**
- Credit-on-capture is idempotent on the Razorpay payment id — replays never double-credit
- If a wallet is frozen, capture fails with 500 and Razorpay retries until the wallet is active (self-healing)

---

## 15. Health

### GET /health

**What it does:** Simple health check endpoint.

**Auth required:** No

**Success (200):**
```json
{
  "success": true,
  "data": { "status": "ok", "timestamp": "2026-08-17T10:23:21.343Z" }
}
```

---

## 16. Error Reference

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `USER_NOT_FOUND` | 404 | User not found |
| `VALIDATION_ERROR` | 400 | Request body failed validation |
| `NO_TOKEN` | 401 | Authorization header missing |
| `TOKEN_EXPIRED` | 401 | Access token expired (refresh needed) |
| `CANNOT_SELF_MODIFY` | 400 | Admin trying to change own status/role |
| `ADMIN_REQUIRED` | 403 | Admin login with non-admin role |
| `WALLET_NOT_FOUND` | 404 | Wallet not found (user never transacted) |
| `PAYMENT_NOT_FOUND` | 404 | Payment id unknown |
| `PAYMENT_NOT_PAID` | 400 | Refund attempted on non-paid payment |
| `NO_WALLET_DEPOSIT` | 400 | No deposit ledger row for the payment |
| `CONTEST_NOT_FOUND` | 404 | Contest missing |
| `CONTEST_NOT_DRAFT` | 400 | Draft-only operation on a published contest |
| `CONTEST_NOT_FROZEN` | 400 | Settle attempted on a non-frozen contest |
| `INVALID_STATE_TRANSITION` | 400 | Illegal contest status transition |
| `PROBLEM_NOT_FOUND` | 404 | Problem missing |
| `SLUG_EXISTS` | 409 | Slug already taken |
| `LANGUAGE_NOT_FOUND` | 404 | Language key unknown |
| `LANGUAGE_KEY_EXISTS` | 409 | Language key already exists |
| `LANGUAGE_IN_USE` | 409 | Language referenced by problems — disable instead |
| `BANNER_NOT_FOUND` | 404 | Banner id unknown |
| `FAQ_NOT_FOUND` | 404 | FAQ id unknown |
| `WHY_CHOOSE_US_NOT_FOUND` | 404 | Item id unknown |
| `UPLOAD_NOT_CONFIGURED` | 503 | R2 credentials missing |
| `UPLOAD_FAILED` | 500 | R2 upload failed |
| `INVALID_IMAGE_TYPE` | 400 | File MIME not JPEG/PNG/WebP |
| `IMAGE_PROCESSING_FAILED` | 400 | Sharp processing failed |

### Account Status Meanings

| Status | Meaning | Can login? |
|--------|---------|------------|
| `active` | Normal | ✅ Yes |
| `inactive` | Not active / soft-deleted | ❌ No |
| `flagged` | Under review (suspicious activity) | ❌ No |
| `banned` | Permanently blocked | ❌ No |

---

## 17. Schema Reference

### User

```typescript
{
  _id: string                    // MongoDB ObjectId
  firstName: string              // 1-50 chars
  lastName: string               // 1-50 chars
  fullName: string               // Virtual: firstName + lastName (document responses)
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
  problemIds: string[]           // Problem ids (ObjectIds)
  startTime: Date
  endTime: Date
  type: 'free' | 'paid'
  entryFee: number               // paise (0 for free)
  prizePool: number              // paise
  maxParticipants: number | null
  status: 'draft' | 'active' | 'frozen' | 'settled' | 'cancelled'
  rules: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}
```

### Problem

```typescript
{
  _id: string
  contestId: string
  title: string
  slug: string                   // unique per contest
  description: string
  imageUrls: string[]
  type: 'coding' | 'mcq'
  difficulty: 'easy' | 'medium' | 'hard'
  points: number
  order: number
  timeLimit: number              // ms (coding)
  memoryLimit: number            // MB (coding)
  languageSupport: string[]
  solutionTemplate: Record<string, string>
  testCases: Array<{ _id, input, expectedOutput, isPublic, order, description }>
  options: string[]              // MCQ
  correctAnswer: number | null   // MCQ, 0-based; NEVER returned publicly
  status: 'draft' | 'published'
  createdAt: Date
  updatedAt: Date
}
```

### Submission

```typescript
{
  _id: string
  userId: string
  contestId: string
  problemId: string
  language: string | null
  code: string
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

### Wallet

```typescript
{
  _id: string
  userId: string
  balance: number                // paise
  locked: number                 // 0 (escrow not yet implemented)
  totalDeposited: number
  totalWithdrawn: number
  totalWon: number
  totalSpentOnFees: number
  status: 'active' | 'frozen'
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
  description: string
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
  key: string                    // unique, lowercase alphanumeric
  name: string
  version: string
  extension: string              // no leading dot
  compileCommand: string | null
  runCommand: string             // contains {file}
  dockerImage: string
  logoUrl: string | null
  enabled: boolean
  order: number
  createdAt: Date
  updatedAt: Date
}
```

### Audit Log Entry

```typescript
{
  _id: string
  actorId: string                // admin/creator user id
  actorRole: string              // e.g. "admin"
  action: string                 // e.g. "user.status", "payment.refund", "contest.publish"
  resource: string               // e.g. "user", "contest", "wallet", "payment"
  resourceId: string | null
  details: object | null         // free-form, never secrets
  ip: string | null
  createdAt: Date
  updatedAt: Date
}
```