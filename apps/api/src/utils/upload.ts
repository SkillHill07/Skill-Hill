import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import sharp from "sharp"
import crypto from "crypto"
import { config } from "../config/index.js"
import { logger } from "./logger.js"

let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      },
    })
  }
  return s3Client
}

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]
export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

interface UploadImageOptions {
  /** R2 key prefix, e.g. "avatars" or "languages" */
  folder: string
  /** Identifier for the owning entity (userId, language key, ...) */
  identifier: string
  maxWidth: number
  maxHeight: number
  /** WebP quality (1-100), defaults to 80 */
  quality?: number
}

/**
 * Compress (Sharp → WebP) and upload an image to Cloudflare R2.
 * Returns the public URL of the uploaded image.
 */
export async function uploadImageToR2(
  fileBuffer: Buffer,
  mimeType: string,
  options: UploadImageOptions,
): Promise<string> {
  if (
    !config.R2_ACCOUNT_ID ||
    !config.R2_ACCESS_KEY_ID ||
    !config.R2_SECRET_ACCESS_KEY ||
    !config.R2_PUBLIC_BUCKET
  ) {
    throw Object.assign(
      new Error("Image upload is not configured. Set R2 credentials."),
      { status: 503, code: "UPLOAD_NOT_CONFIGURED" },
    )
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
    throw Object.assign(
      new Error("Only JPEG, PNG, and WebP images are allowed"),
      { status: 400, code: "INVALID_IMAGE_TYPE" },
    )
  }

  // Compress and resize with Sharp
  let processed: Buffer
  try {
    processed = await sharp(fileBuffer)
      .resize(options.maxWidth, options.maxHeight, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: options.quality ?? 80 })
      .toBuffer()
  } catch {
    throw Object.assign(
      new Error("Failed to process image"),
      { status: 400, code: "IMAGE_PROCESSING_FAILED" },
    )
  }

  // Generate unique filename
  const hash = crypto
    .createHash("sha256")
    .update(options.identifier + Date.now().toString())
    .digest("hex")
    .slice(0, 16)
  const key = `${options.folder}/${options.identifier}/${hash}.webp`

  // Upload to R2
  const s3 = getS3Client()
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: config.R2_PUBLIC_BUCKET,
        Key: key,
        Body: processed,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    )
  } catch (err) {
    logger.error(
      { identifier: options.identifier, error: (err as Error).message },
      "image_upload_failed",
    )
    throw Object.assign(
      new Error("Failed to upload image"),
      { status: 500, code: "UPLOAD_FAILED" },
    )
  }

  const publicUrl = `${config.R2_PUBLIC_URL}/${key}`
  logger.info({ identifier: options.identifier, key }, "image_uploaded")
  // ponytail: single-region upload, add CDN invalidation if cache-busting needed
  return publicUrl
}
