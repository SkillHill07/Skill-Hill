import { describe, it, expect, vi, beforeEach } from "vitest"
import { uploadImageToR2, ALLOWED_IMAGE_MIME_TYPES } from "./upload.js"
import { PutObjectCommand } from "@aws-sdk/client-s3"

/**
 * Hoisted mocks so the vi.mock factories below can reference them.
 * `config` is a mutable object — tests toggle R2_* fields to exercise the
 * config guard. `toBuffer` is shared by every sharp chain created.
 */
const mocks = vi.hoisted(() => {
  const toBuffer = vi.fn<() => Promise<Buffer>>(async () => Buffer.from("webp-image-bytes"))
  const sharpMock = vi.fn(() => ({
    resize: vi.fn(() => ({
      webp: vi.fn(() => ({ toBuffer })),
    })),
  }))
  const s3Send = vi.fn<(command: unknown) => Promise<void>>(async () => {})
  return { toBuffer, sharpMock, s3Send }
})

const configMock = vi.hoisted(() => ({
  config: {
    R2_ACCOUNT_ID: "test-account",
    R2_ACCESS_KEY_ID: "test-key",
    R2_SECRET_ACCESS_KEY: "test-secret",
    R2_PUBLIC_BUCKET: "test-bucket",
    R2_PUBLIC_URL: "https://pub-test.r2.dev",
  },
}))

vi.mock("../config/index.js", () => configMock)
vi.mock("./logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn() },
}))
vi.mock("sharp", () => ({ default: mocks.sharpMock }))
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = mocks.s3Send
  },
  PutObjectCommand: class {
    constructor(input: Record<string, unknown>) {
      Object.assign(this, input)
    }
  },
}))

const OPTIONS = {
  folder: "languages",
  identifier: "javascript",
  maxWidth: 256,
  maxHeight: 256,
  quality: 85,
}

// Any bytes work — sharp is mocked.
const JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])

describe("uploadImageToR2", () => {
  beforeEach(() => {
    // Full credentials by default; individual tests clear what they need.
    configMock.config.R2_ACCOUNT_ID = "test-account"
    configMock.config.R2_ACCESS_KEY_ID = "test-key"
    configMock.config.R2_SECRET_ACCESS_KEY = "test-secret"
    configMock.config.R2_PUBLIC_BUCKET = "test-bucket"
    configMock.config.R2_PUBLIC_URL = "https://pub-test.r2.dev"

    mocks.sharpMock.mockClear()
    // mockClear (not mockReset) keeps the default `async () => {}` implementation.
    mocks.s3Send.mockClear()
    mocks.toBuffer.mockReset()
    mocks.toBuffer.mockResolvedValue(Buffer.from("webp-image-bytes"))
  })

  describe("config guard", () => {
    it("rejects with 503 UPLOAD_NOT_CONFIGURED when no R2 credentials are set", async () => {
      configMock.config.R2_ACCOUNT_ID = ""
      configMock.config.R2_ACCESS_KEY_ID = ""
      configMock.config.R2_SECRET_ACCESS_KEY = ""
      configMock.config.R2_PUBLIC_BUCKET = ""

      await expect(uploadImageToR2(JPEG_BUFFER, "image/jpeg", OPTIONS)).rejects.toMatchObject({
        status: 503,
        code: "UPLOAD_NOT_CONFIGURED",
      })
      // Guard runs before any processing or upload.
      expect(mocks.sharpMock).not.toHaveBeenCalled()
      expect(mocks.s3Send).not.toHaveBeenCalled()
    })

    it("rejects when any single required value is missing (e.g. only the bucket)", async () => {
      configMock.config.R2_PUBLIC_BUCKET = ""

      await expect(uploadImageToR2(JPEG_BUFFER, "image/jpeg", OPTIONS)).rejects.toMatchObject({
        status: 503,
        code: "UPLOAD_NOT_CONFIGURED",
      })
    })

    it("does not treat the public URL as part of the guard", async () => {
      // R2_PUBLIC_URL has a default fallback, so it must not trip the guard.
      // With it cleared, uploads still proceed (URL just lacks the host prefix).
      configMock.config.R2_PUBLIC_URL = ""

      await expect(uploadImageToR2(JPEG_BUFFER, "image/jpeg", OPTIONS)).resolves.toMatch(
        /^\/languages\/javascript\/[a-f0-9]{16}\.webp$/,
      )
      expect(mocks.s3Send).toHaveBeenCalledTimes(1)
    })
  })

  describe("MIME validation", () => {
    it.each(["text/plain", "application/octet-stream", "image/gif", "image/svg+xml", ""])(
      "rejects disallowed MIME type %j with 400 INVALID_IMAGE_TYPE",
      async (mime) => {
        await expect(
          uploadImageToR2(JPEG_BUFFER, mime, OPTIONS),
        ).rejects.toMatchObject({
          status: 400,
          code: "INVALID_IMAGE_TYPE",
        })
        expect(mocks.sharpMock).not.toHaveBeenCalled()
        expect(mocks.s3Send).not.toHaveBeenCalled()
      },
    )

    it.each(ALLOWED_IMAGE_MIME_TYPES)(
      "accepts %s and proceeds to process + upload",
      async (mime) => {
        const url = await uploadImageToR2(JPEG_BUFFER, mime, OPTIONS)

        expect(url).toMatch(
          /^https:\/\/pub-test\.r2\.dev\/languages\/javascript\/[a-f0-9]{16}\.webp$/,
        )
        expect(mocks.sharpMock).toHaveBeenCalledWith(JPEG_BUFFER)
        expect(mocks.s3Send).toHaveBeenCalledTimes(1)
      },
    )
  })

  describe("image processing (sharp)", () => {
    it("resizes to the given dimensions and encodes WebP at the given quality", async () => {
      await uploadImageToR2(JPEG_BUFFER, "image/png", OPTIONS)

      const chain = mocks.sharpMock.mock.results[0].value
      expect(chain.resize).toHaveBeenCalledWith(256, 256, {
        fit: "cover",
        withoutEnlargement: true,
      })
      const webpChain = chain.resize.mock.results[0].value
      expect(webpChain.webp).toHaveBeenCalledWith({ quality: 85 })
    })

    it("defaults WebP quality to 80 when not provided", async () => {
      await uploadImageToR2(JPEG_BUFFER, "image/png", {
        folder: "avatars",
        identifier: "user-1",
        maxWidth: 400,
        maxHeight: 400,
      })

      const chain = mocks.sharpMock.mock.results[0].value
      const webpChain = chain.resize.mock.results[0].value
      expect(webpChain.webp).toHaveBeenCalledWith({ quality: 80 })
    })

    it("rejects with 400 IMAGE_PROCESSING_FAILED when sharp throws", async () => {
      mocks.toBuffer.mockRejectedValueOnce(new Error("corrupt image"))

      await expect(uploadImageToR2(JPEG_BUFFER, "image/jpeg", OPTIONS)).rejects.toMatchObject({
        status: 400,
        code: "IMAGE_PROCESSING_FAILED",
      })
      expect(mocks.s3Send).not.toHaveBeenCalled()
    })
  })

  describe("R2 upload", () => {
    it("rejects with 500 UPLOAD_FAILED when the S3 send fails", async () => {
      mocks.s3Send.mockRejectedValueOnce(new Error("network down"))

      await expect(uploadImageToR2(JPEG_BUFFER, "image/jpeg", OPTIONS)).rejects.toMatchObject({
        status: 500,
        code: "UPLOAD_FAILED",
      })
    })

    it("uploads the processed WebP under {folder}/{identifier}/{hash}.webp", async () => {
      const url = await uploadImageToR2(JPEG_BUFFER, "image/jpeg", OPTIONS)

      interface PutCommand {
        Bucket: string
        Key: string
        ContentType: string
        CacheControl: string
        Body: Buffer
      }
      const command = mocks.s3Send.mock.calls[0]?.[0] as PutCommand | undefined
      expect(command).toBeInstanceOf(PutObjectCommand)
      expect(command?.Bucket).toBe("test-bucket")
      expect(command?.Key).toMatch(/^languages\/javascript\/[a-f0-9]{16}\.webp$/)
      expect(command?.ContentType).toBe("image/webp")
      expect(command?.CacheControl).toBe("public, max-age=31536000, immutable")
      expect(command?.Body).toEqual(Buffer.from("webp-image-bytes"))

      // The returned public URL is derived from the uploaded key.
      expect(url).toBe(`https://pub-test.r2.dev/${command?.Key}`)
    })
  })
})
