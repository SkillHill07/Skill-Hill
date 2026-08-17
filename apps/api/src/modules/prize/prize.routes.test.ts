import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { type Request, type Response, type NextFunction } from "express"
import { contestPrizeRouter, userPrizeRouter } from "./prize.routes.js"
import { errorHandler } from "../../middlewares/error-handler.js"

/**
 * Prize route tests. `optionalAuth`/`authenticate` are stubbed, the service is
 * mocked, real Zod validation runs at the boundary.
 */
const mocks = vi.hoisted(() => ({
  getContestPrizes: vi.fn(),
  listUserPrizes: vi.fn(),
}))

vi.mock("./prize.service.js", () => ({
  prizeService: {
    getContestPrizes: mocks.getContestPrizes,
    listUserPrizes: mocks.listUserPrizes,
  },
}))
vi.mock("../auth/middleware/auth.middleware.js", () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: "u1", email: "u@test.com", role: "user" }
    next()
  },
  optionalAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: "u1", email: "u@test.com", role: "user" }
    next()
  },
}))
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}))

const contestApp = express()
contestApp.use(contestPrizeRouter)
contestApp.use(errorHandler)

const userApp = express()
userApp.use(express.json())
userApp.use(userPrizeRouter)
userApp.use(errorHandler)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("GET /contests/:id/prizes (public)", () => {
  it("returns the prize structure + winners", async () => {
    mocks.getContestPrizes.mockResolvedValue({
      contestId: "64b7f9c5e5b9c1a2b3c4d5e6",
      type: "paid",
      participantCount: 10,
      pool: 20000,
      netPool: 18000,
      platformFeeRate: 0.1,
      structure: [],
      winners: [],
    })

    const res = await request(contestApp).get("/64b7f9c5e5b9c1a2b3c4d5e6/prizes")

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ netPool: 18000, winners: [] })
  })

  it("rejects a malformed contest id", async () => {
    const res = await request(contestApp).get("/not-an-id/prizes")

    expect(res.status).toBe(400)
    expect(mocks.getContestPrizes).not.toHaveBeenCalled()
  })
})

describe("GET /prizes (user history)", () => {
  it("returns the user's paginated prizes", async () => {
    mocks.listUserPrizes.mockResolvedValue({
      prizes: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    })

    const res = await request(userApp).get("/")

    expect(res.status).toBe(200)
    expect(mocks.listUserPrizes).toHaveBeenCalledWith("u1", { page: 1, limit: 20 })
  })

  it("passes pagination params through", async () => {
    mocks.listUserPrizes.mockResolvedValue({ prizes: [], total: 0, page: 2, limit: 10, totalPages: 0 })

    await request(userApp).get("/?page=2&limit=10")

    expect(mocks.listUserPrizes).toHaveBeenCalledWith("u1", { page: 2, limit: 10 })
  })
})
