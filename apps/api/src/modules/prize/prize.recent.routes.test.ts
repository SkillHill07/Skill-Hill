import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express from "express"
import { publicPrizeRouter } from "./prize.routes.js"
import { errorHandler } from "../../middlewares/error-handler.js"

/**
 * Public recent-winners route tests. The service is mocked; validation is
 * real. Public route — no auth involved.
 */
const mocks = vi.hoisted(() => ({
  listRecentWinners: vi.fn(),
}))

vi.mock("./prize.service.js", () => ({
  prizeService: { listRecentWinners: mocks.listRecentWinners },
}))
vi.mock("../auth/middleware/auth.middleware.js", () => ({
  optionalAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next(),
  authenticate: (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next(),
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next(),
}))
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}))

const app = express()
app.use(express.json())
app.use(publicPrizeRouter)
app.use(errorHandler)

const WINNER = {
  rank: 1,
  prizeAmount: 80000,
  creditedAt: "2026-08-01T10:00:00.000Z",
  user: { firstName: "Ada", lastName: "Lovelace", avatarUrl: null },
  contest: { title: "Weekly Challenge #12", slug: "weekly-12" },
}

beforeEach(() => vi.clearAllMocks())

describe("GET /recent", () => {
  it("returns recent winners with default limit", async () => {
    mocks.listRecentWinners.mockResolvedValue([WINNER])

    const res = await request(app).get("/recent")

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].user.firstName).toBe("Ada")
    expect(mocks.listRecentWinners).toHaveBeenCalledWith(10)
  })

  it("passes a custom limit through", async () => {
    mocks.listRecentWinners.mockResolvedValue([])

    const res = await request(app).get("/recent?limit=5")

    expect(res.status).toBe(200)
    expect(mocks.listRecentWinners).toHaveBeenCalledWith(5)
  })

  it("rejects an out-of-range limit", async () => {
    const res = await request(app).get("/recent?limit=99")

    expect(res.status).toBe(400)
    expect(mocks.listRecentWinners).not.toHaveBeenCalled()
  })
})
