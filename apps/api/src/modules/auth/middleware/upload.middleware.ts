import multer, { type Multer } from "multer"

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

/**
 * Multer middleware that accepts a single file upload for the "avatar" field.
 * Validates file type and size. Stores file in memory (buffer) for Sharp processing.
 */
export const uploadAvatarMiddleware: ReturnType<Multer["single"]> = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"))
    }
  },
}).single("avatar")
