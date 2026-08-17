import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { type Request, type Response, type NextFunction } from "express"
import { problemRouter } from "./problem.routes.js"
import { errorHandler } from "../../middlewares/error-handler.js"

/**
 * Route unit tests for the problem statement-image endpoints:
 * POST /contests/:contestId/problems/:problemId/images (multipart "image")
 * DELETE /contests/:contestId/problems/:problemId/images/:index
 *
 * Auth is stubbed as a pass-through (admin). Multer is NOT mocked — real
 * multipart bodies run through the real fileFilter (MIME) and size limits.
 */
const mocks = vi.hoisted(() => ({
  assertProblemEditable: vi.fn(),
  addProblemImage: vi.fn(),
  removeProblemImage: vi.fn(),
  uploadImageToR2: vi.fn(),
}))

vi.mock("./problem.service.js", () => ({
  problemService: {
    listProblems: vi.fn(),
    getProblem: vi.fn(),
    createProblem: vi.fn(),
    updateProblem: vi.fn(),
    deleteProblem: vi.fn(),
    assertProblemEditable: mocks.assertProblemEditable,
    addProblemImage: mocks.addProblemImage,
    removeProblemImage: mocks.removeProblemImage,
    addTestCase: vi.fn(),
    removeTestCase: vi.fn(),
    getTestCases: vi.fn(),
  },
}))
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
app.use(problemRouter)
app.use(errorHandler)

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const IMAGE_URL = "https://pub-test.r2.dev/problems/p1/0123456789abcdef.webp"

const problemDoc = {
  _id: "p1",
  contestId: "c1",
  title: "Sum of Two Numbers",
  description: "Add two numbers",
  imageUrls: [IMAGE_URL],
  type: "coding",
  difficulty: "easy",
  points: 100,
  status: "draft",
}

describe("POST /contests/:contestId/problems/:problemId/images", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uploads the image and appends its URL to imageUrls", async () => {
    mocks.assertProblemEditable.mockResolvedValue(undefined)
    mocks.uploadImageToR2.mockResolvedValue(IMAGE_URL)
    mocks.addProblemImage.mockResolvedValue(problemDoc)

    const res = await request(app)
      .post("/c1/problems/p1/images")
      .attach("image", PNG_BYTES, { filename: "diagram.png", contentType: "image/png" })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.imageUrls).toContain(IMAGE_URL)

    // The problem must be editable BEFORE upload (no orphaned R2 objects).
    expect(mocks.assertProblemEditable).toHaveBeenCalledWith("c1", "p1")
    const [buffer, mime, opts] = mocks.uploadImageToR2.mock.calls[0]
    expect(buffer).toEqual(PNG_BYTES)
    expect(mime).toBe("image/png")
    expect(opts).toMatchObject({
      folder: "problems",
      identifier: "p1",
      maxWidth: 1280,
      maxHeight: 1024,
      quality: 82,
    })
    expect(mocks.addProblemImage).toHaveBeenCalledWith("c1", "p1", IMAGE_URL)
  })

  it("rejects with 400 IMAGE_REQUIRED when no file is attached", async () => {
    const res = await request(app).post("/c1/problems/p1/images")

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ success: false, code: "IMAGE_REQUIRED" })
    expect(mocks.uploadImageToR2).not.toHaveBeenCalled()
  })

  it("rejects disallowed MIME types with 400 INVALID_PROBLEM_IMAGE", async () => {
    const res = await request(app)
      .post("/c1/problems/p1/images")
      .attach("image", Buffer.from("not an image"), {
        filename: "diagram.txt",
        contentType: "text/plain",
      })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ success: false, code: "INVALID_PROBLEM_IMAGE" })
    expect(res.body.error).toContain("Only JPEG, PNG, and WebP images are allowed")
    expect(mocks.uploadImageToR2).not.toHaveBeenCalled()
  })

  it("rejects files larger than 5MB with a size-specific message", async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1)

    const res = await request(app)
      .post("/c1/problems/p1/images")
      .attach("image", oversized, { filename: "big.png", contentType: "image/png" })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ success: false, code: "INVALID_PROBLEM_IMAGE" })
    expect(res.body.error).toBe("Problem image must be 5MB or smaller")
    expect(mocks.uploadImageToR2).not.toHaveBeenCalled()
  })

  it("does not upload when the problem is missing or the contest is not a draft", async () => {
    mocks.assertProblemEditable.mockRejectedValueOnce(
      Object.assign(new Error("Problem not found in this contest"), {
        status: 404,
        code: "PROBLEM_NOT_FOUND",
      }),
    )

    const res = await request(app)
      .post("/c1/problems/p1/images")
      .attach("image", PNG_BYTES, { filename: "diagram.png", contentType: "image/png" })

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ success: false, code: "PROBLEM_NOT_FOUND" })
    expect(mocks.uploadImageToR2).not.toHaveBeenCalled()
    expect(mocks.addProblemImage).not.toHaveBeenCalled()
  })

  it("propagates upload failures as-is", async () => {
    mocks.assertProblemEditable.mockResolvedValue(undefined)
    mocks.uploadImageToR2.mockRejectedValueOnce(
      Object.assign(new Error("Failed to upload image"), {
        status: 500,
        code: "UPLOAD_FAILED",
      }),
    )

    const res = await request(app)
      .post("/c1/problems/p1/images")
      .attach("image", PNG_BYTES, { filename: "diagram.png", contentType: "image/png" })

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ success: false, code: "UPLOAD_FAILED" })
    expect(mocks.addProblemImage).not.toHaveBeenCalled()
  })
})

describe("DELETE /contests/:contestId/problems/:problemId/images/:index", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("removes the image at the given index", async () => {
    mocks.removeProblemImage.mockResolvedValue({ ...problemDoc, imageUrls: [] })

    const res = await request(app).delete("/c1/problems/p1/images/0")

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.imageUrls).toEqual([])
    expect(mocks.removeProblemImage).toHaveBeenCalledWith("c1", "p1", 0)
  })

  it("rejects an out-of-range index", async () => {
    mocks.removeProblemImage.mockRejectedValueOnce(
      Object.assign(new Error("Image index is out of range"), {
        status: 400,
        code: "INVALID_IMAGE_INDEX",
      }),
    )

    const res = await request(app).delete("/c1/problems/p1/images/9")

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ success: false, code: "INVALID_IMAGE_INDEX" })
  })

  it("rejects a non-numeric index at the validation boundary", async () => {
    const res = await request(app).delete("/c1/problems/p1/images/abc")

    expect(res.status).toBe(400)
    expect(mocks.removeProblemImage).not.toHaveBeenCalled()
  })
})
