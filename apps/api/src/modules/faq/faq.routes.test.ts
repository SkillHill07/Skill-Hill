import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { type Request, type Response, type NextFunction } from "express"
import { faqRouter } from "./faq.routes.js"
import { errorHandler } from "../../middlewares/error-handler.js"

/**
 * Route unit tests for /site/faqs CRUD.
 * Auth is stubbed as a pass-through (admin) with a configurable currentUser
 * to exercise the includeInactive role gating.
 */
const mocks = vi.hoisted(() => ({
  listFaqs: vi.fn(),
  createFaq: vi.fn(),
  updateFaq: vi.fn(),
  deleteFaq: vi.fn(),
  currentUser: {
    userId: "admin-1",
    email: "admin@test.com",
    role: "admin",
  } as { userId: string; email: string; role: "admin" } | null,
}))

vi.mock("./faq.service.js", () => ({
  faqService: {
    listFaqs: mocks.listFaqs,
    createFaq: mocks.createFaq,
    updateFaq: mocks.updateFaq,
    deleteFaq: mocks.deleteFaq,
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
app.use(faqRouter)
app.use(errorHandler)

const ID = "64b7f9c5e5b9c1a2b3c4d5e3"
const faqDoc = {
  _id: ID,
  question: "How do prizes work?",
  answer: "Top scorers split the prize pool after the contest settles.",
  category: "Prizes",
  order: 1,
  active: true,
}

describe("GET /site/faqs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.currentUser = { userId: "admin-1", email: "admin@test.com", role: "admin" }
  })

  it("lists active FAQs for public callers", async () => {
    mocks.listFaqs.mockResolvedValue([faqDoc])

    const res = await request(app).get("/site/faqs")

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(mocks.listFaqs).toHaveBeenCalledWith(false, undefined)
  })

  it("passes a category filter through to the service", async () => {
    mocks.listFaqs.mockResolvedValue([faqDoc])

    const res = await request(app).get("/site/faqs?category=Prizes")

    expect(res.status).toBe(200)
    expect(mocks.listFaqs).toHaveBeenCalledWith(false, "Prizes")
  })

  it("lets staff list all FAQs via includeInactive", async () => {
    mocks.listFaqs.mockResolvedValue([faqDoc])

    const res = await request(app).get("/site/faqs?includeInactive=true")

    expect(res.status).toBe(200)
    expect(mocks.listFaqs).toHaveBeenCalledWith(true, undefined)
  })

  it("returns 403 when a non-staff caller requests includeInactive", async () => {
    mocks.currentUser = null

    const res = await request(app).get("/site/faqs?includeInactive=true")

    expect(res.status).toBe(403)
    expect(mocks.listFaqs).not.toHaveBeenCalled()
  })
})

describe("POST /site/faqs", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates an FAQ", async () => {
    mocks.createFaq.mockResolvedValue(faqDoc)

    const res = await request(app)
      .post("/site/faqs")
      .send({ question: "How do prizes work?", answer: "Top scorers split the pool." })

    expect(res.status).toBe(201)
    expect(mocks.createFaq).toHaveBeenCalledWith({
      question: "How do prizes work?",
      answer: "Top scorers split the pool.",
    })
  })

  it("rejects with 400 when required fields are missing", async () => {
    const res = await request(app).post("/site/faqs").send({ question: "No answer" })

    expect(res.status).toBe(400)
    expect(mocks.createFaq).not.toHaveBeenCalled()
  })
})

describe("PATCH /site/faqs/:id", () => {
  beforeEach(() => vi.clearAllMocks())

  it("updates an FAQ", async () => {
    mocks.updateFaq.mockResolvedValue({ ...faqDoc, category: "General" })

    const res = await request(app)
      .patch(`/site/faqs/${ID}`)
      .send({ category: "General" })

    expect(res.status).toBe(200)
    expect(mocks.updateFaq).toHaveBeenCalledWith(ID, { category: "General" })
  })

  it("rejects a malformed id at the validation boundary", async () => {
    const res = await request(app)
      .patch("/site/faqs/not-an-id")
      .send({ active: true })

    expect(res.status).toBe(400)
    expect(mocks.updateFaq).not.toHaveBeenCalled()
  })
})

describe("DELETE /site/faqs/:id", () => {
  beforeEach(() => vi.clearAllMocks())

  it("deletes an FAQ", async () => {
    mocks.deleteFaq.mockResolvedValue(undefined)

    const res = await request(app).delete(`/site/faqs/${ID}`)

    expect(res.status).toBe(200)
    expect(mocks.deleteFaq).toHaveBeenCalledWith(ID)
  })

  it("propagates 404 when the FAQ does not exist", async () => {
    mocks.deleteFaq.mockRejectedValueOnce(
      Object.assign(new Error("FAQ not found"), {
        status: 404,
        code: "FAQ_NOT_FOUND",
      }),
    )

    const res = await request(app).delete(`/site/faqs/${ID}`)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ success: false, code: "FAQ_NOT_FOUND" })
  })
})
