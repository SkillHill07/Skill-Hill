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
  REDIS_URL: env("REDIS_URL", "redis://localhost:6379"),
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
  // Email — uses Gmail SMTP with app password by default
  SMTP_HOST: env("SMTP_HOST", "smtp.gmail.com"),
  SMTP_PORT: Number(env("SMTP_PORT", "587")),
  EMAIL_USER: env("EMAIL_USER", ""),
  EMAIL_APP_PASSWORD: env("EMAIL_APP_PASSWORD", ""),
  SMTP_FROM: env("SMTP_FROM", ""),
  NODE_ENV: env("NODE_ENV", "development"),

  // Token durations
  ACCESS_TOKEN_EXPIRY: "7d",
  ACCESS_TOKEN_EXPIRY_SECONDS: 7 * 24 * 60 * 60, // 7 days in seconds
  ACCESS_TOKEN_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000, // 7 days in ms (for cookie maxAge)

  REFRESH_TOKEN_EXPIRY: "30d",
  REFRESH_TOKEN_EXPIRY_SECONDS: 30 * 24 * 60 * 60, // 30 days in seconds
  REFRESH_TOKEN_EXPIRY_MS: 30 * 24 * 60 * 60 * 1000, // 30 days in ms (for cookie maxAge)
} as const
