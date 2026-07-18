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
  JWT_SECRET: env("JWT_SECRET"),
  JWT_REFRESH_SECRET: env("JWT_REFRESH_SECRET"),
  RAZORPAY_KEY_ID: env("RAZORPAY_KEY_ID", ""),
  RAZORPAY_KEY_SECRET: env("RAZORPAY_KEY_SECRET", ""),
  RAZORPAY_WEBHOOK_SECRET: env("RAZORPAY_WEBHOOK_SECRET", ""),
  R2_ACCOUNT_ID: env("R2_ACCOUNT_ID", ""),
  R2_ACCESS_KEY_ID: env("R2_ACCESS_KEY_ID", ""),
  R2_SECRET_ACCESS_KEY: env("R2_SECRET_ACCESS_KEY", ""),
  R2_PUBLIC_BUCKET: env("R2_PUBLIC_BUCKET", ""),
  TURNSTILE_SECRET: env("TURNSTILE_SECRET", ""),
  NODE_ENV: env("NODE_ENV", "development"),
} as const
