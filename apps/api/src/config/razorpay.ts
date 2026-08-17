import Razorpay from "razorpay"
import { config } from "./index.js"

/**
 * Razorpay clients.
 *
 * - `getRazorpay()` — the official `razorpay` npm SDK (orders, payments,
 *   refunds, webhook signature validation). Lazy singleton, mirrors the
 *   `config/redis.ts` pattern.
 * - `razorpayX` — a thin client for the RazorpayX (payouts) REST API
 *   (`/v1/contacts`, `/v1/fund_accounts`, `/v1/payouts`). Uses Node's global
 *   fetch with HTTP Basic auth — no extra SDK dependency. RazorpayX uses the
 *   same key id/secret (the key must have payout permissions) plus the
 *   business `account_number` that identifies the settlement account.
 *
 * Both are feature-gated on env: without credentials every payment/payout
 * endpoint fast-fails with 503 PAYMENTS_NOT_CONFIGURED.
 */

let sdkClient: Razorpay | null = null

/** True when the main payment SDK (orders/webhooks/refunds) is configured. */
export function isPaymentsConfigured(): boolean {
  return Boolean(config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET)
}

/** True when RazorpayX payouts (withdrawals) are fully configured. */
export function isPayoutsConfigured(): boolean {
  return Boolean(
    config.RAZORPAY_KEY_ID &&
      config.RAZORPAY_KEY_SECRET &&
      config.RAZORPAYX_ACCOUNT_NUMBER,
  )
}

/** Lazy Razorpay SDK singleton — null when payments are not configured. */
export function getRazorpay(): Razorpay | null {
  if (!isPaymentsConfigured()) return null
  if (!sdkClient) {
    sdkClient = new Razorpay({
      key_id: config.RAZORPAY_KEY_ID,
      key_secret: config.RAZORPAY_KEY_SECRET,
    })
  }
  return sdkClient
}

// --- RazorpayX (payouts) ---

const RAZORPAYX_BASE_URL = "https://api.razorpay.com"

interface RazorpayXErrorBody {
  error?: { description?: string; code?: string }
}

function xError(message: string, status: number, code: string): Error {
  return Object.assign(new Error(message), { status, code })
}

async function xRequest<T>(
  path: string,
  data: Record<string, unknown>,
): Promise<T> {
  if (!isPayoutsConfigured()) {
    throw xError(
      "Withdrawals are not available yet — payment processing is not configured",
      503,
      "PAYMENTS_NOT_CONFIGURED",
    )
  }

  const auth = Buffer.from(
    `${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`,
  ).toString("base64")

  let res: Response
  try {
    res = await fetch(`${RAZORPAYX_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  } catch (err) {
    throw xError(
      `Payout provider unreachable: ${(err as Error).message}`,
      502,
      "RAZORPAYX_ERROR",
    )
  }

  const body = (await res.json().catch(() => ({}))) as T & RazorpayXErrorBody
  if (!res.ok) {
    throw xError(
      body?.error?.description ?? `RazorpayX ${path} failed (${res.status})`,
      502,
      "RAZORPAYX_ERROR",
    )
  }
  return body as T
}

export const razorpayX = {
  createContact: (data: {
    name: string
    email?: string
    contact?: string
    type: string
    reference_id: string
  }) => xRequest<{ id: string }>("/v1/contacts", data),

  createFundAccount: (data: {
    contact_id: string
    account_type: "vpa"
    vpa: { address: string }
    reference_id: string
  }) => xRequest<{ id: string }>("/v1/fund_accounts", data),

  createPayout: (data: {
    account_number: string
    fund_account_id: string
    amount: number
    currency: string
    mode: string
    purpose: string
    reference_id: string
    narration: string
  }) => xRequest<{ id: string; status: string }>("/v1/payouts", data),
}
