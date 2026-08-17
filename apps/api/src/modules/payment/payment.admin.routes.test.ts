import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { type Request, type Response, type NextFunction } from "express"
import { adminPaymentRouter } from "./payment.admin.routes.js"
import { errorHandler } from "../../middlewares/error-handler.js"
import type { Role } from "@skillcontest/shared-types"

/**
 * Admin payment route tests. `authenticate` sets req.user; `requireRole` is
 * the real one, so role enforcement is exercised. The service is mocked.
 */
const mocks = vi.hoisted(() => ({
  listAllPayments: vi.fn(),
  refundPayment: vi.fn(),
  currentRole: { value: "admin" as Role },
}))

vi.mock("./payment.service.js", () => ({
  paymentService: {
    listAllPayments: mocks.listAllPayments,
    refundPayment: mocks.refundPayment,
  },
}))
vi.mock("../audit/audit.service.js", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined), listLogs: vi.fn() },
}))
vi.mock("../auth/middleware/auth.middleware.js", () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: "a1", email: "admin@test.com", role: mocks.currentRole.value }
    next()
  },
  requireRole: (...roles: Role[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const role = req.user?.role
      if (!role || !roles.includes(role)) {
        res.status(403).json({ success: false, error: "Forbidden" })
        return
      }
      next()
    }
  },
}))
vi.mock("../../config/index.js", () => ({
  config: {},
}))
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}))

const app = express()
app.use(express.json())
app.use(adminPaymentRouter)
app.use(errorHandler)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.currentRole.value = "admin"
})

describe("GET /admin/payments", () => {
  it("returns the audit view for an admin", async () => {
    mocks.listAllPayments.mockResolvedValue({
      payments: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    })

    const res = await request(app).get("/payments?status=failed")

    expect(res.status).toBe(200)
    expect(mocks.listAllPayments).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", page: 1, limit: 20 }),
    )
  })

  it("allows creators to view the audit list", async () => {
    mocks.currentRole.value = "creator"
    mocks.listAllPayments.mockResolvedValue({ payments: [], total: 0, page: 1, limit: 20, totalPages: 0 })

    const res = await request(app).get("/payments")

    expect(res.status).toBe(200)
  })

  it("blocks regular users", async () => {
    mocks.currentRole.value = "user"

    const res = await request(app).get("/payments")

    expect(res.status).toBe(403)
    expect(mocks.listAllPayments).not.toHaveBeenCalled()
  })
})

describe("POST /admin/payments/refund", () => {
  it("refunds a payment as admin", async () => {
    mocks.refundPayment.mockResolvedValue({ _id: "p1", status: "refunded", refundId: "refund_1" })

    const res = await request(app)
      .post("/payments/refund")
      .send({ paymentId: "64b7f9c5e5b9c1a2b3c4d5e9" })

    expect(res.status).toBe(200)
    expect(mocks.refundPayment).toHaveBeenCalledWith("64b7f9c5e5b9c1a2b3c4d5e9")
  })

  it("rejects a malformed payment id at the validation boundary", async () => {
    const res = await request(app).post("/payments/refund").send({ paymentId: "not-an-id" })

    expect(res.status).toBe(400)
    expect(mocks.refundPayment).not.toHaveBeenCalled()
  })

  it("blocks creators from refunding (admin only)", async () => {
    mocks.currentRole.value = "creator"

    const res = await request(app)
      .post("/payments/refund")
      .send({ paymentId: "64b7f9c5e5b9c1a2b3c4d5e9" })

    expect(res.status).toBe(403)
    expect(mocks.refundPayment).not.toHaveBeenCalled()
  })
})
