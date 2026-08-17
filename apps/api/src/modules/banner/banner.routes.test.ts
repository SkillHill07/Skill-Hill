import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { type Request, type Response, type NextFunction } from "express"
import { bannerRouter } from "./banner.routes.js"
import { errorHandler } from "../../middlewares/error-handler.js"

/**
 * Route unit tests for /site/banners CRUD + image upload.
 * Auth is stubbed as a pass-through (admin) with a configurable currentUser.
 * Multer runs for real. R2 upload is mocked at the service layer; the
 * assert-before-upload ordering is verified by the unknown-banner test.
 */
const mocks = vi.hoisted(() => ({
  listBanners: vi.fn(),
  createBanner: vi.fn(),
  updateBanner: vi.fn(),
  deleteBanner: vi.fn(),
  assertBannerExists: vi.fn(),
  uploadBannerImage: vi.fn(),
  currentUser: {
    userId: "admin-1",
    email: "admin@test.com",
    role: "admin",
  } as { userId: string; email: string; role: "admin" } | null,
}))

vi.mock("./banner.service.js", () => ({
  bannerService: {
    listBanners: mocks.listBanners,
    createBanner: mocks.createBanner,
    updateBanner: mocks.updateBanner,
    deleteBanner: mocks.deleteBanner,
    assertBannerExists: mocks.assertBannerExists,
    uploadBannerImage: mocks.uploadBannerImage,
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
app.use(bannerRouter)
app.use(errorHandler)

const ID = "64b7f9c5e5b9c1a2b3c4d5e2"
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const IMAGE_URL = "https://pub-test.r2.dev/site/banner-64b7f9c5e5b9c1a2b3c4d5e2/0123456789abcdef.webp"

const bannerDoc = {
  _id: ID,
  title: "Weekly Challenge #1",
  subtitle: "Win from a ₹10,000 prize pool",
  imageUrl: IMAGE_URL,
  ctaText: "Join now",
  ctaLink: "https://example.com/contests/weekly-1",
  order: 1,
  active: true,
}

describe("GET /site/banners", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.currentUser = { userId: "admin-1", email: "admin@test.com", role: "admin" }
  })

  it("lists active banners for public callers", async () => {
    mocks.listBanners.mockResolvedValue([bannerDoc])

    const res = await request(app).get("/site/banners")

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(mocks.listBanners).toHaveBeenCalledWith(false)
  })

  it("lets staff list all banners via includeInactive", async () => {
    mocks.listBanners.mockResolvedValue([bannerDoc])

    const res = await request(app).get("/site/banners?includeInactive=true")

    expect(res.status).toBe(200)
    expect(mocks.listBanners).toHaveBeenCalledWith(true)
  })

  it("returns 403 when a non-staff caller requests includeInactive", async () => {
    mocks.currentUser = null

    const res = await request(app).get("/site/banners?includeInactive=true")

    expect(res.status).toBe(403)
    expect(mocks.listBanners).not.toHaveBeenCalled()
  })
})

describe("POST /site/banners", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates a banner", async () => {
    mocks.createBanner.mockResolvedValue(bannerDoc)

    const res = await request(app)
      .post("/site/banners")
      .send({ title: "Weekly Challenge #1", ctaLink: "https://example.com/contests/weekly-1" })

    expect(res.status).toBe(201)
    expect(mocks.createBanner).toHaveBeenCalledWith({
      title: "Weekly Challenge #1",
      ctaLink: "https://example.com/contests/weekly-1",
    })
  })

  it("rejects an invalid ctaLink at the validation boundary", async () => {
    const res = await request(app)
      .post("/site/banners")
      .send({ title: "Bad CTA", ctaLink: "javascript:alert(1)" })

    expect(res.status).toBe(400)
    expect(mocks.createBanner).not.toHaveBeenCalled()
  })
})

describe("PATCH /site/banners/:id", () => {
  beforeEach(() => vi.clearAllMocks())

  it("updates a banner", async () => {
    mocks.updateBanner.mockResolvedValue({ ...bannerDoc, order: 2 })

    const res = await request(app).patch(`/site/banners/${ID}`).send({ order: 2 })

    expect(res.status).toBe(200)
    expect(mocks.updateBanner).toHaveBeenCalledWith(ID, { order: 2 })
  })

  it("rejects a malformed id at the validation boundary", async () => {
    const res = await request(app).patch("/site/banners/nope").send({ active: true })

    expect(res.status).toBe(400)
    expect(mocks.updateBanner).not.toHaveBeenCalled()
  })
})

describe("DELETE /site/banners/:id", () => {
  beforeEach(() => vi.clearAllMocks())

  it("deletes a banner", async () => {
    mocks.deleteBanner.mockResolvedValue(undefined)

    const res = await request(app).delete(`/site/banners/${ID}`)

    expect(res.status).toBe(200)
    expect(mocks.deleteBanner).toHaveBeenCalledWith(ID)
  })

  it("propagates 404 when the banner does not exist", async () => {
    mocks.deleteBanner.mockRejectedValueOnce(
      Object.assign(new Error("Banner not found"), {
        status: 404,
        code: "BANNER_NOT_FOUND",
      }),
    )

    const res = await request(app).delete(`/site/banners/${ID}`)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ success: false, code: "BANNER_NOT_FOUND" })
  })
})

describe("POST /site/banners/:id/image", () => {
  beforeEach(() => vi.clearAllMocks())

  it("uploads the banner image and persists the returned URL", async () => {
    mocks.assertBannerExists.mockResolvedValue(undefined)
    mocks.uploadBannerImage.mockResolvedValue(bannerDoc)

    const res = await request(app)
      .post(`/site/banners/${ID}/image`)
      .attach("image", PNG_BYTES, { filename: "banner.png", contentType: "image/png" })

    expect(res.status).toBe(200)
    expect(res.body.data.imageUrl).toBe(IMAGE_URL)
    expect(mocks.assertBannerExists).toHaveBeenCalledWith(ID)
    expect(mocks.uploadBannerImage).toHaveBeenCalledWith(ID, PNG_BYTES, "image/png")
  })

  it("rejects with 400 BANNER_IMAGE_REQUIRED when no file is attached", async () => {
    const res = await request(app).post(`/site/banners/${ID}/image`)

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ success: false, code: "BANNER_IMAGE_REQUIRED" })
    expect(mocks.uploadBannerImage).not.toHaveBeenCalled()
  })

  it("rejects disallowed MIME types with 400 INVALID_BANNER_IMAGE", async () => {
    const res = await request(app)
      .post(`/site/banners/${ID}/image`)
      .attach("image", Buffer.from("not an image"), {
        filename: "banner.txt",
        contentType: "text/plain",
      })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ success: false, code: "INVALID_BANNER_IMAGE" })
    expect(mocks.uploadBannerImage).not.toHaveBeenCalled()
  })

  it("rejects files larger than 5MB with a size-specific message", async () => {
    const res = await request(app)
      .post(`/site/banners/${ID}/image`)
      .attach("image", Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: "big.png",
        contentType: "image/png",
      })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ success: false, code: "INVALID_BANNER_IMAGE" })
    expect(res.body.error).toBe("Banner image must be 5MB or smaller")
    expect(mocks.uploadBannerImage).not.toHaveBeenCalled()
  })

  it("does not upload when the banner does not exist (no orphaned R2 objects)", async () => {
    mocks.assertBannerExists.mockRejectedValueOnce(
      Object.assign(new Error("Banner not found"), {
        status: 404,
        code: "BANNER_NOT_FOUND",
      }),
    )

    const res = await request(app)
      .post(`/site/banners/${ID}/image`)
      .attach("image", PNG_BYTES, { filename: "banner.png", contentType: "image/png" })

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ success: false, code: "BANNER_NOT_FOUND" })
    expect(mocks.uploadBannerImage).not.toHaveBeenCalled()
  })

  it("propagates upload failures as-is", async () => {
    mocks.assertBannerExists.mockResolvedValue(undefined)
    mocks.uploadBannerImage.mockRejectedValueOnce(
      Object.assign(new Error("Failed to upload image"), {
        status: 500,
        code: "UPLOAD_FAILED",
      }),
    )

    const res = await request(app)
      .post(`/site/banners/${ID}/image`)
      .attach("image", PNG_BYTES, { filename: "banner.png", contentType: "image/png" })

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ success: false, code: "UPLOAD_FAILED" })
  })
})
