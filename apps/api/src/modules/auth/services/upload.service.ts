import { uploadImageToR2 } from "../../../utils/upload.js"

const MAX_AVATAR_WIDTH = 400
const MAX_AVATAR_HEIGHT = 400
const AVATAR_QUALITY = 80

/**
 * Upload an avatar image to Cloudflare R2.
 * Compresses the image (Sharp → WebP 400x400) via the shared upload util.
 * Returns the public URL of the uploaded image.
 */
export async function uploadAvatar(
  fileBuffer: Buffer,
  mimeType: string,
  userId: string,
): Promise<string> {
  return uploadImageToR2(fileBuffer, mimeType, {
    folder: "avatars",
    identifier: userId,
    maxWidth: MAX_AVATAR_WIDTH,
    maxHeight: MAX_AVATAR_HEIGHT,
    quality: AVATAR_QUALITY,
  })
}
