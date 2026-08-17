import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { type Request, type Response, type NextFunction } from "express"
import { whyChooseUsRouter } from "./whyChooseUs.routes.js"
import { errorHandler } from "../../middlewares/error-handler.js"

/**
 * Route unit tests for /site/why-choose-us CRUD.
 * Auth is stubbed as a pass-through (admin) with a configurable currentUser
 * to exercise the includeInactive role gating.
 */
const mocks = vi.hoisted(() => ({
  listWhyChooseUs: vi.fn(),
  createWhyChooseUs: vi.fn(),
  updateWhyChooseUs: vi.fn(),
  deleteWhyChooseUs: vi.fn(),
  currentUser: {
    userId: "admin-1",
    email: "admin@test.com",
    role: "admin",
  } as { userId: string; email: string; role: "admin" } | null,
}))

vi.mock("./whyChooseUs.service.js", () => ({
  whyChooseUsService: {
    listWhyChooseUs: mocks.listWhyChooseUs,
    createWhyChooseUs: mocks.createWhyChooseUs,
    updateWhyChooseUs: mocks.updateWhyChooseUs,
    deleteWhyChooseUs: mocks.deleteWhyChooseUs,
  },
}))
vi.mock("../auth/middleware/auth.middleware.js", () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    if (mocks.currentUser) req.user = mocks.currentUser
    next()
  },
  optionalAuth: (req: Request, _res: Response, next: NextFunction) => {
    if (mocks.currentUser) req.user = mocks.currentUser
    next()
  },
  requireRole: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}))
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn() },
}))

const app = express()
app.use(express.json())
app.use(whyChooseUsRouter)
app.use(errorHandler)

const ID = "64b7f9c5e5b9c1a2b3c4d5e1"
const itemDoc = {
  _id: ID,
  title: "Fair judging",
  description: "Automated, unbiased scoring by an isolated sandbox",
  icon: "⚖️",
  order: 1,
  active: true,
}

describe("GET /site/why-choose-us", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.currentUser = { userId: "admin-1", email: "admin@test.com", role: "admin" }
  })

  it("lists active items for public callers", async () => {
    mocks.listWhyChooseUs.mockResolvedValue([itemDoc])

    const res = await request(app).get("/site/why-choose-us")

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(mocks.listWhyChooseUs).toHaveBeenCalledWith(false)
  })

  it("lets staff list all items via includeInactive", async () => {
    mocks.listWhyChooseUs.mockResolvedValue([itemDoc])

    const res = await request(app).get("/site/why-choose-us?includeInactive=true")

    expect(res.status).toBe(200)
    expect(mocks.listWhyChooseUs).toHaveBeenCalledWith(true)
  })

  it("returns 403 when a non-staff caller requests includeInactive", async () => {
    mocks.currentUser = null

    const res = await request(app).get("/site/why-choose-us?includeInactive=true")

    expect(res.status).toBe(403)
    expect(mocks.listWhyChooseUs).not.toHaveBeenCalled()
  })
})

describe("POST /site/why-choose-us", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates an item", async () => {
    mocks.createWhyChooseUs.mockResolvedValue(itemDoc)

    const res = await request(app)
      .post("/site/why-choose-us")
      .send({ title: "Fair judging", description: "Automated, unbiased scoring" })

    expect(res.status).toBe(201)
    expect(mocks.createWhyChooseUs).toHaveBeenCalledWith({
      title: "Fair judging",
      description: "Automated, unbiased scoring",
    })
  })

  it("rejects with 400 when required fields are missing", async () => {
    const res = await request(app).post("/site/why-choose-us").send({ title: "No description" })

    expect(res.status).toBe(400)
    expect(mocks.createWhyChooseUs).not.toHaveBeenCalled()
  })
})

describe("PATCH /site/why-choose-us/:id", () => {
  beforeEach(() => vi.clearAllMocks())

  it("updates an item", async () => {
    mocks.updateWhyChooseUs.mockResolvedValue({ ...itemDoc, active: false })

    const res = await request(app).patch(`/site/why-choose-us/${ID}`).send({ active: false })

    expect(res.status).toBe(200)
    expect(mocks.updateWhyChooseUs).toHaveBeenCalledWith(ID, { active: false })
  })

  it("rejects a malformed id at the validation boundary", async () => {
    const res = await request(app)
      .patch("/site/why-choose-us/not-an-id")
      .send({ active: true })

    expect(res.status).toBe(400)
    expect(mocks.updateWhyChooseUs).not.toHaveBeenCalled()
  })
})

describe("DELETE /site/why-choose-us/:id", () => {
  beforeEach(() => vi.clearAllMocks())

  it("deletes an item", async () => {
    mocks.deleteWhyChooseUs.mockResolvedValue(undefined)

    const res = await request(app).delete(`/site/why-choose-us/${ID}`)

    expect(res.status).toBe(200)
    expect(mocks.deleteWhyChooseUs).toHaveBeenCalledWith(ID)
  })

  it("propagates 404 when the item does not exist", async () => {
    mocks.deleteWhyChooseUs.mockRejectedValueOnce(
      Object.assign(new Error("Why choose us item not found"), {
        status: 404,
        code: "WHY_CHOOSE_US_NOT_FOUND",
      }),
    )

    const res = await request(app).delete(`/site/why-choose-us/${ID}`)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ success: false, code: "WHY_CHOOSE_US_NOT_FOUND" })
  })
})
