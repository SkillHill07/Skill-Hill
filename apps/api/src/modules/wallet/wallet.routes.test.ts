import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { type Request, type Response, type NextFunction } from "express"
import { walletRouter } from "./wallet.routes.js"
import { errorHandler } from "../../middlewares/error-handler.js"

/**
 * Route tests for the user wallet endpoints. Auth is stubbed as a pass-through
 * (sets req.user), the service is mocked, and the config is stubbed so the
 * withdrawal validation min is deterministic.
 */
const mocks = vi.hoisted(() => ({
  getBalance: vi.fn(),
  getTransactions: vi.fn(),
  withdraw: vi.fn(),
  createOrder: vi.fn(),
  // Withdrawal gateway availability — flippable per test
  razorpayKeyId: { value: "test_key_id" },
  razorpayxAccountNumber: { value: "7878780080316316" },
  initiatePayout: vi.fn(),
}))

vi.mock("./wallet.service.js", () => ({
  walletService: {
    getBalance: mocks.getBalance,
    getTransactions: mocks.getTransactions,
    withdraw: mocks.withdraw,
  },
}))
vi.mock("../auth/middleware/auth.middleware.js", () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: "u1", email: "u@test.com", role: "user" }
    next()
  },
}))
vi.mock("../payment/payout.service.js", () => ({
  initiatePayout: mocks.initiatePayout,
}))
vi.mock("../payment/payment.service.js", () => ({
  paymentService: { createOrder: mocks.createOrder },
}))
vi.mock("../../config/index.js", () => ({
  config: {
    WITHDRAWAL_MIN_PAISE: 10000,
    DEPOSIT_MIN_PAISE: 1000,
    DEPOSIT_MAX_PAISE: 500000,
    get RAZORPAY_KEY_ID() {
      return mocks.razorpayKeyId.value
    },
    get RAZORPAYX_ACCOUNT_NUMBER() {
      return mocks.razorpayxAccountNumber.value
    },
  },
}))
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}))

const app = express()
app.use(express.json())
app.use(walletRouter)
app.use(errorHandler)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.razorpayKeyId.value = "test_key_id"
  mocks.razorpayxAccountNumber.value = "7878780080316316"
})

describe("GET /wallet/balance", () => {
  it("returns the balance summary for the authenticated user", async () => {
    mocks.getBalance.mockResolvedValue({
      userId: "u1",
      balance: 5000,
      locked: 0,
      available: 5000,
      status: "active",
      totalDeposited: 5000,
      totalWithdrawn: 0,
      totalWon: 0,
      totalSpentOnFees: 0,
    })

    const res = await request(app).get("/balance")

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toMatchObject({ available: 5000, status: "active" })
    expect(mocks.getBalance).toHaveBeenCalledWith("u1")
  })
})

describe("GET /wallet/transactions", () => {
  it("returns paginated history and passes parsed filters through", async () => {
    mocks.getTransactions.mockResolvedValue({
      transactions: [],
      total: 0,
      page: 2,
      limit: 10,
      totalPages: 0,
    })

    const res = await request(app).get("/transactions?type=contest_fee&page=2&limit=10")

    expect(res.status).toBe(200)
    expect(mocks.getTransactions).toHaveBeenCalledWith("u1", {
      type: "contest_fee",
      page: 2,
      limit: 10,
    })
  })

  it("rejects an unknown transaction type at the validation boundary", async () => {
    const res = await request(app).get("/transactions?type=bogus")

    expect(res.status).toBe(400)
    expect(mocks.getTransactions).not.toHaveBeenCalled()
  })
})

describe("POST /wallet/deposit", () => {
  it("forwards to the payment module's order creation with purpose deposit", async () => {
    mocks.createOrder.mockResolvedValue({
      orderId: "order_1",
      amount: 2000,
      currency: "INR",
      keyId: "rzp_test_key",
      paymentId: "pay-db-1",
      receipt: "deposit:u1:1",
      purpose: "deposit",
    })

    const res = await request(app).post("/deposit").send({ amount: 2000 })

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ orderId: "order_1", amount: 2000 })
    expect(mocks.createOrder).toHaveBeenCalledWith("u1", {
      amount: 2000,
      purpose: "deposit",
    })
  })

  it("rejects amounts below the deposit minimum at the validation boundary", async () => {
    const res = await request(app).post("/deposit").send({ amount: 500 })

    expect(res.status).toBe(400)
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })

  it("propagates a 503 PAYMENTS_NOT_CONFIGURED from the payment module", async () => {
    mocks.createOrder.mockRejectedValue(
      Object.assign(new Error("not configured"), { status: 503, code: "PAYMENTS_NOT_CONFIGURED" }),
    )

    const res = await request(app).post("/deposit").send({ amount: 2000 })

    expect(res.status).toBe(503)
    expect(res.body.code).toBe("PAYMENTS_NOT_CONFIGURED")
  })
})

describe("POST /wallet/withdraw", () => {
  it("requests a withdrawal with the real payout gateway injected", async () => {
    mocks.withdraw.mockResolvedValue({
      _id: "tx-1",
      type: "withdrawal",
      amount: 10000,
      status: "pending",
    })

    const res = await request(app)
      .post("/withdraw")
      .send({ amount: 10000, upiId: "user@upi" })

    expect(res.status).toBe(201)
    expect(mocks.withdraw).toHaveBeenCalledWith("u1", 10000, {
      upiId: "user@upi",
      payout: mocks.initiatePayout,
    })
  })

  it("rejects amounts below the withdrawal minimum", async () => {
    const res = await request(app).post("/withdraw").send({ amount: 5000 })

    expect(res.status).toBe(400)
    expect(mocks.withdraw).not.toHaveBeenCalled()
  })

  it("returns 503 PAYMENTS_NOT_CONFIGURED before any ledger work when the payout gateway is not configured", async () => {
    mocks.razorpayxAccountNumber.value = ""

    const res = await request(app).post("/withdraw").send({ amount: 10000 })

    expect(res.status).toBe(503)
    expect(res.body).toMatchObject({ success: false, code: "PAYMENTS_NOT_CONFIGURED" })
    expect(mocks.withdraw).not.toHaveBeenCalled()
  })

  it("also fast-fails 503 when Razorpay is not configured at all", async () => {
    mocks.razorpayKeyId.value = ""

    const res = await request(app).post("/withdraw").send({ amount: 10000 })

    expect(res.status).toBe(503)
    expect(mocks.withdraw).not.toHaveBeenCalled()
  })
})
