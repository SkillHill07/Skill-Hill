import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express from "express"
import { practiceProblemRouter } from "./problem.routes.js"
import { errorHandler } from "../../middlewares/error-handler.js"

/**
 * Practice library route tests. The service is mocked; validation boundaries
 * are real. Auth is irrelevant (public routes).
 */
const mocks = vi.hoisted(() => ({
  listPracticeProblems: vi.fn(),
  getPracticeProblem: vi.fn(),
}))

vi.mock("./problem.service.js", () => ({
  problemService: {
    listPracticeProblems: mocks.listPracticeProblems,
    getPracticeProblem: mocks.getPracticeProblem,
  },
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
app.use(practiceProblemRouter)
app.use(errorHandler)

const PROBLEM = {
  _id: "64b7f9c5e5b9c1a2b3c4d5e8",
  title: "Two Sum",
  difficulty: "easy",
  type: "coding",
  points: 100,
  contestId: { _id: "64b7f9c5e5b9c1a2b3c4d5e6", title: "Weekly Challenge", slug: "weekly-1", status: "settled", type: "paid", entryFee: 2000 },
}

beforeEach(() => vi.clearAllMocks())

describe("GET /problems", () => {
  it("returns the paginated practice library", async () => {
    mocks.listPracticeProblems.mockResolvedValue({
      problems: [PROBLEM],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    })

    const res = await request(app).get("/")

    expect(res.status).toBe(200)
    expect(res.body.data.problems).toHaveLength(1)
    expect(mocks.listPracticeProblems).toHaveBeenCalledWith({
      difficulty: undefined,
      type: undefined,
      search: undefined,
      language: undefined,
      page: 1,
      limit: 20,
    })
  })

  it("passes filters through", async () => {
    mocks.listPracticeProblems.mockResolvedValue({
      problems: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    })

    const res = await request(app).get("/?difficulty=hard&type=coding&search=sum&language=python&limit=10")

    expect(res.status).toBe(200)
    expect(mocks.listPracticeProblems).toHaveBeenCalledWith({
      difficulty: "hard",
      type: "coding",
      search: "sum",
      language: "python",
      page: 1,
      limit: 10,
    })
  })

  it("rejects an invalid difficulty value", async () => {
    const res = await request(app).get("/?difficulty=insane")

    expect(res.status).toBe(400)
    expect(mocks.listPracticeProblems).not.toHaveBeenCalled()
  })
})

describe("GET /problems/:id", () => {
  it("returns a single practice problem", async () => {
    mocks.getPracticeProblem.mockResolvedValue(PROBLEM)

    const res = await request(app).get("/64b7f9c5e5b9c1a2b3c4d5e8")

    expect(res.status).toBe(200)
    expect(res.body.data.title).toBe("Two Sum")
    expect(mocks.getPracticeProblem).toHaveBeenCalledWith("64b7f9c5e5b9c1a2b3c4d5e8")
  })

  it("propagates 404 for hidden problems", async () => {
    mocks.getPracticeProblem.mockRejectedValueOnce(
      Object.assign(new Error("Problem not found"), {
        status: 404,
        code: "PROBLEM_NOT_FOUND",
      }),
    )

    const res = await request(app).get("/64b7f9c5e5b9c1a2b3c4d5e8")

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ success: false, code: "PROBLEM_NOT_FOUND" })
  })
})
