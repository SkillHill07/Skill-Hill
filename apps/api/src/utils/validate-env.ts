import { config } from "../config/index.js"

interface EnvCheck {
  key: string
  value: string | number
  /** If set, the env var is required in production — server exits if missing/using dev default */
  productionCritical?: true
  /** If set, the env var is required for a specific feature (warns if empty) */
  feature?: string
  /** Dev-only default value to flag if still present in production */
  devDefault?: string
}

const CHECKS: EnvCheck[] = [
  // --- Critical — must be set in production ---
  {
    key: "JWT_SECRET",
    value: config.JWT_SECRET,
    productionCritical: true,
    devDefault: "dev-jwt-secret-do-not-use-in-production",
  },
  {
    key: "JWT_REFRESH_SECRET",
    value: config.JWT_REFRESH_SECRET,
    productionCritical: true,
    devDefault: "dev-jwt-refresh-secret-do-not-use-in-production",
  },
  {
    key: "ENCRYPTION_KEY",
    value: config.ENCRYPTION_KEY,
    productionCritical: true,
    devDefault: "dev-encryption-key-do-not-use-in-production",
  },
  {
    key: "MONGODB_URI",
    value: config.MONGODB_URI,
    productionCritical: true,
    devDefault: "mongodb://localhost:27017/skillcontest",
  },

  // --- Feature-gated — warn if empty but don't block startup ---
  {
    key: "EMAIL_USER",
    value: config.EMAIL_USER,
    feature: "Email (password reset, OTP)",
  },
  {
    key: "EMAIL_APP_PASSWORD",
    value: config.EMAIL_APP_PASSWORD,
    feature: "Email (password reset, OTP)",
  },
  {
    key: "GOOGLE_CLIENT_ID",
    value: config.GOOGLE_CLIENT_ID,
    feature: "Google OAuth sign-in",
  },
  {
    key: "GOOGLE_CLIENT_SECRET",
    value: config.GOOGLE_CLIENT_SECRET,
    feature: "Google OAuth sign-in",
  },
  {
    key: "GITHUB_CLIENT_ID",
    value: config.GITHUB_CLIENT_ID,
    feature: "GitHub OAuth sign-in",
  },
  {
    key: "GITHUB_CLIENT_SECRET",
    value: config.GITHUB_CLIENT_SECRET,
    feature: "GitHub OAuth sign-in",
  },
  {
    key: "REDIS_URL",
    value: config.REDIS_URL,
    feature: "Rate limiting, refresh tokens, OTP storage, caching",
  },
  {
    key: "TURNSTILE_SECRET",
    value: config.TURNSTILE_SECRET,
    feature: "CAPTCHA verification (register, login, forgot-password)",
    devDefault: "1x0000000000000000000000000000000AA",
  },
  {
    key: "RAZORPAY_KEY_ID",
    value: config.RAZORPAY_KEY_ID,
    feature: "Payment processing",
  },
  {
    key: "RAZORPAY_KEY_SECRET",
    value: config.RAZORPAY_KEY_SECRET,
    feature: "Payment processing",
  },
  {
    key: "RAZORPAY_WEBHOOK_SECRET",
    value: config.RAZORPAY_WEBHOOK_SECRET,
    feature: "Payment webhooks (wallet deposits on capture)",
  },
  {
    key: "RAZORPAYX_ACCOUNT_NUMBER",
    value: config.RAZORPAYX_ACCOUNT_NUMBER,
    feature: "RazorpayX payouts (withdrawals)",
  },
  {
    key: "R2_ACCOUNT_ID",
    value: config.R2_ACCOUNT_ID,
    feature: "Image uploads (avatars, language logos — Cloudflare R2)",
  },
  {
    key: "R2_ACCESS_KEY_ID",
    value: config.R2_ACCESS_KEY_ID,
    feature: "Image uploads (avatars, language logos — Cloudflare R2)",
  },
  {
    key: "R2_SECRET_ACCESS_KEY",
    value: config.R2_SECRET_ACCESS_KEY,
    feature: "Image uploads (avatars, language logos — Cloudflare R2)",
  },
]

/**
 * Validate environment variables on startup.
 *
 * - In **production**: exits hard if any critical var is missing or still using a
 *   dev-only default. Warns about missing feature-gated vars.
 * - In **development**: logs a summary of what's configured and what's not.
 */
export function validateEnv(): void {
  const isProduction = config.NODE_ENV === "production"

  const errors: string[] = []
  const warnings: string[] = []
  const info: string[] = []

  for (const check of CHECKS) {
    const str = String(check.value)
    const isEmpty = str === "" || str === "0"
    const isDevDefault =
      check.devDefault !== undefined && str === check.devDefault

    // Production: reject dev defaults or empty critical vars
    if (isProduction) {
      if (check.productionCritical && (isEmpty || isDevDefault)) {
        errors.push(
          `${check.key} must be set —${
            isEmpty ? " currently empty" : " still using dev default"
          }`,
        )
        continue
      }
    }

    // Missing feature-gated var
    if (isEmpty && check.feature) {
      warnings.push(`${check.key} is empty — ${check.feature} will not work`)
      continue
    }

    // Still using dev default
    if (isDevDefault) {
      if (isProduction) {
        if (check.productionCritical) {
          errors.push(`${check.key} is still using the dev default`)
        } else {
          warnings.push(
            `${check.key} is using the test/dev default — not secure for production`,
          )
        }
      } else {
        info.push(`${check.key} using dev default — OK for development`)
      }
      continue
    }

    // Everything looks fine
    if (!isEmpty) {
      info.push(`${check.key} ✓ configured`)
    }
  }

  // --- Report ---

  if (errors.length > 0) {
    console.error("\n✖ Environment validation failed:\n")
    for (const err of errors) {
      console.error(`  ✖ ${err}`)
    }
    console.error(
      "\nSet the missing values in your .env file and restart the server.\n",
    )
    process.exit(1)
  }

  if (warnings.length > 0) {
    console.warn("\n⚠ Environment warnings:\n")
    for (const w of warnings) {
      console.warn(`  ⚠ ${w}`)
    }
    if (isProduction) {
      console.warn(
        "\nThese features will be unavailable until the corresponding env vars are set.\n",
      )
    } else {
      console.warn(
        "\nThese features will gracefully degrade in development. Set the vars to enable them.\n",
      )
    }
  }

  if (info.length > 0) {
    console.log("\n✓ Environment:\n")
    console.log(`  Mode: ${config.NODE_ENV}`)
    for (const i of info) {
      console.log(`  ${i}`)
    }
    console.log("")
  }
}
