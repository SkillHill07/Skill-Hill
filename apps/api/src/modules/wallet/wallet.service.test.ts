import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Wallet service unit tests. The models are mocked (no DB) so the ledger
 * logic — atomic guards, idempotency compensation, withdrawal gates — is
 * tested in isolation. Each test drives the mock sequence explicitly:
 *  - getWallet() → Wallet.findOneAndUpdate (upsert) returns the wallet
 *  - the atomic mutation → Wallet.findOneAndUpdate (increment)
 *  - the ledger insert → WalletTransaction.create
 */
const mocks = vi.hoisted(() => ({
  walletFindOneAndUpdate: vi.fn(),
  walletFindOne: vi.fn(),
  walletCreate: vi.fn(),
  walletUpdateOne: vi.fn(),
  txCreate: vi.fn(),
  txFindOne: vi.fn(),
  txFind: vi.fn(),
  txCount: vi.fn(),
  userFindById: vi.fn(),
}))

vi.mock("./wallet.model.js", () => ({
  Wallet: {
    findOneAndUpdate: mocks.walletFindOneAndUpdate,
    findOne: mocks.walletFindOne,
    create: mocks.walletCreate,
    updateOne: mocks.walletUpdateOne,
  },
}))
vi.mock("./transaction.model.js", () => ({
  WalletTransaction: {
    create: mocks.txCreate,
    findOne: mocks.txFindOne,
    find: mocks.txFind,
    countDocuments: mocks.txCount,
  },
}))
vi.mock("../auth/auth.schema.js", () => ({
  User: { findById: mocks.userFindById },
}))
vi.mock("../../config/index.js", () => ({
  config: { WITHDRAWAL_MIN_PAISE: 10000 },
}))
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}))

import { walletService } from "./wallet.service.js"

const USER_ID = "64b7f9c5e5b9c1a2b3c4d5e5"
const CONTEST_ID = "64b7f9c5e5b9c1a2b3c4d5e6"
const PAYMENT_ID = "pay_abcdef123456"

function makeWallet(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    userId: USER_ID,
    balance: 50000,
    locked: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
    totalWon: 0,
    totalSpentOnFees: 0,
    status: "active",
    ...overrides,
  }
}

function makeTx(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: "tx-1",
    userId: USER_ID,
    amount: 100,
    balanceBefore: 100,
    balanceAfter: 0,
    status: "completed",
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getBalance", () => {
  it("returns available = balance - locked and lifetime totals", async () => {
    mocks.walletFindOneAndUpdate.mockResolvedValue(
      makeWallet({ balance: 5000, locked: 1000, totalDeposited: 9000, status: "active" }),
    )

    const balance = await walletService.getBalance(USER_ID)

    expect(balance).toMatchObject({
      userId: USER_ID,
      balance: 5000,
      locked: 1000,
      available: 4000,
      totalDeposited: 9000,
    })
    expect(mocks.walletFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: USER_ID },
      { $setOnInsert: { userId: USER_ID } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
  })
})

describe("deposit", () => {
  it("credits the balance and writes a completed deposit ledger row", async () => {
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(makeWallet({ balance: 0 })) // getWallet
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(
      makeWallet({ balance: 2000, totalDeposited: 2000 }),
    ) // atomic increment
    mocks.txCreate.mockResolvedValue(makeTx())

    const tx = await walletService.deposit(USER_ID, 2000, PAYMENT_ID)

    expect(tx).toBeTruthy()
    expect(mocks.walletFindOneAndUpdate).toHaveBeenLastCalledWith(
      { userId: USER_ID, status: "active" },
      { $inc: { balance: 2000, totalDeposited: 2000 } },
      { new: true },
    )
    expect(mocks.txCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        type: "deposit",
        amount: 2000,
        balanceBefore: 0,
        balanceAfter: 2000,
        referenceType: "payment",
        referenceId: PAYMENT_ID,
        status: "completed",
      }),
    )
  })

  it("rejects a non-positive amount", async () => {
    await expect(walletService.deposit(USER_ID, 0, PAYMENT_ID)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_AMOUNT",
    })
  })
})

describe("deduct", () => {
  it("deducts the fee and writes a contest_fee ledger row", async () => {
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(makeWallet({ balance: 5000 })) // getWallet
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(
      makeWallet({ balance: 3000, totalSpentOnFees: 2000 }),
    ) // atomic decrement
    mocks.txCreate.mockResolvedValue(makeTx())

    await walletService.deduct(USER_ID, 2000, CONTEST_ID)

    expect(mocks.walletFindOneAndUpdate).toHaveBeenLastCalledWith(
      { userId: USER_ID, status: "active", balance: { $gte: 2000 } },
      { $inc: { balance: -2000, totalSpentOnFees: 2000 } },
      { new: true },
    )
    expect(mocks.txCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "contest_fee",
        referenceType: "contest",
        referenceId: CONTEST_ID,
        balanceBefore: 5000,
        balanceAfter: 3000,
      }),
    )
  })

  it("throws INSUFFICIENT_BALANCE without writing a ledger row when balance is short", async () => {
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(makeWallet({ balance: 500 })) // getWallet
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(null) // atomic guard fails
    mocks.walletFindOne.mockResolvedValue(makeWallet({ balance: 500 }))

    await expect(walletService.deduct(USER_ID, 2000, CONTEST_ID)).rejects.toMatchObject({
      status: 400,
      code: "INSUFFICIENT_BALANCE",
    })
    expect(mocks.txCreate).not.toHaveBeenCalled()
  })

  it("throws WALLET_FROZEN when the wallet is frozen", async () => {
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(makeWallet({ status: "frozen" })) // getWallet
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(null) // guard fails
    mocks.walletFindOne.mockResolvedValue(makeWallet({ status: "frozen" }))

    await expect(walletService.deduct(USER_ID, 2000, CONTEST_ID)).rejects.toMatchObject({
      status: 403,
      code: "WALLET_FROZEN",
    })
    expect(mocks.txCreate).not.toHaveBeenCalled()
  })

  it("compensates a duplicate ledger insert instead of double-deducting", async () => {
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(makeWallet({ balance: 5000 })) // getWallet
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(
      makeWallet({ balance: 3000, totalSpentOnFees: 2000 }),
    ) // atomic decrement
    mocks.txCreate.mockRejectedValueOnce({ code: 11000 }) // concurrent duplicate
    mocks.walletUpdateOne.mockResolvedValue({ acknowledged: true })
    mocks.txFindOne.mockResolvedValue(makeTx())

    const tx = await walletService.deduct(USER_ID, 2000, CONTEST_ID)

    // Balance restored: +2000 back, totalSpentOnFees back to 0
    expect(mocks.walletUpdateOne).toHaveBeenCalledWith(
      { userId: USER_ID },
      { $inc: { balance: 2000, totalSpentOnFees: -2000 } },
    )
    expect(tx).toBeTruthy()
  })
})

describe("credit", () => {
  it("credits prize winnings and increments totalWon", async () => {
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(makeWallet({ balance: 0 })) // getWallet
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(
      makeWallet({ balance: 6400, totalWon: 6400 }),
    )
    mocks.txCreate.mockResolvedValue(makeTx())

    const tx = await walletService.credit(USER_ID, 6400, CONTEST_ID)

    expect(mocks.walletFindOneAndUpdate).toHaveBeenLastCalledWith(
      { userId: USER_ID, status: "active" },
      { $inc: { balance: 6400, totalWon: 6400 } },
      { new: true },
    )
    expect(mocks.txCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "prize", referenceId: CONTEST_ID }),
    )
    expect(tx).toBeTruthy()
  })
})

describe("refund", () => {
  it("returns null when the user never paid a contest fee", async () => {
    mocks.txFindOne.mockResolvedValue(null)

    const result = await walletService.refund(USER_ID, 2000, CONTEST_ID)

    expect(result).toBeNull()
    expect(mocks.walletFindOneAndUpdate).not.toHaveBeenCalled()
  })

  it("refunds the fee only when a matching contest_fee exists", async () => {
    mocks.txFindOne.mockResolvedValueOnce({ _id: "fee-1", type: "contest_fee" }) // paid check
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(makeWallet({ balance: 3000 })) // getWallet
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(
      makeWallet({ balance: 5000 }),
    ) // atomic increment
    mocks.txCreate.mockResolvedValue(makeTx())

    const tx = await walletService.refund(USER_ID, 2000, CONTEST_ID)

    expect(mocks.txCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "refund", referenceId: CONTEST_ID }),
    )
    expect(tx).toBeTruthy()
  })

  it("never double-refunds (duplicate insert is compensated)", async () => {
    mocks.txFindOne.mockResolvedValueOnce({ _id: "fee-1", type: "contest_fee" }) // paid check
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(makeWallet({ balance: 3000 })) // getWallet
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(makeWallet({ balance: 5000 }))
    mocks.txCreate.mockRejectedValueOnce({ code: 11000 })
    mocks.walletUpdateOne.mockResolvedValue({ acknowledged: true })
    mocks.txFindOne.mockResolvedValueOnce(makeTx({ type: "refund" })) // existing refund

    const tx = await walletService.refund(USER_ID, 2000, CONTEST_ID)

    expect(mocks.walletUpdateOne).toHaveBeenCalledWith(
      { userId: USER_ID },
      { $inc: { balance: -2000 } },
    )
    expect(tx).toBeTruthy()
  })
})

describe("reverseDeposit", () => {
  it("reverses a deposit (balance + lifetime) and writes a payment-refund ledger row", async () => {
    mocks.txFindOne.mockResolvedValueOnce({ _id: "dep-1", type: "deposit", referenceId: PAYMENT_ID }) // deposit exists
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(makeWallet({ balance: 2000 })) // getWallet
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(
      makeWallet({ balance: 0, totalDeposited: 0 }),
    ) // atomic decrement
    mocks.txCreate.mockResolvedValue(makeTx({ type: "refund" }))

    const tx = await walletService.reverseDeposit(USER_ID, 2000, PAYMENT_ID)

    expect(mocks.walletFindOneAndUpdate).toHaveBeenLastCalledWith(
      { userId: USER_ID, status: "active", balance: { $gte: 2000 } },
      { $inc: { balance: -2000, totalDeposited: -2000 } },
      { new: true },
    )
    expect(mocks.txCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "refund",
        referenceType: "payment",
        referenceId: PAYMENT_ID,
      }),
    )
    expect(tx).toBeTruthy()
  })

  it("returns null when no matching deposit exists", async () => {
    mocks.txFindOne.mockResolvedValue(null)

    const result = await walletService.reverseDeposit(USER_ID, 2000, PAYMENT_ID)

    expect(result).toBeNull()
    expect(mocks.walletFindOneAndUpdate).not.toHaveBeenCalled()
  })

  it("throws INSUFFICIENT_BALANCE when the deposit was already spent", async () => {
    mocks.txFindOne.mockResolvedValueOnce({ _id: "dep-1", type: "deposit" })
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(makeWallet({ balance: 500 })) // getWallet
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(null) // guard fails
    mocks.walletFindOne.mockResolvedValue(makeWallet({ balance: 500 }))

    await expect(walletService.reverseDeposit(USER_ID, 2000, PAYMENT_ID)).rejects.toMatchObject({
      status: 400,
      code: "INSUFFICIENT_BALANCE",
    })
    expect(mocks.txCreate).not.toHaveBeenCalled()
  })

  it("compensates a duplicate refund insert instead of double-reversing", async () => {
    mocks.txFindOne.mockResolvedValueOnce({ _id: "dep-1", type: "deposit" }) // deposit exists
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(makeWallet({ balance: 2000 })) // getWallet
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(
      makeWallet({ balance: 0, totalDeposited: 0 }),
    ) // atomic decrement
    mocks.txCreate.mockRejectedValueOnce({ code: 11000 }) // concurrent duplicate
    mocks.walletUpdateOne.mockResolvedValue({ acknowledged: true })
    mocks.txFindOne.mockResolvedValueOnce(makeTx({ type: "refund" })) // existing refund row

    const tx = await walletService.reverseDeposit(USER_ID, 2000, PAYMENT_ID)

    // Balance restored: +2000 back, totalDeposited back to 0
    expect(mocks.walletUpdateOne).toHaveBeenCalledWith(
      { userId: USER_ID },
      { $inc: { balance: 2000, totalDeposited: 2000 } },
    )
    expect(tx).toBeTruthy()
  })
})

describe("withdraw", () => {
  it("requires verified KYC", async () => {
    mocks.userFindById.mockResolvedValue({ kycStatus: "pending", panVerified: false })

    await expect(walletService.withdraw(USER_ID, 10000)).rejects.toMatchObject({
      status: 403,
      code: "KYC_REQUIRED",
    })
  })

  it("rejects amounts below the minimum", async () => {
    mocks.userFindById.mockResolvedValue({
      kycStatus: "verified",
      panVerified: true,
      getUpiId: () => "upi@bank",
    })

    await expect(walletService.withdraw(USER_ID, 5000)).rejects.toMatchObject({
      status: 400,
      code: "WITHDRAWAL_MIN_NOT_MET",
    })
  })

  it("rejects when the wallet is frozen", async () => {
    mocks.userFindById.mockResolvedValue({
      kycStatus: "verified",
      panVerified: true,
      getUpiId: () => "upi@bank",
    })
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(makeWallet({ status: "frozen" })) // getWallet

    await expect(walletService.withdraw(USER_ID, 10000)).rejects.toMatchObject({
      status: 403,
      code: "WALLET_FROZEN",
    })
  })

  it("rejects when the balance is insufficient", async () => {
    mocks.userFindById.mockResolvedValue({
      kycStatus: "verified",
      panVerified: true,
      getUpiId: () => "upi@bank",
    })
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(makeWallet({ balance: 500 })) // getWallet
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(null) // guard fails

    await expect(walletService.withdraw(USER_ID, 10000)).rejects.toMatchObject({
      status: 400,
      code: "INSUFFICIENT_BALANCE",
    })
  })

  it("completes the withdrawal when the payout succeeds", async () => {
    const payout = vi.fn().mockResolvedValue(undefined)
    const tx = makeTx({ status: "pending" })
    mocks.userFindById.mockResolvedValue({
      kycStatus: "verified",
      panVerified: true,
      getUpiId: () => "upi@bank",
    })
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(makeWallet({ balance: 50000 })) // getWallet
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(
      makeWallet({ balance: 40000, totalWithdrawn: 10000 }),
    ) // atomic decrement
    mocks.txCreate.mockResolvedValue(tx)

    const result = await walletService.withdraw(USER_ID, 10000, { payout })

    expect(payout).toHaveBeenCalledWith({
      userId: USER_ID,
      amount: 10000,
      upiId: "upi@bank",
      transactionId: "tx-1",
    })
    expect(tx.status).toBe("completed")
    expect(tx.save).toHaveBeenCalled()
    expect(result).toBe(tx)
  })

  it("restores the balance and marks the request failed when the payout fails", async () => {
    const payout = vi.fn().mockRejectedValue(
      Object.assign(new Error("payout failed"), { status: 503, code: "PAYMENTS_NOT_CONFIGURED" }),
    )
    const tx = makeTx({ status: "pending" })
    mocks.userFindById.mockResolvedValue({
      kycStatus: "verified",
      panVerified: true,
      getUpiId: () => "upi@bank",
    })
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(makeWallet({ balance: 50000 })) // getWallet
    mocks.walletFindOneAndUpdate.mockResolvedValueOnce(
      makeWallet({ balance: 40000, totalWithdrawn: 10000 }),
    ) // atomic decrement
    mocks.txCreate.mockResolvedValue(tx)

    await expect(walletService.withdraw(USER_ID, 10000, { payout })).rejects.toMatchObject({
      status: 503,
      code: "PAYMENTS_NOT_CONFIGURED",
    })

    // Balance restored, totalWithdrawn back to 0, request marked failed
    expect(mocks.walletUpdateOne).toHaveBeenCalledWith(
      { userId: USER_ID },
      { $inc: { balance: 10000, totalWithdrawn: -10000 } },
    )
    expect(tx.status).toBe("failed")
    expect(tx.save).toHaveBeenCalled()
  })
})

describe("getTransactions", () => {
  it("returns paginated history with type filter", async () => {
    // Chainable query stub: find() → sort() → skip() → limit()
    mocks.txFind.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([makeTx(), makeTx()]),
    })
    mocks.txCount.mockResolvedValue(42)

    const result = await walletService.getTransactions(USER_ID, {
      type: "contest_fee",
      page: 2,
      limit: 10,
    })

    expect(mocks.txFind).toHaveBeenCalledWith({ userId: USER_ID, type: "contest_fee" })
    expect(mocks.txCount).toHaveBeenCalledWith({ userId: USER_ID, type: "contest_fee" })
    expect(result).toMatchObject({ total: 42, page: 2, limit: 10, totalPages: 5 })
    expect(result.transactions).toHaveLength(2)
  })
})

describe("setStatus", () => {
  it("freezes the wallet", async () => {
    mocks.walletFindOneAndUpdate.mockResolvedValue(makeWallet({ status: "frozen" }))

    const wallet = await walletService.setStatus(USER_ID, "frozen")

    expect(mocks.walletFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: USER_ID },
      { status: "frozen" },
      { new: true },
    )
    expect(wallet.status).toBe("frozen")
  })

  it("404s when the wallet does not exist", async () => {
    mocks.walletFindOneAndUpdate.mockResolvedValue(null)

    await expect(walletService.setStatus(USER_ID, "frozen")).rejects.toMatchObject({
      status: 404,
      code: "WALLET_NOT_FOUND",
    })
  })
})
