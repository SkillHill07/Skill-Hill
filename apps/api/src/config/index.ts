import "dotenv/config"

function env(key: string, fallback?: string): string {
  const v = process.env[key]
  if (v) return v
  if (fallback !== undefined) return fallback
  throw new Error(`missing env: ${key}`)
}

export const config = {
  PORT: Number(env("PORT", "4000")),
  MONGODB_URI: env("MONGODB_URI", "mongodb://localhost:27017/skillcontest"),
  // Upstash Redis (REST) — cache, OTP, refresh tokens, rate limiting, jobs.
  // Get the URL + token from the Upstash console → database → Connect → REST.
  UPSTASH_REDIS_REST_URL: env("UPSTASH_REDIS_REST_URL", ""),
  UPSTASH_REDIS_REST_TOKEN: env("UPSTASH_REDIS_REST_TOKEN", ""),
  JWT_SECRET: env("JWT_SECRET", "dev-jwt-secret-do-not-use-in-production"),
  JWT_REFRESH_SECRET: env(
    "JWT_REFRESH_SECRET",
    "dev-jwt-refresh-secret-do-not-use-in-production",
  ),
  ENCRYPTION_KEY: env(
    "ENCRYPTION_KEY",
    "dev-encryption-key-do-not-use-in-production",
  ),
  RAZORPAY_KEY_ID: env("RAZORPAY_KEY_ID", ""),
  RAZORPAY_KEY_SECRET: env("RAZORPAY_KEY_SECRET", ""),
  RAZORPAY_WEBHOOK_SECRET: env("RAZORPAY_WEBHOOK_SECRET", ""),
  // RazorpayX — business settlement account used for withdrawals (payouts).
  // The API key above must have payout permissions; the account number
  // identifies the RazorpayX settlement account to debit from.
  RAZORPAYX_ACCOUNT_NUMBER: env("RAZORPAYX_ACCOUNT_NUMBER", ""),

  // Payment — deposit order bounds in paise (₹10 min, ₹5,000 max per order).
  DEPOSIT_MIN_PAISE: Number(env("DEPOSIT_MIN_PAISE", "1000")),
  DEPOSIT_MAX_PAISE: Number(env("DEPOSIT_MAX_PAISE", "500000")),

  // Prizes — platform commission kept from the paid contest pool before
  // distribution (0.1 = 10%). The net pool is split per the share table.
  PLATFORM_FEE_RATE: Number(env("PLATFORM_FEE_RATE", "0.1")),
  R2_ACCOUNT_ID: env("R2_ACCOUNT_ID", ""),
  R2_ACCESS_KEY_ID: env("R2_ACCESS_KEY_ID", ""),
  R2_SECRET_ACCESS_KEY: env("R2_SECRET_ACCESS_KEY", ""),
  R2_PUBLIC_BUCKET: env("R2_PUBLIC_BUCKET", ""),
  R2_PUBLIC_URL: env("R2_PUBLIC_URL", "https://pub-xxxxx.r2.dev"),
  TURNSTILE_SECRET: env("TURNSTILE_SECRET", "1x0000000000000000000000000000000AA"),
  GOOGLE_CLIENT_ID: env("GOOGLE_CLIENT_ID", ""),
  GOOGLE_CLIENT_SECRET: env("GOOGLE_CLIENT_SECRET", ""),
  GOOGLE_CALLBACK_URL: env(
    "GOOGLE_CALLBACK_URL",
    "http://localhost:4000/auth/google/callback",
  ),
  GITHUB_CLIENT_ID: env("GITHUB_CLIENT_ID", ""),
  GITHUB_CLIENT_SECRET: env("GITHUB_CLIENT_SECRET", ""),
  GITHUB_CALLBACK_URL: env(
    "GITHUB_CALLBACK_URL",
    "http://localhost:4000/auth/github/callback",
  ),
  FRONTEND_URL: env("FRONTEND_URL", "http://localhost:3000"),
  CORS_ORIGINS: env("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001"),
  // Email — uses Gmail SMTP with app password
  EMAIL_USER: env("EMAIL_USER", ""),
  EMAIL_APP_PASSWORD: env("EMAIL_APP_PASSWORD", ""),
  NODE_ENV: env("NODE_ENV", "development"),

  // Wallet — minimum withdrawal amount in paise (₹100 = 10000 paise).
  // ponytail: a per-day withdrawal cap is deferred — it needs a daily
  // aggregation query; add WITHDRAWAL_MAX_DAILY_PAISE when the payment
  // module is battle-tested.
  WITHDRAWAL_MIN_PAISE: Number(env("WITHDRAWAL_MIN_PAISE", "10000")),

  // Token durations — AI_rules §D: short-lived access (15 min), longer-lived
  // refresh (7 days), rotated on every use. Clients must call POST /auth/refresh
  // on 401 and retry; both first-party apps do this transparently.
  ACCESS_TOKEN_EXPIRY: "15m",
  ACCESS_TOKEN_EXPIRY_SECONDS: 15 * 60, // 15 minutes in seconds
  ACCESS_TOKEN_EXPIRY_MS: 15 * 60 * 1000, // 15 minutes in ms (for cookie maxAge)

  REFRESH_TOKEN_EXPIRY: "7d",
  REFRESH_TOKEN_EXPIRY_SECONDS: 7 * 24 * 60 * 60, // 7 days in seconds
  REFRESH_TOKEN_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000, // 7 days in ms (for cookie maxAge)
} as const
