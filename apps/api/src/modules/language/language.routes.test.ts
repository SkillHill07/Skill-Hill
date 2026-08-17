import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { type Request, type Response, type NextFunction } from "express"
import { languageRouter } from "./language.routes.js"
import { errorHandler } from "../../middlewares/error-handler.js"

/**
 * Route unit tests for POST /languages/:key/logo.
 *
 * Auth middleware is stubbed as a pass-through (sets req.user as admin) so the
 * test focuses on the route logic: multer handling, the pre-upload language
 * existence check, the R2 upload call, and persisting the returned URL.
 * Multer itself is NOT mocked — supertest posts real multipart bodies through
 * the real fileFilter (MIME) and size limits.
 */
const mocks = vi.hoisted(() => ({
  languageService: {
    getLanguageByKey: vi.fn(),
    updateLanguage: vi.fn(),
  },
  uploadImageToR2: vi.fn(),
}))

vi.mock("./language.service.js", () => ({ languageService: mocks.languageService }))
vi.mock("../../utils/upload.js", async () => {
  // Keep the real constants — the multer fileFilter/size limit uses them.
  const actual =
    await vi.importActual<typeof import("../../utils/upload.js")>("../../utils/upload.js")
  return { ...actual, uploadImageToR2: mocks.uploadImageToR2 }
})
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
app.use(languageRouter)
app.use(errorHandler)

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const LOGO_URL = "https://pub-test.r2.dev/languages/javascript/0123456789abcdef.webp"

const languageDoc = {
  _id: "64f0c9d1e8a2b3c4d5e6f700",
  key: "javascript",
  name: "JavaScript",
  version: "20-alpine",
  extension: "js",
  compileCommand: null,
  runCommand: "node {file}.js",
  dockerImage: "node:20-alpine",
  logoUrl: null,
  enabled: true,
  order: 1,
}

describe("POST /languages/:key/logo", () => {
  beforeEach(() => {
    vi.mocked(mocks.languageService.getLanguageByKey).mockReset()
    vi.mocked(mocks.languageService.updateLanguage).mockReset()
    vi.mocked(mocks.uploadImageToR2).mockReset()
  })

  it("rejects with 400 LOGO_REQUIRED when no file is attached", async () => {
    const res = await request(app).post("/javascript/logo")

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ success: false, code: "LOGO_REQUIRED" })
    expect(mocks.uploadImageToR2).not.toHaveBeenCalled()
    expect(mocks.languageService.updateLanguage).not.toHaveBeenCalled()
  })

  it("rejects disallowed MIME types with 400 INVALID_LOGO (multer fileFilter)", async () => {
    const res = await request(app)
      .post("/javascript/logo")
      .attach("logo", Buffer.from("not an image"), {
        filename: "logo.txt",
        contentType: "text/plain",
      })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ success: false, code: "INVALID_LOGO" })
    expect(res.body.error).toContain("Only JPEG, PNG, and WebP images are allowed")
    expect(mocks.uploadImageToR2).not.toHaveBeenCalled()
  })

  it("rejects files larger than 5MB with a size-specific message", async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1)

    const res = await request(app)
      .post("/javascript/logo")
      .attach("logo", oversized, { filename: "big.png", contentType: "image/png" })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ success: false, code: "INVALID_LOGO" })
    expect(res.body.error).toBe("Logo image must be 5MB or smaller")
    expect(mocks.uploadImageToR2).not.toHaveBeenCalled()
  })

  it("checks the language exists BEFORE uploading — no orphaned R2 object on unknown keys", async () => {
    vi.mocked(mocks.languageService.getLanguageByKey).mockRejectedValueOnce(
      Object.assign(new Error("Language not found"), {
        status: 404,
        code: "LANGUAGE_NOT_FOUND",
      }),
    )

    const res = await request(app)
      .post("/unknown-key/logo")
      .attach("logo", PNG_BYTES, { filename: "logo.png", contentType: "image/png" })

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ success: false, code: "LANGUAGE_NOT_FOUND" })
    expect(mocks.uploadImageToR2).not.toHaveBeenCalled()
    expect(mocks.languageService.updateLanguage).not.toHaveBeenCalled()
  })

  it("propagates upload failures as-is (500 UPLOAD_FAILED)", async () => {
    vi.mocked(mocks.languageService.getLanguageByKey).mockResolvedValue(languageDoc)
    vi.mocked(mocks.uploadImageToR2).mockRejectedValueOnce(
      Object.assign(new Error("Failed to upload image"), {
        status: 500,
        code: "UPLOAD_FAILED",
      }),
    )

    const res = await request(app)
      .post("/javascript/logo")
      .attach("logo", PNG_BYTES, { filename: "logo.png", contentType: "image/png" })

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ success: false, code: "UPLOAD_FAILED" })
    expect(mocks.languageService.updateLanguage).not.toHaveBeenCalled()
  })

  it("uploads the logo and persists the returned logoUrl on the language", async () => {
    vi.mocked(mocks.languageService.getLanguageByKey).mockResolvedValue(languageDoc)
    vi.mocked(mocks.uploadImageToR2).mockResolvedValue(LOGO_URL)
    vi.mocked(mocks.languageService.updateLanguage).mockResolvedValue({
      ...languageDoc,
      logoUrl: LOGO_URL,
    })

    const res = await request(app)
      .post("/javascript/logo")
      .attach("logo", PNG_BYTES, { filename: "logo.png", contentType: "image/png" })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.logoUrl).toBe(LOGO_URL)

    // The language is resolved (with the authenticated viewer) before upload.
    expect(mocks.languageService.getLanguageByKey).toHaveBeenCalledWith("javascript", {
      userId: "admin-1",
      email: "admin@test.com",
      role: "admin",
    })

    // Upload receives the raw file buffer + mimetype + language-scoped options.
    expect(mocks.uploadImageToR2).toHaveBeenCalledTimes(1)
    const [buffer, mime, opts] = vi.mocked(mocks.uploadImageToR2).mock.calls[0]
    expect(buffer).toEqual(PNG_BYTES)
    expect(mime).toBe("image/png")
    expect(opts).toMatchObject({
      folder: "languages",
      identifier: "javascript",
      maxWidth: 256,
      maxHeight: 256,
      quality: 85,
    })

    expect(mocks.languageService.updateLanguage).toHaveBeenCalledWith("javascript", {
      logoUrl: LOGO_URL,
    })
  })
})
