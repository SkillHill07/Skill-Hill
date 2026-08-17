# SkillHill API — Admin Panel Guide

> **For admin panel developers implementing admin-specific features.**
> Last updated: July 2026 | API Version: 0.4.0

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Admin — KYC Review](#2-admin--kyc-review)
3. [Admin — Account Management](#3-admin--account-management)
4. [Health](#4-health)
5. [Error Reference](#5-error-reference)
6. [User Schema Reference](#6-user-schema-reference)

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
| Admin — Status Changes | `admin` only |
| Admin — Role Changes | `admin` only |

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

---

## 2. Admin — KYC Review

All endpoints in this section are mounted under `/admin/kyc` and require `admin` or `creator` role.

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

---

## 3. Admin — Account Management

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
    "users": [ /* Array of User objects */ ],
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

### Related KYC Link

From the user details page, you can navigate to `GET /admin/kyc/:userId` to view decrypted KYC data for that user. This is part of the admin KYC review system (section 2 above).

---

## 4. Health

### GET /health

**What it does:** Simple health check endpoint.

**Auth required:** No

**Success (200):**
```json
{
  "success": true,
  "data": { "status": "ok" }
}
```

---

## 5. Error Reference

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `USER_NOT_FOUND` | 404 | User not found |
| `VALIDATION_ERROR` | 400 | Request body failed validation |
| `NO_TOKEN` | 401 | Authorization header missing |
| `TOKEN_EXPIRED` | 401 | Access token expired (refresh needed) |
| `CANNOT_SELF_MODIFY` | 400 | Admin trying to change own status/role |

### Account Status Meanings

| Status | Meaning | Can login? |
|--------|---------|------------|
| `active` | Normal | ✅ Yes |
| `inactive` | Not active / soft-deleted | ❌ No |
| `flagged` | Under review (suspicious activity) | ❌ No |
| `banned` | Permanently blocked | ❌ No |

---

## 6. User Schema Reference

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
