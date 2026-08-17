import { randomUUID } from "node:crypto"
import { Payment, type IPayment } from "./payment.model.js"
import { Contest } from "../contest/contest.model.js"
import { walletService } from "../wallet/wallet.service.js"
import { getRazorpay, isPaymentsConfigured } from "../../config/razorpay.js"
import { config } from "../../config/index.js"
import { logger } from "../../utils/logger.js"
import type { PaymentPurpose, PaymentStatus } from "@skillcontest/shared-types"

/**
 * Payment module — raw Razorpay operations.
 *
 * This module does NOT manage balances. A captured payment calls
 * `walletService.deposit()` (idempotent on the Razorpay payment id); the
 * wallet is the ledger. Contest joins are wallet-deducts (already wired in
 * the contest module) — a payment order with a `contestId` is deposit
 * metadata only, never an auto-join.
 *
 * Idempotency model (no Redis required — consistent with the wallet module):
 * - Order creation: unique `idempotencyKey` on the payment doc (a concurrent
 *   duplicate click hits E11000 → clean 409).
 * - Capture: the `created/attempted → paid` transition is an atomic
 *   `findOneAndUpdate` claim, and `walletService.deposit` is itself idempotent
 *   on the payment id — replaying a webhook can never double-credit.
 */

function paymentError(message: string, status: number, code: string): Error {
  return Object.assign(new Error(message), { status, code })
}

/**
 * Statuses a payment can be captured/failed FROM (webhook claims).
 * Includes "failed" because Razorpay allows MULTIPLE payment attempts per
 * order: a failed attempt marks the doc failed, then the user retries and a
 * NEW payment on the same order gets captured — that capture must still
 * credit the wallet and claim the doc paid. "paid"/"refunded" are terminal
 * and never overwritten (the claim filter prevents it atomically).
 */
const CLAIMABLE = { $in: ["created", "attempted", "failed"] } as const

/**
 * Create a Razorpay order and persist the payment record.
 * Insert-first (unique idempotency key dedupes concurrent clicks), then the
 * Razorpay call; on provider error the record is marked failed so it is
 * visible in admin audits instead of dangling in `created`.
 */
async function createOrder(
  userId: string,
  input: { amount: number; purpose?: PaymentPurpose; contestId?: string },
): Promise<{
  orderId: string
  amount: number
  currency: string
  keyId: string
  paymentId: string
  receipt: string
  purpose: PaymentPurpose
}> {
  if (!isPaymentsConfigured()) {
    throw paymentError(
      "Payments are not available yet — payment processing is not configured",
      503,
      "PAYMENTS_NOT_CONFIGURED",
    )
  }
  if (input.amount <= 0) {
    // Same guard the wallet service has — a direct call (not via the route)
    // with a bad amount gets a clean 400 instead of a mongoose ValidationError.
    throw paymentError("Invalid amount", 400, "INVALID_AMOUNT")
  }

  const purpose = input.purpose ?? "deposit"

  if (input.contestId) {
    const contest = await Contest.findById(input.contestId)
    if (!contest) {
      throw paymentError("Contest not found", 404, "CONTEST_NOT_FOUND")
    }
    if (contest.type !== "paid") {
      throw paymentError("Free contests have no entry fee to pay", 400, "FREE_CONTEST")
    }
  }

  // Fresh key per click — every create-order is a new attempt (standard
  // wallet-deposit UX). Dedupes only truly concurrent duplicate clicks.
  const idempotencyKey = `${purpose}:${userId}:${randomUUID()}`
  const receipt = `deposit:${userId.slice(-8)}:${Date.now().toString(36)}`

  let payment: IPayment
  try {
    payment = await Payment.create({
      userId,
      contestId: input.contestId ?? null,
      purpose,
      amount: input.amount,
      currency: "INR",
      status: "created",
      idempotencyKey,
      receipt,
    })
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw paymentError(
        "A pending order already exists for this request",
        409,
        "DUPLICATE_ORDER",
      )
    }
    throw err
  }

  const razorpay = getRazorpay()
  if (!razorpay) {
    payment.status = "failed"
    payment.failureReason = "payments not configured"
    await payment.save()
    throw paymentError(
      "Payments are not available yet — payment processing is not configured",
      503,
      "PAYMENTS_NOT_CONFIGURED",
    )
  }

  let order: { id: string }
  try {
    order = await razorpay.orders.create({
      amount: input.amount,
      currency: "INR",
      receipt,
      notes: { userId, paymentId: payment._id.toString(), purpose },
    })
  } catch (err) {
    payment.status = "failed"
    payment.failureReason = (err as Error).message
    await payment.save()
    logger.error(
      { userId, amount: input.amount, err: (err as Error).message },
      "payment_order_creation_failed",
    )
    throw paymentError(
      "Payment provider error while creating the order",
      502,
      "PAYMENT_PROVIDER_ERROR",
    )
  }

  payment.razorpayOrderId = order.id
  await payment.save()

  logger.info(
    { userId, paymentId: payment._id.toString(), orderId: order.id, amount: input.amount },
    "payment_order_created",
  )
  return {
    orderId: order.id,
    amount: input.amount,
    currency: "INR",
    keyId: config.RAZORPAY_KEY_ID,
    paymentId: payment._id.toString(),
    receipt,
    purpose,
  }
}

/**
 * Process a verified Razorpay webhook event. Returns `{ handled }` — unknown
 * events and unmatched orders are safe no-ops (Razorpay sends many event
 * types; a non-2xx response would trigger retry storms).
 */
async function processWebhook(event: {
  event: string
  payload?: Record<string, { entity?: Record<string, unknown> }>
}): Promise<{ handled: boolean }> {
  const entity = event.payload?.payment?.entity ?? event.payload?.refund?.entity

  switch (event.event) {
    case "payment.captured": {
      const orderId = entity?.order_id as string | undefined
      const paymentId = entity?.id as string | undefined
      if (!orderId || !paymentId || !entity) return { handled: false }

      const payment = await Payment.findOne({ razorpayOrderId: orderId })
      if (!payment) {
        logger.warn({ orderId }, "webhook_capture_unknown_order")
        return { handled: false }
      }
      // Idempotent replay — already processed. Refunded is terminal.
      if (payment.status === "paid") return { handled: true }
      if (payment.status === "refunded") return { handled: false }

      // Amount sanity: we credit OUR stored amount, never the webhook's.
      if (payment.amount !== entity.amount) {
        logger.warn(
          { orderId, storedAmount: payment.amount, webhookAmount: entity.amount },
          "webhook_capture_amount_mismatch",
        )
      }

      // Credit the wallet BEFORE claiming paid. If the ledger fails (frozen
      // wallet) record the reason + payment id and RETHROW — the webhook
      // route returns 500 so Razorpay retries, and the capture self-heals
      // once the wallet is active again. The doc stays claimable; money is
      // never stranded as a silent paid-without-credit or failed-with-cash.
      try {
        await walletService.deposit(payment.userId.toString(), payment.amount, paymentId)
      } catch (err) {
        logger.error(
          { paymentId: payment._id.toString(), err: (err as Error).message },
          "webhook_capture_wallet_deposit_failed",
        )
        await Payment.updateOne(
          { _id: payment._id },
          {
            razorpayPaymentId: paymentId,
            failureReason: `wallet credit failed at capture: ${(err as Error).message}`,
          },
        )
        throw err
      }

      // Atomic claim — concurrent webhook replays can't double-transition.
      const claimed = await Payment.findOneAndUpdate(
        { _id: payment._id, status: CLAIMABLE },
        { status: "paid", razorpayPaymentId: paymentId, paidAt: new Date() },
        { new: true },
      )
      if (!claimed) return { handled: true }

      logger.info(
        { paymentId: payment._id.toString(), userId: payment.userId.toString(), amount: payment.amount },
        "payment_captured",
      )
      return { handled: true }
    }

    case "payment.failed": {
      const orderId = entity?.order_id as string | undefined
      const paymentId = entity?.id as string | undefined
      if (!orderId || !paymentId || !entity) return { handled: false }

      const payment = await Payment.findOne({ razorpayOrderId: orderId })
      if (!payment) return { handled: false }
      // Never override a captured/refunded doc with a stale failed event.
      if (payment.status !== "created" && payment.status !== "attempted") {
        return { handled: false }
      }

      await Payment.updateOne(
        { _id: payment._id, status: CLAIMABLE },
        {
          status: "failed",
          razorpayPaymentId: paymentId,
          failureReason:
            (entity?.error_description as string) ??
            (entity?.failure_reason as string) ??
            null,
        },
      )
      return { handled: true }
    }

    case "refund.processed":
    case "refund.created": {
      const paymentId = event.payload?.refund?.entity?.payment_id as string | undefined
      const refundId = entity?.id as string | undefined
      if (!paymentId || !refundId) return { handled: false }

      // Only confirms refunds we already issued (admin refund sets the state
      // directly); the webhook is the async confirmation fallback.
      const updated = await Payment.updateOne(
        { razorpayPaymentId: paymentId, status: "paid" },
        { status: "refunded", refundId, refundedAt: new Date() },
      )
      return { handled: updated.modifiedCount > 0 }
    }

    default:
      return { handled: false }
  }
}

/** User's own payment history, newest first. */
async function listUserPayments(
  userId: string,
  filters: { page?: number; limit?: number; status?: PaymentStatus } = {},
): Promise<{
  payments: IPayment[]
  total: number
  page: number
  limit: number
  totalPages: number
}> {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  const query: Record<string, unknown> = { userId }
  if (filters.status) query.status = filters.status

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Payment.countDocuments(query),
  ])

  return { payments, total, page, limit, totalPages: Math.ceil(total / limit) }
}

/** Admin audit view — all payments with user populated, filters + pagination. */
async function listAllPayments(
  filters: { page?: number; limit?: number; status?: PaymentStatus; userId?: string } = {},
): Promise<{
  payments: IPayment[]
  total: number
  page: number
  limit: number
  totalPages: number
}> {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  const query: Record<string, unknown> = {}
  if (filters.status) query.status = filters.status
  if (filters.userId) query.userId = filters.userId

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "firstName lastName email"),
    Payment.countDocuments(query),
  ])

  return { payments, total, page, limit, totalPages: Math.ceil(total / limit) }
}

/**
 * Admin: refund a captured payment back to the user's card.
 *
 * Ordering is deliberate and self-healing on retry:
 *  1. Reverse the wallet deposit first (atomic debit; fails with 400 if the
 *     user spent the money — the refund is then blocked, no double-pay).
 *  2. Call the Razorpay refund API.
 *  3. On provider failure, re-credit the wallet via a synthetic-reference
 *     deposit and rethrow — the payment stays `paid` and a retry re-runs
 *     safely (step 1 is idempotent on the payment id).
 *  4. Mark the payment refunded.
 */
async function refundPayment(paymentId: string): Promise<IPayment> {
  if (!isPaymentsConfigured()) {
    throw paymentError(
      "Payments are not available yet — payment processing is not configured",
      503,
      "PAYMENTS_NOT_CONFIGURED",
    )
  }

  const payment = await Payment.findById(paymentId)
  if (!payment) {
    throw paymentError("Payment not found", 404, "PAYMENT_NOT_FOUND")
  }
  if (payment.status === "refunded") return payment // idempotent replay
  if (payment.status !== "paid" || !payment.razorpayPaymentId) {
    throw paymentError("Only paid payments can be refunded", 400, "PAYMENT_NOT_PAID")
  }

  const reversed = await walletService.reverseDeposit(
    payment.userId.toString(),
    payment.amount,
    payment.razorpayPaymentId,
  )
  if (!reversed) {
    throw paymentError(
      "Cannot refund — no wallet deposit found for this payment",
      400,
      "NO_WALLET_DEPOSIT",
    )
  }

  const razorpay = getRazorpay()
  if (!razorpay) {
    // Restore the wallet — the refund cannot proceed.
    await walletService
      .deposit(payment.userId.toString(), payment.amount, `rollback:refund:${payment.razorpayPaymentId}`)
      .catch(() => {})
    throw paymentError(
      "Payments are not available yet — payment processing is not configured",
      503,
      "PAYMENTS_NOT_CONFIGURED",
    )
  }

  let refund: { id: string }
  try {
    refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: payment.amount,
    })
  } catch (err) {
    // Refund did not go through — put the money back in the wallet. The
    // synthetic reference id cannot collide with the original deposit row.
    await walletService
      .deposit(payment.userId.toString(), payment.amount, `rollback:refund:${payment.razorpayPaymentId}`)
      .catch(() => {})
    logger.error(
      { paymentId: payment._id.toString(), err: (err as Error).message },
      "payment_refund_provider_error",
    )
    throw paymentError(
      "Payment provider error while refunding",
      502,
      "PAYMENT_PROVIDER_ERROR",
    )
  }

  payment.status = "refunded"
  payment.refundId = refund.id
  payment.refundedAt = new Date()
  await payment.save()

  logger.info(
    { paymentId: payment._id.toString(), userId: payment.userId.toString(), refundId: refund.id },
    "payment_refunded",
  )
  return payment
}

export const paymentService = {
  createOrder,
  processWebhook,
  listUserPayments,
  listAllPayments,
  refundPayment,
}
