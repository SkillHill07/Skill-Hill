import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { type Request, type Response, type NextFunction } from "express"
import { leaderboardRouter } from "./leaderboard.routes.js"
import { errorHandler } from "../../middlewares/error-handler.js"

/**
 * Route unit tests for the leaderboard endpoints:
 * GET /contests/:contestId/leaderboard (public, ?limit=) and
 * GET /contests/:contestId/leaderboard/me (authenticated).
 * Auth is stubbed as a pass-through (admin); the service is mocked.
 */
const mocks = vi.hoisted(() => ({
  getLeaderboard: vi.fn(),
  getMyRank: vi.fn(),
}))

vi.mock("./leaderboard.service.js", () => ({
  leaderboardService: {
    getLeaderboard: mocks.getLeaderboard,
    getMyRank: mocks.getMyRank,
  },
}))
vi.mock("../auth/middleware/auth.middleware.js", () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: "admin-1", email: "admin@test.com", role: "admin" }
    next()
  },
  optionalAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: "admin-1", email: "admin@test.com", role: "admin" }
    next()
  },
  requireRole: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}))
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn() },
}))

const app = express()
app.use(express.json())
app.use(leaderboardRouter)
app.use(errorHandler)

const CONTEST_ID = "64b7f9c5e5b9c1a2b3c4d5e5"

const leaderboardResult = {
  contestId: CONTEST_ID,
  returned: 2,
  entries: [
    {
      rank: 1,
      userId: "u1",
      totalScore: 300,
      submittedAt: new Date("2026-01-01T10:00:00Z"),
      user: { firstName: "A", lastName: "B", avatarUrl: null },
    },
    {
      rank: 2,
      userId: "u2",
      totalScore: 100,
      submittedAt: new Date("2026-01-01T10:00:01Z"),
      user: { firstName: "C", lastName: "D", avatarUrl: null },
    },
  ],
}

describe("GET /contests/:contestId/leaderboard", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns the ranked leaderboard with the default limit of 100", async () => {
    mocks.getLeaderboard.mockResolvedValue(leaderboardResult)

    const res = await request(app).get(`/${CONTEST_ID}/leaderboard`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.entries).toHaveLength(2)
    expect(res.body.data.entries[0].rank).toBe(1)
    expect(mocks.getLeaderboard).toHaveBeenCalledWith(CONTEST_ID, 100, {
      userId: "admin-1",
      email: "admin@test.com",
      role: "admin",
    })
  })

  it("passes a custom limit through", async () => {
    mocks.getLeaderboard.mockResolvedValue(leaderboardResult)

    await request(app).get(`/${CONTEST_ID}/leaderboard?limit=50`)

    expect(mocks.getLeaderboard).toHaveBeenCalledWith(CONTEST_ID, 50, expect.anything())
  })

  it("rejects an out-of-range limit at the validation boundary", async () => {
    const res = await request(app).get(`/${CONTEST_ID}/leaderboard?limit=0`)

    expect(res.status).toBe(400)
    expect(mocks.getLeaderboard).not.toHaveBeenCalled()
  })

  it("propagates 404 when the contest does not exist", async () => {
    mocks.getLeaderboard.mockRejectedValueOnce(
      Object.assign(new Error("Contest not found"), {
        status: 404,
        code: "CONTEST_NOT_FOUND",
      }),
    )

    const res = await request(app).get(`/${CONTEST_ID}/leaderboard`)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ success: false, code: "CONTEST_NOT_FOUND" })
  })
})

describe("GET /contests/:contestId/leaderboard/me", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns the user's rank and score", async () => {
    mocks.getMyRank.mockResolvedValue({
      contestId: CONTEST_ID,
      participated: true,
      submitted: true,
      rank: 1,
      totalScore: 300,
    })

    const res = await request(app).get(`/${CONTEST_ID}/leaderboard/me`)

    expect(res.status).toBe(200)
    expect(res.body.data.rank).toBe(1)
    expect(mocks.getMyRank).toHaveBeenCalledWith("admin-1", CONTEST_ID)
  })

  it("returns rank null when the user has not submitted yet", async () => {
    mocks.getMyRank.mockResolvedValue({
      contestId: CONTEST_ID,
      participated: true,
      submitted: false,
      rank: null,
      totalScore: 0,
    })

    const res = await request(app).get(`/${CONTEST_ID}/leaderboard/me`)

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ submitted: false, rank: null })
  })
})
