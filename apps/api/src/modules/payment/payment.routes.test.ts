import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { type Request, type Response, type NextFunction } from "express"
import { paymentRouter } from "./payment.routes.js"
import { errorHandler } from "../../middlewares/error-handler.js"

/**
 * User payment route tests. Auth is stubbed (sets req.user), the service is
 * mocked, real Zod validation runs at the boundary.
 */
const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  listUserPayments: vi.fn(),
}))

vi.mock("./payment.service.js", () => ({
  paymentService: {
    createOrder: mocks.createOrder,
    listUserPayments: mocks.listUserPayments,
  },
}))
vi.mock("../auth/middleware/auth.middleware.js", () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: "u1", email: "u@test.com", role: "user" }
    next()
  },
}))
vi.mock("../../config/index.js", () => ({
  config: { DEPOSIT_MIN_PAISE: 1000, DEPOSIT_MAX_PAISE: 500000 },
}))
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}))

const app = express()
app.use(express.json())
app.use(paymentRouter)
app.use(errorHandler)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /payments/create-order", () => {
  it("creates an order for the authenticated user", async () => {
    mocks.createOrder.mockResolvedValue({
      orderId: "order_1",
      amount: 2000,
      currency: "INR",
      keyId: "rzp_test_key",
      paymentId: "pay-db-1",
      receipt: "deposit:u1:1",
      purpose: "deposit",
    })

    const res = await request(app).post("/create-order").send({ amount: 2000 })

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ orderId: "order_1", amount: 2000 })
    expect(mocks.createOrder).toHaveBeenCalledWith("u1", {
      amount: 2000,
      purpose: "deposit",
    })
  })

  it("passes purpose + contestId through when provided", async () => {
    mocks.createOrder.mockResolvedValue({ orderId: "order_1" })

    await request(app)
      .post("/create-order")
      .send({ amount: 2000, purpose: "contest", contestId: "64b7f9c5e5b9c1a2b3c4d5e6" })

    expect(mocks.createOrder).toHaveBeenCalledWith("u1", {
      amount: 2000,
      purpose: "contest",
      contestId: "64b7f9c5e5b9c1a2b3c4d5e6",
    })
  })

  it("rejects amounts below the deposit minimum at the validation boundary", async () => {
    const res = await request(app).post("/create-order").send({ amount: 500 })

    expect(res.status).toBe(400)
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })

  it("propagates a 503 PAYMENTS_NOT_CONFIGURED from the service", async () => {
    mocks.createOrder.mockRejectedValue(
      Object.assign(new Error("not configured"), { status: 503, code: "PAYMENTS_NOT_CONFIGURED" }),
    )

    const res = await request(app).post("/create-order").send({ amount: 2000 })

    expect(res.status).toBe(503)
    expect(res.body.code).toBe("PAYMENTS_NOT_CONFIGURED")
  })
})

describe("GET /payments", () => {
  it("returns the user's payment history with parsed filters", async () => {
    mocks.listUserPayments.mockResolvedValue({
      payments: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    })

    const res = await request(app).get("/?status=paid&page=2&limit=10")

    expect(res.status).toBe(200)
    expect(mocks.listUserPayments).toHaveBeenCalledWith("u1", {
      status: "paid",
      page: 2,
      limit: 10,
    })
  })

  it("rejects an unknown status filter", async () => {
    const res = await request(app).get("/?status=bogus")

    expect(res.status).toBe(400)
    expect(mocks.listUserPayments).not.toHaveBeenCalled()
  })
})
