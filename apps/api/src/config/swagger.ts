import swaggerJsdoc from "swagger-jsdoc"

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "SkillHill API",
      version: "0.7.0",
      description: `
Skill-based coding contest platform. Users pay ₹20 to join a contest and win a prize.

# Authentication

Tokens are stored in **HttpOnly, Secure (prod), SameSite=Lax cookies** and also returned in the response body for backward compatibility.

- **Access token**: 7 days (stored in \`accessToken\` cookie + response body)
- **Refresh token**: 30 days (stored in \`refreshToken\` cookie + response body, rotated on use)

## Email/Password Auth
| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | /auth/register | No | 3/min | Register with email + password + Turnstile |
| POST | /auth/login | No | 5/min | Login with email + password + Turnstile |
| POST | /auth/refresh | No | 10/min | Refresh tokens (reads from cookie or body) |
| POST | /auth/logout | Yes | — | Logout, clear cookies, revoke refresh token |
| GET | /auth/me | Yes | — | Get current user profile |
| PUT | /auth/me | Yes | — | Update profile (multipart, optional avatar upload) |
| DELETE | /auth/me | Yes | — | Soft-delete own account |
| GET | /auth/check | Yes | — | Validate session and return user status |
| POST | /auth/set-password | Yes | — | Set password for OAuth accounts / change password |

## Google OAuth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /auth/google | No | Redirect to Google consent screen |
| GET | /auth/google/callback | No | OAuth callback — sets cookies, redirects to frontend |
| GET | /auth/google/url | No | Get Google OAuth URL as JSON (for popup flows) |
| POST | /auth/google/link | Yes | Link Google account to existing user |

## GitHub OAuth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /auth/github | No | Redirect to GitHub consent screen |
| GET | /auth/github/callback | No | OAuth callback — sets cookies, redirects to frontend |
| GET | /auth/github/url | No | Get GitHub OAuth URL as JSON (for popup flows) |
| POST | /auth/github/link | Yes | Link GitHub account to existing user |

## Email OTP
| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | /auth/otp/send | Yes | 5/min | Send 6-digit OTP to email (10min expiry) |
| POST | /auth/otp/verify | Yes | 5/min | Verify OTP (max 5 attempts) |

## KYC (Bank/UPI/PAN)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | /auth/kyc | Yes | Update PAN, bank account, IFSC, UPI (encrypted at rest AES-256-GCM) |
| GET | /auth/kyc/status | Yes | Get KYC verification status (booleans only) |
| GET | /auth/kyc/details | Yes | Get decrypted KYC values (self only) |

## Admin — Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /admin/auth/login | No | Admin login — verifies admin/creator role, sets cookies |

## Password Reset
| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | /auth/forgot-password | No | 3/min | Request password reset email (no email enumeration) |
| POST | /auth/reset-password | No | 5/min | Reset password using token from email |

## Admin — KYC Review
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /admin/kyc/pending | Admin/Creator | List all pending KYC submissions |
| GET | /admin/kyc/:userId | Admin/Creator | Get decrypted KYC details for a user |
| PUT | /admin/kyc/:userId/review | Admin/Creator | Approve or reject KYC submission |

## Admin — Account Management
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /admin/accounts | Admin/Creator | List users with filters (status, role, search, pagination) |
| GET | /admin/accounts/:userId | Admin/Creator | Get full user details |
| PATCH | /admin/accounts/:userId/status | Admin only | Ban/unban/flag/activate a user |
| PATCH | /admin/accounts/:userId/role | Admin only | Change user role |

## Admin — Submissions
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /admin/contests/:contestId/submissions | Admin/Creator | Audit view — all submissions in a contest (filters + pagination, user/problem populated) |

## Languages
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /languages | Public | List enabled languages |
| GET | /languages?includeDisabled=true | Admin/Creator | List all languages |
| GET | /languages/:key | Public | Single language (disabled hidden from non-staff) |
| POST | /languages | Admin/Creator | Create a language |
| PATCH | /languages/:key | Admin/Creator | Update a language |
| POST | /languages/:key/logo | Admin/Creator | Upload language logo (multipart, Cloudflare R2) |
| DELETE | /languages/:key | Admin | Delete a language (409 if referenced by problems) |

## Submissions
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /contests/:id/submissions | User | Submit code (202, async judged; rate-limited 1/30s/problem) |
| GET | /contests/:id/submissions | User | List own submissions |
| GET | /contests/:id/submissions/:sid | User | Single submission (owner or staff; public test results only) |

## Leaderboards
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /contests/:id/leaderboard | Public | Top ranked participants (best score wins, ties by earlier submission; ?limit= up to 100) |
| GET | /contests/:id/leaderboard/me | User | Current user's rank & score (rank null until first submission) |

## Wallet
Central ledger — all money movement on the platform. Amounts in paise integers.
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /wallet/balance | User | Balance summary (available = balance − locked) + lifetime totals |
| GET | /wallet/transactions | User | Paginated ledger history (?type=&page=&limit=) |
| POST | /wallet/deposit | User | Create a Razorpay order to deposit funds (alias of POST /payments/create-order) |
| POST | /wallet/withdraw | User | Request withdrawal — KYC verified, pays out via RazorpayX UPI (503 until RazorpayX env configured) |

## Payments
Razorpay orders → HMAC-verified webhook → wallet deposit. Amounts in paise.
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /payments/create-order | User | Create a Razorpay order (returns orderId + keyId for Checkout) |
| GET | /payments | User | Own payment history (?status=&page=&limit=) |

## Webhooks
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /webhooks/razorpay | None (HMAC) | Razorpay webhook — payment.captured/failed + refund.processed; credits the wallet on capture |

## Admin — Payments
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /admin/payments | Admin/Creator | Audit view — all payments, user populated (?status=&userId=&page=&limit=) |
| POST | /admin/payments/refund | Admin only | Refund a captured payment to the user's card (reverses wallet deposit first) |

## Prizes
Distribution credits winners' wallets when a contest settles (pool = entryFee × participants, platform fee PLATFORM_FEE_RATE, share table 40/25/15/5/5/2×5). Ties split their rank's share.
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /contests/:id/prizes | Public | Prize structure (share table + indicative amounts) and winners once settled |
| GET | /prizes | User | Own prize history (contest title/slug populated) |

## Admin — Prizes
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /admin/contests/:id/prizes/redistribute | Admin only | Re-run distribution for a settled contest (idempotent — retries stuck/failed credits) |

## Admin — Wallets
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PATCH | /admin/wallets/:userId/status | Admin only | Freeze/unfreeze a wallet (blocks all balance mutations) |

## Site Logo
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /site/logo | Public | Get the site logo (singleton — auto-created) |
| PUT | /site/logo | Admin/Creator | Update logo altText / tagline / logoUrl |
| POST | /site/logo/upload | Admin/Creator | Upload logo image (multipart, Cloudflare R2, 512x512 WebP) |

## Why Choose Us
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /site/why-choose-us | Public | List active items (ordered); \`?includeInactive=true\` for staff |
| POST | /site/why-choose-us | Admin/Creator | Create an item |
| PATCH | /site/why-choose-us/:id | Admin/Creator | Update an item |
| DELETE | /site/why-choose-us/:id | Admin/Creator | Delete an item |

## Banners
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /site/banners | Public | List active banners (ordered); \`?includeInactive=true\` for staff |
| POST | /site/banners | Admin/Creator | Create a banner |
| PATCH | /site/banners/:id | Admin/Creator | Update a banner |
| DELETE | /site/banners/:id | Admin/Creator | Delete a banner |
| POST | /site/banners/:id/image | Admin/Creator | Upload banner image (multipart, R2, max 1920x720 WebP) |

## FAQ
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /site/faqs | Public | List active FAQs (\`?category=\` filter); \`?includeInactive=true\` for staff |
| POST | /site/faqs | Admin/Creator | Create an FAQ |
| PATCH | /site/faqs/:id | Admin/Creator | Update an FAQ |
| DELETE | /site/faqs/:id | Admin/Creator | Delete an FAQ |

## Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | No | Health check endpoint |

## WebSocket Events (socket.io)
Connect to the socket.io endpoint (same origin) with the JWT via \`auth.token\`, an
\`Authorization: Bearer\` header, or the \`accessToken\` cookie. Authenticated clients are
placed in \`user:{userId}\` rooms and receive submission status events for their own
submissions:

| Event | Payload | Description |
|-------|---------|-------------|
| submission:queued | submissionId, contestId, problemId, status | Submission entered the judge queue |
| submission:running | submissionId, contestId, problemId, status | Judge worker started |
| submission:completed | submissionId, contestId, problemId, status + result fields | Judging finished (public results only) |

# Key Security Features
- **JWT**: 7-day access tokens, 30-day refresh tokens with rotation (set as HttpOnly cookies)
- **Redis**: Refresh token revocation, OTP storage, rate limiting cooldown
- **Turnstile**: CAPTCHA verification on register, login, forgot-password
- **Encryption**: KYC fields (PAN, bank account, IFSC, UPI) encrypted at rest using AES-256-GCM
- **Payments**: Razorpay orders with webhook-only capture confirmation (HMAC-verified raw body), idempotent wallet deposits, RazorpayX UPI payouts for withdrawals
- **Rate Limiting**: Per-IP rate limiting on auth-sensitive endpoints (rate-limiter-flexible with Redis)
- **Email Enumeration Prevention**: Forgot-password always returns success
- **Session Revocation**: Password reset, account ban/flag, and logout revoke all active sessions
- **Image Upload**: Avatars (400x400), language logos (256x256), problem images, and site logo/banner images compressed to WebP via Sharp, uploaded to Cloudflare R2, max 5MB
- **Social Login**: Google and GitHub OAuth with account linking support
      `,
    },
    servers: [
      { url: "http://localhost:4000", description: "development" },
    ],
    tags: [
      { name: "Auth", description: "Email/password registration, login, token management, profile" },
      { name: "Auth - Google OAuth", description: "Google OAuth sign-in and account linking" },
      { name: "Auth - GitHub OAuth", description: "GitHub OAuth sign-in and account linking" },
      { name: "Auth - OTP", description: "Email verification via OTP codes" },
      { name: "Auth - KYC", description: "KYC details (PAN, bank account, UPI) management" },
      { name: "Admin - KYC", description: "Admin KYC review workflows" },
      { name: "Admin - Accounts", description: "Admin user account management" },
      { name: "Contests", description: "Contest lifecycle: create, publish, join, freeze, settle" },
      { name: "Problems", description: "Problem and test case management" },
      { name: "Languages", description: "Supported judge languages catalog" },
      { name: "Submissions", description: "Code submission lifecycle and async judging" },
      { name: "Admin - Submissions", description: "Admin audit view of contest submissions" },
      { name: "Leaderboards", description: "Contest rankings (live + final)" },
      { name: "Wallet", description: "User balances, ledger history, withdrawals" },
      { name: "Admin - Wallets", description: "Admin wallet controls (freeze/unfreeze)" },
      { name: "Payments", description: "Razorpay orders and payment history" },
      { name: "Admin - Payments", description: "Admin payment audit and refunds" },
      { name: "Prizes", description: "Prize distribution and winner history" },
      { name: "Admin - Prizes", description: "Admin prize redistribution" },
      { name: "Webhooks", description: "Razorpay webhook (HMAC verified)" },
      { name: "Site Content", description: "Public marketing-site content: logo, why choose us, banners, FAQ" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT access token. Provide via Authorization header or the accessToken cookie (HttpOnly, set automatically on login).",
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "accessToken",
          description: "HttpOnly cookie set by server on login. The refreshToken cookie is used for token refresh.",
        },
      },
      schemas: {
        // --- Common Base Fields ---
        BaseModel: {
          type: "object",
          description: "Base fields shared by all models",
          properties: {
            _id: { type: "string", description: "MongoDB unique identifier" },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp when the document was created",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Timestamp when the document was last updated",
            },
            deletedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Timestamp when the document was soft-deleted (null if active)",
            },
            status: {
              type: "string",
              enum: ["draft", "published", "archived", "deleted"],
              description: "Controls visibility on the website. Only 'published' items are shown publicly.",
            },
          },
        },

        // --- User Schema ---
        User: {
          allOf: [
            { $ref: "#/components/schemas/BaseModel" },
            {
              type: "object",
              properties: {
                firstName: {
                  type: "string",
                  description: "User's first name",
                  example: "John",
                },
                lastName: {
                  type: "string",
                  description: "User's last name",
                  example: "Doe",
                },
                fullName: {
                  type: "string",
                  description: "Computed full name (firstName + lastName)",
                  example: "John Doe",
                  readOnly: true,
                },
                email: {
                  type: "string",
                  format: "email",
                  description: "User's email address (unique, lowercase)",
                  example: "john@example.com",
                },
                phone: {
                  type: "string",
                  nullable: true,
                  description: "User's phone number without country code",
                  example: "9876543210",
                },
                phoneCountryCode: {
                  type: "string",
                  nullable: true,
                  description: "Country code for phone number",
                  example: "+91",
                },
                isEmailVerified: {
                  type: "boolean",
                  description: "Whether the email has been verified",
                  example: false,
                },
                isPhoneVerified: {
                  type: "boolean",
                  description: "Whether the phone number has been verified",
                  example: false,
                },
                accountStatus: {
                  type: "string",
                  enum: ["active", "inactive", "flagged", "banned"],
                  description:
                    "Account status. 'active' = normal, 'inactive' = not active, 'flagged' = under review for suspicious activity, 'banned' = permanently blocked.",
                  example: "active",
                },
                role: {
                  type: "string",
                  enum: ["user", "admin", "creator"],
                  description: "User role for authorization",
                  example: "user",
                },
                authProvider: {
                  type: "string",
                  enum: ["email", "google", "github"],
                  description: "How the user registered — 'email' for email/password, 'google' or 'github' for OAuth",
                  example: "email",
                },
                googleId: {
                  type: "string",
                  nullable: true,
                  description: "Google OAuth unique identifier (if linked)",
                },
                githubId: {
                  type: "string",
                  nullable: true,
                  description: "GitHub OAuth unique user ID (if linked)",
                },
                avatarUrl: {
                  type: "string",
                  nullable: true,
                  description: "URL of the user's uploaded avatar (hosted on Cloudflare R2)",
                  example: "https://pub-xxxxx.r2.dev/avatars/user123/abc123.webp",
                },
                panVerified: {
                  type: "boolean",
                  description: "Whether the PAN card has been verified",
                  example: false,
                },
                kycStatus: {
                  type: "string",
                  enum: ["pending", "verified", "rejected"],
                  description: "Overall KYC verification status. 'pending' = awaiting verification, 'verified' = all KYC approved, 'rejected' = verification failed.",
                  example: "pending",
                },
                walletBalance: {
                  type: "number",
                  description: "Wallet balance in paise (1 INR = 100 paise)",
                  example: 0,
                },
                lastLoginAt: {
                  type: "string",
                  format: "date-time",
                  nullable: true,
                  description: "Timestamp of the last successful login",
                },
              },
            },
          ],
        },

        // --- Auth ---
        AuthTokens: {
          type: "object",
          properties: {
            accessToken: {
              type: "string",
              description: "JWT access token (7 days). Also set as HttpOnly cookie.",
            },
            refreshToken: {
              type: "string",
              description: "JWT refresh token (30 days, rotated on use). Also set as HttpOnly cookie.",
            },
            expiresIn: {
              type: "integer",
              description: "Access token expiry in seconds",
              example: 604800,
            },
          },
        },

        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {},
            message: { type: "string", nullable: true },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: { type: "string" },
            message: { type: "string", nullable: true },
          },
        },
      },
    },
  },
  apis: ["./src/modules/**/*.routes.ts", "./src/modules/**/*.schema.ts"],
}

export const swaggerSpec = swaggerJsdoc(options)
