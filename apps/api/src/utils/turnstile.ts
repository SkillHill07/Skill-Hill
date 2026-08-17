import { config } from "../config/index.js"
import { logger } from "./logger.js"

/**
 * Server-side Cloudflare Turnstile verification.
 *
 * Required on: signup, login, contest-join, withdrawal (AI_rules section D).
 * Always passes in development/test environments.
 */
export async function verifyTurnstile(token: string): Promise<boolean> {
  if (config.NODE_ENV === "development" || config.NODE_ENV === "test") {
    return true
  }

  try {
    const formData = new URLSearchParams()
    formData.append("secret", config.TURNSTILE_SECRET)
    formData.append("response", token)

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: formData },
    )

    const data = (await response.json()) as { success: boolean }
    return data.success
  } catch (err) {
    logger.error({ err }, "turnstile_verify_error")
    return false
  }
}
