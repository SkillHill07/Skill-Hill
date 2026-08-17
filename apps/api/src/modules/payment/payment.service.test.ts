import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Payment service unit tests — models, wallet service, and the Razorpay SDK
 * are all mocked (no DB, no network). Covers the money-critical paths: order
 * creation, webhook capture idempotency, frozen-wallet capture, and the
 * refund reversal ordering.
 */
const mocks = vi.hoisted(() => ({
  paymentCreate: vi.fn(),
  paymentFindOne: vi.fn(),
  paymentFindOneAndUpdate: vi.fn(),
  paymentFindById: vi.fn(),
  paymentUpdateOne: vi.fn(),
  paymentFind: vi.fn(),
  paymentCount: vi.fn(),
  contestFindById: vi.fn(),
  walletDeposit: vi.fn(),
  walletReverseDeposit: vi.fn(),
  isPaymentsConfigured: vi.fn(),
  getRazorpay: vi.fn(),
}))

vi.mock("./payment.model.js", () => ({
  Payment: {
    create: mocks.paymentCreate,
    findOne: mocks.paymentFindOne,
    findOneAndUpdate: mocks.paymentFindOneAndUpdate,
    findById: mocks.paymentFindById,
    updateOne: mocks.paymentUpdateOne,
    find: mocks.paymentFind,
    countDocuments: mocks.paymentCount,
  },
}))
vi.mock("../contest/contest.model.js", () => ({
  Contest: { findById: mocks.contestFindById },
}))
vi.mock("../wallet/wallet.service.js", () => ({
  walletService: {
    deposit: mocks.walletDeposit,
    reverseDeposit: mocks.walletReverseDeposit,
  },
}))
vi.mock("../../config/razorpay.js", () => ({
  isPaymentsConfigured: mocks.isPaymentsConfigured,
  getRazorpay: mocks.getRazorpay,
}))
vi.mock("../../config/index.js", () => ({
  config: { RAZORPAY_KEY_ID: "rzp_test_key" },
}))
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}))

import { paymentService } from "./payment.service.js"

const USER_ID = "64b7f9c5e5b9c1a2b3c4d5e5"
const PAYMENT_DB_ID = "64b7f9c5e5b9c1a2b3c4d5e9"
const ORDER_ID = "order_P1a2b3c4d5e"
const RAZORPAY_PAYMENT_ID = "pay_abcdef123456"

function makePayment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: PAYMENT_DB_ID,
    userId: USER_ID,
    contestId: null,
    purpose: "deposit",
    amount: 2000,
    currency: "INR",
    status: "created",
    idempotencyKey: "deposit:user:abc",
    razorpayOrderId: null,
    razorpayPaymentId: null,
    receipt: "deposit:abc:1",
    refundId: null,
    failureReason: null,
    paidAt: null,
    refundedAt: null,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makeRazorpay({ orders, payments }: { orders?: unknown; payments?: unknown } = {}) {
  return { orders, payments }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isPaymentsConfigured.mockReturnValue(true)
})

describe("createOrder", () => {
  it("persists the payment first, creates the Razorpay order, and returns the checkout payload", async () => {
    mocks.paymentCreate.mockResolvedValue(makePayment())
    const ordersCreate = vi.fn().mockResolvedValue({ id: ORDER_ID })
    mocks.getRazorpay.mockReturnValue(makeRazorpay({ orders: { create: ordersCreate } }))

    const result = await paymentService.createOrder(USER_ID, { amount: 2000 })

    // Insert-first with a unique idempotency key (dedupes concurrent clicks)
    expect(mocks.paymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        contestId: null,
        amount: 2000,
        status: "created",
        idempotencyKey: expect.stringContaining(`deposit:${USER_ID}:`),
      }),
    )
    expect(ordersCreate).toHaveBeenCalledWith({
      amount: 2000,
      currency: "INR",
      receipt: expect.any(String),
      notes: expect.objectContaining({ userId: USER_ID, paymentId: PAYMENT_DB_ID }),
    })
    expect(result).toMatchObject({
      orderId: ORDER_ID,
      amount: 2000,
      currency: "INR",
      keyId: "rzp_test_key",
      paymentId: PAYMENT_DB_ID,
      purpose: "deposit",
    })
  })

  it("fast-fails 503 without touching the SDK when payments are not configured", async () => {
    mocks.isPaymentsConfigured.mockReturnValue(false)

    await expect(paymentService.createOrder(USER_ID, { amount: 2000 })).rejects.toMatchObject({
      status: 503,
      code: "PAYMENTS_NOT_CONFIGURED",
    })
    expect(mocks.paymentCreate).not.toHaveBeenCalled()
    expect(mocks.getRazorpay).not.toHaveBeenCalled()
  })

  it("rejects a non-positive amount with a clean 400", async () => {
    await expect(paymentService.createOrder(USER_ID, { amount: 0 })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_AMOUNT",
    })
    expect(mocks.paymentCreate).not.toHaveBeenCalled()
  })

  it("404s when a provided contest does not exist", async () => {
    mocks.contestFindById.mockResolvedValue(null)

    await expect(
      paymentService.createOrder(USER_ID, { amount: 2000, contestId: "64b7f9c5e5b9c1a2b3c4d5e6" }),
    ).rejects.toMatchObject({ status: 404, code: "CONTEST_NOT_FOUND" })
    expect(mocks.paymentCreate).not.toHaveBeenCalled()
  })

  it("400s for a free contest (no fee to pay)", async () => {
    mocks.contestFindById.mockResolvedValue({ type: "free" })

    await expect(
      paymentService.createOrder(USER_ID, { amount: 2000, contestId: "64b7f9c5e5b9c1a2b3c4d5e6" }),
    ).rejects.toMatchObject({ status: 400, code: "FREE_CONTEST" })
  })

  it("409s when a concurrent click collides on the idempotency key", async () => {
    mocks.paymentCreate.mockRejectedValue({ code: 11000 })

    await expect(paymentService.createOrder(USER_ID, { amount: 2000 })).rejects.toMatchObject({
      status: 409,
      code: "DUPLICATE_ORDER",
    })
  })

  it("marks the payment failed and 502s when Razorpay rejects the order", async () => {
    const payment = makePayment()
    mocks.paymentCreate.mockResolvedValue(payment)
    mocks.getRazorpay.mockReturnValue(
      makeRazorpay({ orders: { create: vi.fn().mockRejectedValue(new Error("bad key")) } }),
    )

    await expect(paymentService.createOrder(USER_ID, { amount: 2000 })).rejects.toMatchObject({
      status: 502,
      code: "PAYMENT_PROVIDER_ERROR",
    })
    expect(payment.status).toBe("failed")
    expect(payment.save).toHaveBeenCalled()
  })
})

describe("processWebhook — payment.captured", () => {
  const capturedEvent = (overrides: Record<string, unknown> = {}) => ({
    event: "payment.captured",
    payload: {
      payment: {
        entity: { id: RAZORPAY_PAYMENT_ID, order_id: ORDER_ID, amount: 2000, ...overrides },
      },
    },
  })

  it("credits the wallet and claims the payment as paid", async () => {
    mocks.paymentFindOne.mockResolvedValue(makePayment())
    mocks.walletDeposit.mockResolvedValue({ _id: "tx-1" })
    mocks.paymentFindOneAndUpdate.mockResolvedValue(makePayment({ status: "paid", razorpayPaymentId: RAZORPAY_PAYMENT_ID }))

    const result = await paymentService.processWebhook(capturedEvent())

    expect(result.handled).toBe(true)
    // Wallet credited with OUR stored amount and the Razorpay payment id
    expect(mocks.walletDeposit).toHaveBeenCalledWith(USER_ID, 2000, RAZORPAY_PAYMENT_ID)
    // Atomic claim: created/attempted/failed → paid
    expect(mocks.paymentFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: PAYMENT_DB_ID, status: { $in: ["created", "attempted", "failed"] } },
      { status: "paid", razorpayPaymentId: RAZORPAY_PAYMENT_ID, paidAt: expect.any(Date) },
      { new: true },
    )
  })

  it("is a safe no-op for an order we do not track", async () => {
    mocks.paymentFindOne.mockResolvedValue(null)

    const result = await paymentService.processWebhook(capturedEvent())

    expect(result.handled).toBe(false)
    expect(mocks.walletDeposit).not.toHaveBeenCalled()
  })

  it("is idempotent — a replayed capture never double-credits", async () => {
    mocks.paymentFindOne.mockResolvedValue(makePayment({ status: "paid" }))

    const result = await paymentService.processWebhook(capturedEvent())

    expect(result.handled).toBe(true)
    expect(mocks.walletDeposit).not.toHaveBeenCalled()
    expect(mocks.paymentFindOneAndUpdate).not.toHaveBeenCalled()
  })

  it("credits the stored amount even when the webhook amount differs (log-only mismatch)", async () => {
    mocks.paymentFindOne.mockResolvedValue(makePayment())
    mocks.walletDeposit.mockResolvedValue({ _id: "tx-1" })
    mocks.paymentFindOneAndUpdate.mockResolvedValue(makePayment({ status: "paid" }))

    await paymentService.processWebhook(capturedEvent({ amount: 999999 }))

    // We never trust the webhook amount — our record is the source of truth
    expect(mocks.walletDeposit).toHaveBeenCalledWith(USER_ID, 2000, RAZORPAY_PAYMENT_ID)
  })

  it("records the failure and rethrows (webhook 500 → Razorpay retries) when the wallet deposit fails", async () => {
    mocks.paymentFindOne.mockResolvedValue(makePayment())
    mocks.walletDeposit.mockRejectedValue(
      Object.assign(new Error("frozen"), { status: 403, code: "WALLET_FROZEN" }),
    )

    // Rethrown so the webhook route 500s and Razorpay retries — self-heals
    // once the wallet is active again. The doc is never marked failed-with-cash.
    await expect(paymentService.processWebhook(capturedEvent())).rejects.toThrow("frozen")
    expect(mocks.paymentUpdateOne).toHaveBeenCalledWith(
      { _id: PAYMENT_DB_ID },
      expect.objectContaining({
        razorpayPaymentId: RAZORPAY_PAYMENT_ID,
        failureReason: expect.stringContaining("wallet credit failed"),
      }),
    )
    // No paid claim happened
    expect(mocks.paymentFindOneAndUpdate).not.toHaveBeenCalled()
  })

  it("credits a retry capture even after a failed attempt on the same order", async () => {
    // An earlier payment.failed event marked the doc failed; the user retried
    // and a NEW payment on the same order was captured.
    mocks.paymentFindOne.mockResolvedValue(
      makePayment({ status: "failed", razorpayPaymentId: "pay_old_failed_attempt" }),
    )
    mocks.walletDeposit.mockResolvedValue({ _id: "tx-1" })
    mocks.paymentFindOneAndUpdate.mockResolvedValue(
      makePayment({ status: "paid", razorpayPaymentId: RAZORPAY_PAYMENT_ID }),
    )

    const result = await paymentService.processWebhook(capturedEvent())

    expect(result.handled).toBe(true)
    // Credited with the NEW payment id (the failed attempt never credited)
    expect(mocks.walletDeposit).toHaveBeenCalledWith(USER_ID, 2000, RAZORPAY_PAYMENT_ID)
    // Claimed from failed → paid
    expect(mocks.paymentFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: PAYMENT_DB_ID, status: { $in: ["created", "attempted", "failed"] } },
      expect.objectContaining({ status: "paid", razorpayPaymentId: RAZORPAY_PAYMENT_ID }),
      { new: true },
    )
  })

  it("never credits a refunded payment", async () => {
    mocks.paymentFindOne.mockResolvedValue(makePayment({ status: "refunded" }))

    const result = await paymentService.processWebhook(capturedEvent())

    expect(result.handled).toBe(false)
    expect(mocks.walletDeposit).not.toHaveBeenCalled()
  })

  it("does not double-transition when a concurrent webhook already claimed the payment", async () => {
    mocks.paymentFindOne.mockResolvedValue(makePayment())
    mocks.walletDeposit.mockResolvedValue({ _id: "tx-1" })
    mocks.paymentFindOneAndUpdate.mockResolvedValue(null) // lost the claim race

    const result = await paymentService.processWebhook(capturedEvent())

    expect(result.handled).toBe(true)
    expect(mocks.walletDeposit).toHaveBeenCalledTimes(1)
  })
})

describe("processWebhook — payment.failed and refund.processed", () => {
  it("marks the payment failed with the provider reason", async () => {
    mocks.paymentFindOne.mockResolvedValue(makePayment())

    const result = await paymentService.processWebhook({
      event: "payment.failed",
      payload: {
        payment: {
          entity: { id: RAZORPAY_PAYMENT_ID, order_id: ORDER_ID, failure_reason: "payment_failed" },
        },
      },
    })

    expect(result.handled).toBe(true)
    expect(mocks.paymentUpdateOne).toHaveBeenCalledWith(
      { _id: PAYMENT_DB_ID, status: { $in: ["created", "attempted", "failed"] } },
      expect.objectContaining({ status: "failed", failureReason: "payment_failed" }),
    )
  })

  it("does not downgrade a paid payment on a stale failed event", async () => {
    mocks.paymentFindOne.mockResolvedValue(makePayment({ status: "paid" }))

    const result = await paymentService.processWebhook({
      event: "payment.failed",
      payload: {
        payment: { entity: { id: RAZORPAY_PAYMENT_ID, order_id: ORDER_ID, failure_reason: "late" } },
      },
    })

    expect(result.handled).toBe(false)
    expect(mocks.paymentUpdateOne).not.toHaveBeenCalled()
  })

  it("confirms an admin refund via refund.processed", async () => {
    mocks.paymentUpdateOne.mockResolvedValue({ modifiedCount: 1 })

    const result = await paymentService.processWebhook({
      event: "refund.processed",
      payload: {
        refund: { entity: { id: "refund_1", payment_id: RAZORPAY_PAYMENT_ID } },
      },
    })

    expect(result.handled).toBe(true)
    expect(mocks.paymentUpdateOne).toHaveBeenCalledWith(
      { razorpayPaymentId: RAZORPAY_PAYMENT_ID, status: "paid" },
      expect.objectContaining({ status: "refunded", refundId: "refund_1" }),
    )
  })

  it("ignores unrelated event types", async () => {
    const result = await paymentService.processWebhook({ event: "order.paid" })

    expect(result.handled).toBe(false)
  })
})

describe("refundPayment", () => {
  const paidPayment = (overrides: Partial<Record<string, unknown>> = {}) =>
    makePayment({
      status: "paid",
      razorpayPaymentId: RAZORPAY_PAYMENT_ID,
      razorpayOrderId: ORDER_ID,
      ...overrides,
    })

  it("reverses the wallet deposit, refunds at Razorpay, and marks the payment refunded", async () => {
    const payment = paidPayment()
    mocks.paymentFindById.mockResolvedValue(payment)
    mocks.walletReverseDeposit.mockResolvedValue({ _id: "refund-1" })
    const refund = vi.fn().mockResolvedValue({ id: "refund_1" })
    mocks.getRazorpay.mockReturnValue(makeRazorpay({ payments: { refund } }))

    const result = await paymentService.refundPayment(PAYMENT_DB_ID)

    // Reversal BEFORE the provider call — money safety on every retry
    expect(mocks.walletReverseDeposit).toHaveBeenCalledWith(USER_ID, 2000, RAZORPAY_PAYMENT_ID)
    expect(refund).toHaveBeenCalledWith(RAZORPAY_PAYMENT_ID, { amount: 2000 })
    expect(payment.status).toBe("refunded")
    expect(payment.refundId).toBe("refund_1")
    expect(result).toBe(payment)
  })

  it("is idempotent — an already-refunded payment is returned untouched", async () => {
    const payment = paidPayment({ status: "refunded", refundId: "refund_1" })
    mocks.paymentFindById.mockResolvedValue(payment)

    const result = await paymentService.refundPayment(PAYMENT_DB_ID)

    expect(result).toBe(payment)
    expect(mocks.walletReverseDeposit).not.toHaveBeenCalled()
    expect(mocks.getRazorpay).not.toHaveBeenCalled()
  })

  it("rejects refunds of payments that were never captured", async () => {
    mocks.paymentFindById.mockResolvedValue(makePayment({ status: "created" }))

    await expect(paymentService.refundPayment(PAYMENT_DB_ID)).rejects.toMatchObject({
      status: 400,
      code: "PAYMENT_NOT_PAID",
    })
    expect(mocks.walletReverseDeposit).not.toHaveBeenCalled()
  })

  it("blocks the refund (no provider call) when the wallet no longer holds the deposit", async () => {
    mocks.paymentFindById.mockResolvedValue(paidPayment())
    mocks.walletReverseDeposit.mockResolvedValue(null) // no matching deposit row

    await expect(paymentService.refundPayment(PAYMENT_DB_ID)).rejects.toMatchObject({
      status: 400,
      code: "NO_WALLET_DEPOSIT",
    })
    expect(mocks.getRazorpay).not.toHaveBeenCalled()
  })

  it("restores the wallet and 502s when the Razorpay refund fails", async () => {
    mocks.paymentFindById.mockResolvedValue(paidPayment())
    mocks.walletReverseDeposit.mockResolvedValue({ _id: "refund-1" })
    mocks.getRazorpay.mockReturnValue(
      makeRazorpay({ payments: { refund: vi.fn().mockRejectedValue(new Error("refund rejected")) } }),
    )

    await expect(paymentService.refundPayment(PAYMENT_DB_ID)).rejects.toMatchObject({
      status: 502,
      code: "PAYMENT_PROVIDER_ERROR",
    })
    // Money put back via a synthetic reference (can't collide with the deposit row)
    expect(mocks.walletDeposit).toHaveBeenCalledWith(
      USER_ID,
      2000,
      `rollback:refund:${RAZORPAY_PAYMENT_ID}`,
    )
    expect(mocks.paymentFindById).toHaveBeenCalledTimes(1)
  })

  it("404s for an unknown payment", async () => {
    mocks.paymentFindById.mockResolvedValue(null)

    await expect(paymentService.refundPayment(PAYMENT_DB_ID)).rejects.toMatchObject({
      status: 404,
      code: "PAYMENT_NOT_FOUND",
    })
  })
})

describe("listUserPayments / listAllPayments", () => {
  it("returns the user's payments with pagination + status filter", async () => {
    mocks.paymentFind.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([makePayment()]),
    })
    mocks.paymentCount.mockResolvedValue(1)

    const result = await paymentService.listUserPayments(USER_ID, { status: "paid", page: 1, limit: 10 })

    expect(mocks.paymentFind).toHaveBeenCalledWith({ userId: USER_ID, status: "paid" })
    expect(result).toMatchObject({ total: 1, totalPages: 1 })
  })

  it("admin audit view populates the user and supports a userId filter", async () => {
    const populate = vi.fn().mockResolvedValue([makePayment()])
    mocks.paymentFind.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      populate,
    })
    mocks.paymentCount.mockResolvedValue(1)

    await paymentService.listAllPayments({ userId: USER_ID })

    expect(mocks.paymentFind).toHaveBeenCalledWith({ userId: USER_ID })
    expect(populate).toHaveBeenCalledWith("userId", "firstName lastName email")
  })
})
