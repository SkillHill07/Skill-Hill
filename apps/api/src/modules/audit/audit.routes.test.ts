import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { type Request, type Response, type NextFunction } from "express"
import { adminAuditRouter } from "./audit.routes.js"
import { errorHandler } from "../../middlewares/error-handler.js"
import type { Role } from "@skillcontest/shared-types"

/**
 * Admin audit route tests. `authenticate` sets req.user; `requireRole` is the
 * real one so role enforcement is exercised. The service is mocked.
 */
const mocks = vi.hoisted(() => ({
  listLogs: vi.fn(),
  currentRole: { value: "admin" as Role },
}))

vi.mock("./audit.service.js", () => ({
  auditService: { log: vi.fn(), listLogs: mocks.listLogs },
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
app.use(adminAuditRouter)
app.use(errorHandler)

const LOG = {
  _id: "64b7f9c5e5b9c1a2b3c4d5e7",
  actorId: "a1",
  actorRole: "admin",
  action: "contest.publish",
  resource: "contest",
  resourceId: "64b7f9c5e5b9c1a2b3c4d5e6",
  details: null,
  ip: "127.0.0.1",
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-01T10:00:00.000Z",
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.currentRole.value = "admin"
})

describe("GET /audit", () => {
  it("returns the paginated audit trail", async () => {
    mocks.listLogs.mockResolvedValue({ logs: [LOG], total: 1, page: 1, limit: 20, totalPages: 1 })

    const res = await request(app).get("/audit")

    expect(res.status).toBe(200)
    expect(res.body.data.logs).toHaveLength(1)
    expect(res.body.data.logs[0].action).toBe("contest.publish")
    expect(mocks.listLogs).toHaveBeenCalledWith({
      action: undefined,
      actorId: undefined,
      resource: undefined,
      page: 1,
      limit: 20,
    })
  })

  it("passes query filters through", async () => {
    mocks.listLogs.mockResolvedValue({ logs: [], total: 0, page: 1, limit: 50, totalPages: 0 })

    const res = await request(app).get("/audit?action=payment.refund&actorId=a1&limit=50")

    expect(res.status).toBe(200)
    expect(mocks.listLogs).toHaveBeenCalledWith({
      action: "payment.refund",
      actorId: "a1",
      resource: undefined,
      page: 1,
      limit: 50,
    })
  })

  it("rejects an out-of-range limit at the validation boundary", async () => {
    const res = await request(app).get("/audit?limit=101")

    expect(res.status).toBe(400)
    expect(mocks.listLogs).not.toHaveBeenCalled()
  })

  it("forbids non-staff roles", async () => {
    mocks.currentRole.value = "user"

    const res = await request(app).get("/audit")

    expect(res.status).toBe(403)
    expect(mocks.listLogs).not.toHaveBeenCalled()
  })
})
