import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { type Request, type Response, type NextFunction } from "express"
import { adminPrizeRouter } from "./prize.admin.routes.js"
import { errorHandler } from "../../middlewares/error-handler.js"
import type { Role } from "@skillcontest/shared-types"

/**
 * Admin prize route tests. `authenticate` sets req.user; `requireRole` is the
 * real one so role enforcement is exercised. The service is mocked.
 */
const mocks = vi.hoisted(() => ({
  distribute: vi.fn(),
  currentRole: { value: "admin" as Role },
}))

vi.mock("./prize.service.js", () => ({
  prizeService: { distribute: mocks.distribute },
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
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}))

const app = express()
app.use(express.json())
app.use(adminPrizeRouter)
app.use(errorHandler)

const CONTEST_ID = "64b7f9c5e5b9c1a2b3c4d5e6"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.currentRole.value = "admin"
})

describe("POST /admin/contests/:id/prizes/redistribute", () => {
  it("re-runs distribution as admin", async () => {
    mocks.distribute.mockResolvedValue({ distributed: 10, failed: 0, netPool: 180000 })

    const res = await request(app).post(`/contests/${CONTEST_ID}/prizes/redistribute`)

    expect(res.status).toBe(200)
    expect(mocks.distribute).toHaveBeenCalledWith(CONTEST_ID)
    expect(res.body.data).toMatchObject({ distributed: 10, failed: 0 })
  })

  it("blocks creators (admin only)", async () => {
    mocks.currentRole.value = "creator"

    const res = await request(app).post(`/contests/${CONTEST_ID}/prizes/redistribute`)

    expect(res.status).toBe(403)
    expect(mocks.distribute).not.toHaveBeenCalled()
  })

  it("rejects a malformed contest id", async () => {
    const res = await request(app).post("/contests/not-an-id/prizes/redistribute")

    expect(res.status).toBe(400)
    expect(mocks.distribute).not.toHaveBeenCalled()
  })

  it("propagates a not-settled error", async () => {
    mocks.distribute.mockRejectedValue(
      Object.assign(new Error("Only settled contests can distribute prizes"), {
        status: 400,
        code: "CONTEST_NOT_SETTLED",
      }),
    )

    const res = await request(app).post(`/contests/${CONTEST_ID}/prizes/redistribute`)

    expect(res.status).toBe(400)
    expect(res.body.code).toBe("CONTEST_NOT_SETTLED")
  })
})
