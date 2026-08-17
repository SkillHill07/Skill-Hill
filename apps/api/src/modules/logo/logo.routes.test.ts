import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { type Request, type Response, type NextFunction } from "express"
import { logoRouter } from "./logo.routes.js"
import { errorHandler } from "../../middlewares/error-handler.js"

/**
 * Route unit tests for the site logo singleton:
 * GET /site/logo, PUT /site/logo, POST /site/logo/upload (multipart "image").
 * Auth is stubbed as a pass-through (admin). Multer runs for real (MIME
 * filter + 5MB size limit). uploadLogo (R2) is mocked at the service layer.
 */
const mocks = vi.hoisted(() => ({
  getLogo: vi.fn(),
  updateLogo: vi.fn(),
  uploadLogo: vi.fn(),
  currentUser: {
    userId: "admin-1",
    email: "admin@test.com",
    role: "admin",
  } as { userId: string; email: string; role: "admin" } | null,
}))

vi.mock("./logo.service.js", () => ({
  logoService: {
    getLogo: mocks.getLogo,
    updateLogo: mocks.updateLogo,
    uploadLogo: mocks.uploadLogo,
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
app.use(logoRouter)
app.use(errorHandler)

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const LOGO_URL = "https://pub-test.r2.dev/site/logo/0123456789abcdef.webp"

const logoDoc = {
  _id: "64b7f9c5e5b9c1a2b3c4d5e0",
  key: "primary",
  logoUrl: LOGO_URL,
  altText: "SkillHill",
  tagline: null,
}

describe("GET /site/logo", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns the singleton logo", async () => {
    mocks.getLogo.mockResolvedValue(logoDoc)

    const res = await request(app).get("/site/logo")

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.logoUrl).toBe(LOGO_URL)
    expect(mocks.getLogo).toHaveBeenCalledTimes(1)
  })
})

describe("PUT /site/logo", () => {
  beforeEach(() => vi.clearAllMocks())

  it("updates logo fields via upsert", async () => {
    mocks.updateLogo.mockResolvedValue({ ...logoDoc, tagline: "Win big" })

    const res = await request(app)
      .put("/site/logo")
      .send({ altText: "SkillHill", tagline: "Win big" })

    expect(res.status).toBe(200)
    expect(mocks.updateLogo).toHaveBeenCalledWith({
      altText: "SkillHill",
      tagline: "Win big",
    })
    expect(res.body.data.tagline).toBe("Win big")
  })

  it("rejects an invalid logoUrl at the validation boundary", async () => {
    const res = await request(app).put("/site/logo").send({ logoUrl: "not-a-url" })

    expect(res.status).toBe(400)
    expect(mocks.updateLogo).not.toHaveBeenCalled()
  })
})

describe("POST /site/logo/upload", () => {
  beforeEach(() => vi.clearAllMocks())

  it("uploads the logo and persists the returned URL", async () => {
    mocks.uploadLogo.mockResolvedValue(logoDoc)

    const res = await request(app)
      .post("/site/logo/upload")
      .attach("image", PNG_BYTES, { filename: "logo.png", contentType: "image/png" })

    expect(res.status).toBe(200)
    expect(res.body.data.logoUrl).toBe(LOGO_URL)
    const [buffer, mime] = mocks.uploadLogo.mock.calls[0]
    expect(buffer).toEqual(PNG_BYTES)
    expect(mime).toBe("image/png")
  })

  it("rejects with 400 LOGO_IMAGE_REQUIRED when no file is attached", async () => {
    const res = await request(app).post("/site/logo/upload")

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ success: false, code: "LOGO_IMAGE_REQUIRED" })
    expect(mocks.uploadLogo).not.toHaveBeenCalled()
  })

  it("rejects disallowed MIME types with 400 INVALID_LOGO_IMAGE", async () => {
    const res = await request(app)
      .post("/site/logo/upload")
      .attach("image", Buffer.from("not an image"), {
        filename: "logo.txt",
        contentType: "text/plain",
      })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ success: false, code: "INVALID_LOGO_IMAGE" })
    expect(mocks.uploadLogo).not.toHaveBeenCalled()
  })

  it("rejects files larger than 5MB with a size-specific message", async () => {
    const res = await request(app)
      .post("/site/logo/upload")
      .attach("image", Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: "big.png",
        contentType: "image/png",
      })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ success: false, code: "INVALID_LOGO_IMAGE" })
    expect(res.body.error).toBe("Logo image must be 5MB or smaller")
    expect(mocks.uploadLogo).not.toHaveBeenCalled()
  })

  it("propagates upload failures as-is", async () => {
    mocks.uploadLogo.mockRejectedValueOnce(
      Object.assign(new Error("Failed to upload image"), {
        status: 500,
        code: "UPLOAD_FAILED",
      }),
    )

    const res = await request(app)
      .post("/site/logo/upload")
      .attach("image", PNG_BYTES, { filename: "logo.png", contentType: "image/png" })

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ success: false, code: "UPLOAD_FAILED" })
  })
})
