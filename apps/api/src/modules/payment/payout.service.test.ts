import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Payout gateway unit tests — RazorpayX REST calls and the User model are
 * mocked (no network, no DB). Verifies the contact/fund-account find-or-create
 * caching and the UPI-change invalidation, plus the 503 gate.
 */
const mocks = vi.hoisted(() => ({
  userFindById: vi.fn(),
  isPayoutsConfigured: vi.fn(),
  createContact: vi.fn(),
  createFundAccount: vi.fn(),
  createPayout: vi.fn(),
}))

vi.mock("../auth/auth.schema.js", () => ({
  User: { findById: mocks.userFindById },
}))
vi.mock("../../config/razorpay.js", () => ({
  isPayoutsConfigured: mocks.isPayoutsConfigured,
  razorpayX: {
    createContact: mocks.createContact,
    createFundAccount: mocks.createFundAccount,
    createPayout: mocks.createPayout,
  },
}))
vi.mock("../../config/index.js", () => ({
  config: { RAZORPAYX_ACCOUNT_NUMBER: "7878780080316316" },
}))
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}))

import { initiatePayout } from "./payout.service.js"

const USER_ID = "64b7f9c5e5b9c1a2b3c4d5e5"
const TX_ID = "64b7f9c5e5b9c1a2b3c4d5e7"

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: USER_ID,
    firstName: "Priya",
    lastName: "Sharma",
    fullName: "Priya Sharma",
    email: "priya@example.com",
    phone: "9876543210",
    razorpayContactId: null,
    razorpayFundAccountId: null,
    razorpayFundAccountUpi: null,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isPayoutsConfigured.mockReturnValue(true)
})

describe("initiatePayout", () => {
  it("fast-fails 503 when RazorpayX is not configured", async () => {
    mocks.isPayoutsConfigured.mockReturnValue(false)

    await expect(
      initiatePayout({ userId: USER_ID, amount: 10000, upiId: "priya@okhdfcbank", transactionId: TX_ID }),
    ).rejects.toMatchObject({ status: 503, code: "PAYMENTS_NOT_CONFIGURED" })
    expect(mocks.userFindById).not.toHaveBeenCalled()
  })

  it("requires a UPI id", async () => {
    await expect(
      initiatePayout({ userId: USER_ID, amount: 10000, upiId: null, transactionId: TX_ID }),
    ).rejects.toMatchObject({ status: 400, code: "UPI_REQUIRED" })
  })

  it("creates contact + fund account + payout on first withdrawal and caches the ids", async () => {
    const user = makeUser()
    mocks.userFindById.mockResolvedValue(user)
    mocks.createContact.mockResolvedValue({ id: "contact_1" })
    mocks.createFundAccount.mockResolvedValue({ id: "fa_1" })
    mocks.createPayout.mockResolvedValue({ id: "payout_1", status: "created" })

    await initiatePayout({
      userId: USER_ID,
      amount: 10000,
      upiId: "priya@okhdfcbank",
      transactionId: TX_ID,
    })

    expect(mocks.createContact).toHaveBeenCalledWith({
      name: "Priya Sharma",
      email: "priya@example.com",
      contact: "9876543210",
      type: "customer",
      reference_id: `user:${USER_ID}`,
    })
    expect(mocks.createFundAccount).toHaveBeenCalledWith({
      contact_id: "contact_1",
      account_type: "vpa",
      vpa: { address: "priya@okhdfcbank" },
      reference_id: `fa:${USER_ID}`,
    })
    expect(mocks.createPayout).toHaveBeenCalledWith({
      account_number: "7878780080316316",
      fund_account_id: "fa_1",
      amount: 10000,
      currency: "INR",
      mode: "UPI",
      purpose: "payout",
      reference_id: TX_ID,
      narration: expect.any(String),
    })
    // Cached for the next withdrawal
    expect(user.razorpayContactId).toBe("contact_1")
    expect(user.razorpayFundAccountId).toBe("fa_1")
    expect(user.razorpayFundAccountUpi).toBe("priya@okhdfcbank")
    expect(user.save).toHaveBeenCalled()
  })

  it("reuses the cached contact and fund account when the UPI is unchanged", async () => {
    mocks.userFindById.mockResolvedValue(
      makeUser({
        razorpayContactId: "contact_1",
        razorpayFundAccountId: "fa_1",
        razorpayFundAccountUpi: "priya@okhdfcbank",
      }),
    )
    mocks.createPayout.mockResolvedValue({ id: "payout_2", status: "queued" })

    await initiatePayout({
      userId: USER_ID,
      amount: 20000,
      upiId: "priya@okhdfcbank",
      transactionId: TX_ID,
    })

    expect(mocks.createContact).not.toHaveBeenCalled()
    expect(mocks.createFundAccount).not.toHaveBeenCalled()
    expect(mocks.createPayout).toHaveBeenCalledWith(
      expect.objectContaining({ fund_account_id: "fa_1", amount: 20000 }),
    )
  })

  it("creates a fresh fund account when the UPI changed (never payout to a stale address)", async () => {
    const user = makeUser({
      razorpayContactId: "contact_1",
      razorpayFundAccountId: "fa_1",
      razorpayFundAccountUpi: "old@okicici",
    })
    mocks.userFindById.mockResolvedValue(user)
    mocks.createFundAccount.mockResolvedValue({ id: "fa_2" })
    mocks.createPayout.mockResolvedValue({ id: "payout_3", status: "created" })

    await initiatePayout({
      userId: USER_ID,
      amount: 10000,
      upiId: "new@okhdfcbank",
      transactionId: TX_ID,
    })

    expect(mocks.createContact).not.toHaveBeenCalled()
    expect(mocks.createFundAccount).toHaveBeenCalledWith(
      expect.objectContaining({ vpa: { address: "new@okhdfcbank" } }),
    )
    expect(mocks.createPayout).toHaveBeenCalledWith(
      expect.objectContaining({ fund_account_id: "fa_2" }),
    )
    expect(user.razorpayFundAccountId).toBe("fa_2")
    expect(user.razorpayFundAccountUpi).toBe("new@okhdfcbank")
  })

  it("propagates provider failures so the wallet restores the balance", async () => {
    const user = makeUser()
    mocks.userFindById.mockResolvedValue(user)
    mocks.createContact.mockResolvedValue({ id: "contact_1" })
    mocks.createFundAccount.mockResolvedValue({ id: "fa_1" })
    mocks.createPayout.mockRejectedValue(
      Object.assign(new Error("insufficient balance"), { status: 502, code: "RAZORPAYX_ERROR" }),
    )

    await expect(
      initiatePayout({ userId: USER_ID, amount: 10000, upiId: "priya@okhdfcbank", transactionId: TX_ID }),
    ).rejects.toMatchObject({ status: 502, code: "RAZORPAYX_ERROR" })
  })
})
