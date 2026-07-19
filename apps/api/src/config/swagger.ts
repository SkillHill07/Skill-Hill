import swaggerJsdoc from "swagger-jsdoc"

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Skills Arena API",
      version: "0.3.0",
      description: `
Skill-based coding contest platform. Users pay ₹20 to join a contest and win a prize.

# Authentication Routes

All auth endpoints are under /auth. Tokens use JWT (15min access + 7 day refresh with rotation).

## Email/Password Auth
| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | /auth/register | No | 3/min | Register with email + password + Turnstile |
| POST | /auth/login | No | 5/min | Login with email + password + Turnstile |
| POST | /auth/refresh | No | 10/min | Refresh access token using refresh token |
| POST | /auth/logout | Yes | — | Logout and revoke refresh token |
| GET | /auth/me | Yes | — | Get current user profile |
| PUT | /auth/me | Yes | — | Update profile (multipart, optional avatar upload) |
| DELETE | /auth/me | Yes | — | Soft-delete own account |
| GET | /auth/check | Yes | — | Validate session and return user status |
| POST | /auth/set-password | Yes | — | Set password for OAuth accounts / change password |

## Google OAuth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /auth/google | No | Redirect to Google consent screen |
| GET | /auth/google/callback | No | OAuth callback — exchanges code for tokens |
| GET | /auth/google/url | No | Get Google OAuth URL as JSON (for popup flows) |
| POST | /auth/google/link | Yes | Link Google account to existing user |

## GitHub OAuth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /auth/github | No | Redirect to GitHub consent screen |
| GET | /auth/github/callback | No | OAuth callback — exchanges code for tokens |
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

## Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | No | Health check endpoint |

# Key Security Features
- **JWT**: 15min access tokens, 7 day refresh tokens with rotation
- **Redis**: Refresh token revocation, OTP storage, rate limiting cooldown
- **Turnstile**: CAPTCHA verification on register, login, forgot-password
- **Encryption**: KYC fields (PAN, bank account, IFSC, UPI) encrypted at rest using AES-256-GCM
- **Rate Limiting**: Per-IP rate limiting on auth-sensitive endpoints (rate-limiter-flexible with Redis)
- **Email Enumeration Prevention**: Forgot-password always returns success
- **Session Revocation**: Password reset, account ban/flag, and logout revoke all active sessions
- **Avatar Upload**: Images compressed to WebP (400x400) via Sharp, uploaded to Cloudflare R2, max 5MB
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
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
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
              description: "Short-lived JWT access token (15 minutes)",
            },
            refreshToken: {
              type: "string",
              description: "Long-lived JWT refresh token (7 days, rotated on use)",
            },
            expiresIn: {
              type: "integer",
              description: "Access token expiry in seconds",
              example: 900,
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
