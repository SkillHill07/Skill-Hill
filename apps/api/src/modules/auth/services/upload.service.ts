import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import sharp from "sharp"
import crypto from "crypto"
import { config } from "../../../config/index.js"
import { logger } from "../../../utils/logger.js"

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

const MAX_AVATAR_WIDTH = 400
const MAX_AVATAR_HEIGHT = 400
const AVATAR_QUALITY = 80
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]

/**
 * Upload an avatar image to Cloudflare R2.
 * Compresses the image using Sharp before uploading.
 * Returns the public URL of the uploaded image.
 */
export async function uploadAvatar(
  fileBuffer: Buffer,
  mimeType: string,
  userId: string,
): Promise<string> {
  if (!config.R2_ACCOUNT_ID || !config.R2_ACCESS_KEY_ID || !config.R2_SECRET_ACCESS_KEY) {
    throw Object.assign(
      new Error("Image upload is not configured. Set R2 credentials."),
      { status: 503, code: "UPLOAD_NOT_CONFIGURED" },
    )
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw Object.assign(
      new Error("Only JPEG, PNG, and WebP images are allowed"),
      { status: 400, code: "INVALID_IMAGE_TYPE" },
    )
  }

  // Compress and resize with Sharp
  let processed: Buffer
  try {
    processed = await sharp(fileBuffer)
      .resize(MAX_AVATAR_WIDTH, MAX_AVATAR_HEIGHT, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: AVATAR_QUALITY })
      .toBuffer()
  } catch {
    throw Object.assign(
      new Error("Failed to process image"),
      { status: 400, code: "IMAGE_PROCESSING_FAILED" },
    )
  }

  // Generate unique filename
  const hash = crypto.createHash("sha256").update(userId + Date.now().toString()).digest("hex").slice(0, 16)
  const key = `avatars/${userId}/${hash}.webp`

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
    logger.error({ userId, error: (err as Error).message }, "avatar_upload_failed")
    throw Object.assign(
      new Error("Failed to upload avatar"),
      { status: 500, code: "UPLOAD_FAILED" },
    )
  }

  const publicUrl = `${config.R2_PUBLIC_URL}/${key}`
  logger.info({ userId, key }, "avatar_uploaded")
  // ponytail: single-region upload, add CDN invalidation if cache-busting needed
  return publicUrl
}
