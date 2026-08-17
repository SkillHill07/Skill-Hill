import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { type Request, type Response, type NextFunction } from "express"
import { adminWalletRouter } from "./wallet.admin.routes.js"
import { errorHandler } from "../../middlewares/error-handler.js"

/**
 * Admin wallet route tests. Auth is stubbed as a pass-through (admin);
 * role gating itself is covered by the auth middleware tests. The service is
 * mocked; validation boundaries are real.
 */
const mocks = vi.hoisted(() => ({
  setStatus: vi.fn(),
}))

vi.mock("./wallet.service.js", () => ({
  walletService: { setStatus: mocks.setStatus },
}))
vi.mock("../audit/audit.service.js", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined), listLogs: vi.fn() },
}))
vi.mock("../auth/middleware/auth.middleware.js", () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: "admin-1", email: "admin@test.com", role: "admin" }
    next()
  },
  requireRole: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}))
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}))

const app = express()
app.use(express.json())
app.use(adminWalletRouter)
app.use(errorHandler)

const USER_ID = "64b7f9c5e5b9c1a2b3c4d5e5"

beforeEach(() => vi.clearAllMocks())

describe("PATCH /wallets/:userId/status", () => {
  it("freezes the wallet", async () => {
    mocks.setStatus.mockResolvedValue({ userId: USER_ID, status: "frozen" })

    const res = await request(app)
      .patch(`/wallets/${USER_ID}/status`)
      .send({ status: "frozen" })

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe("frozen")
    expect(mocks.setStatus).toHaveBeenCalledWith(USER_ID, "frozen")
  })

  it("rejects an invalid status value", async () => {
    const res = await request(app)
      .patch(`/wallets/${USER_ID}/status`)
      .send({ status: "liquid" })

    expect(res.status).toBe(400)
    expect(mocks.setStatus).not.toHaveBeenCalled()
  })

  it("rejects a malformed userId at the validation boundary", async () => {
    const res = await request(app)
      .patch("/wallets/not-an-object-id/status")
      .send({ status: "frozen" })

    expect(res.status).toBe(400)
    expect(mocks.setStatus).not.toHaveBeenCalled()
  })

  it("propagates 404 when the wallet does not exist", async () => {
    mocks.setStatus.mockRejectedValueOnce(
      Object.assign(new Error("Wallet not found"), {
        status: 404,
        code: "WALLET_NOT_FOUND",
      }),
    )

    const res = await request(app)
      .patch(`/wallets/${USER_ID}/status`)
      .send({ status: "frozen" })

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ success: false, code: "WALLET_NOT_FOUND" })
  })
})
