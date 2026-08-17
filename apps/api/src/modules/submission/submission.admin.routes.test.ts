import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { type Request, type Response, type NextFunction } from "express"
import { adminSubmissionRouter } from "./submission.admin.routes.js"
import { errorHandler } from "../../middlewares/error-handler.js"

/**
 * Route unit tests for GET /admin/contests/:contestId/submissions (audit view).
 * Auth is stubbed as a pass-through (admin). The service is mocked; the
 * pagination/filter mapping and the zod query boundary are exercised for real.
 */
const mocks = vi.hoisted(() => ({
  listSubmissionsAdmin: vi.fn(),
}))

vi.mock("./submission.service.js", () => ({
  submissionService: { listSubmissionsAdmin: mocks.listSubmissionsAdmin },
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
// The router is mounted at /admin in app.ts — mirror that here so the
// /admin/contests/:contestId/submissions path matches.
app.use("/admin", adminSubmissionRouter)
app.use(errorHandler)

const CONTEST_ID = "64b7f9c5e5b9c1a2b3c4d5e4"

describe("GET /admin/contests/:contestId/submissions", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns the paginated audit view", async () => {
    mocks.listSubmissionsAdmin.mockResolvedValue({
      submissions: [
        {
          _id: "s1",
          status: "accepted",
          totalScore: 100,
          code: "console.log(1)",
          userId: { _id: "u1", firstName: "A", lastName: "B", email: "a@b.com" },
          problemId: { _id: "p1", title: "Two Sum", type: "coding" },
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    })

    const res = await request(app).get(`/admin/contests/${CONTEST_ID}/submissions`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.total).toBe(1)
    expect(res.body.data.submissions[0].status).toBe("accepted")
    expect(res.body.data.submissions[0].problemId.title).toBe("Two Sum")

    // Default pagination + no filters
    expect(mocks.listSubmissionsAdmin).toHaveBeenCalledWith(CONTEST_ID, {
      status: undefined,
      problemId: undefined,
      userId: undefined,
      language: undefined,
      page: 1,
      limit: 20,
    })
  })

  it("passes filters and pagination through", async () => {
    mocks.listSubmissionsAdmin.mockResolvedValue({
      submissions: [],
      total: 0,
      page: 2,
      limit: 10,
      totalPages: 0,
    })

    await request(app).get(
      `/admin/contests/${CONTEST_ID}/submissions?status=accepted&language=python&page=2&limit=10`,
    )

    expect(mocks.listSubmissionsAdmin).toHaveBeenCalledWith(CONTEST_ID, {
      status: "accepted",
      problemId: undefined,
      userId: undefined,
      language: "python",
      page: 2,
      limit: 10,
    })
  })

  it("rejects an invalid status at the validation boundary", async () => {
    const res = await request(app).get(
      `/admin/contests/${CONTEST_ID}/submissions?status=weird`,
    )

    expect(res.status).toBe(400)
    expect(mocks.listSubmissionsAdmin).not.toHaveBeenCalled()
  })

  it("rejects a non-numeric page at the validation boundary", async () => {
    const res = await request(app).get(
      `/admin/contests/${CONTEST_ID}/submissions?page=abc`,
    )

    expect(res.status).toBe(400)
    expect(mocks.listSubmissionsAdmin).not.toHaveBeenCalled()
  })

  it("propagates 404 when the contest does not exist", async () => {
    mocks.listSubmissionsAdmin.mockRejectedValueOnce(
      Object.assign(new Error("Contest not found"), {
        status: 404,
        code: "CONTEST_NOT_FOUND",
      }),
    )

    const res = await request(app).get(`/admin/contests/${CONTEST_ID}/submissions`)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ success: false, code: "CONTEST_NOT_FOUND" })
  })
})
