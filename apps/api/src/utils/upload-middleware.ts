import multer, { type Multer } from "multer"
import type { Request, Response, NextFunction } from "express"
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_FILE_SIZE } from "./upload.js"

/**
 * Factory for a multer middleware that accepts a single image file for the
 * given field name. Validates MIME type and size, stores in memory (buffer)
 * for Sharp processing. Used for avatar, language-logo, and problem-image
 * uploads.
 */
export function createImageUploadMiddleware(
  fieldName: string,
): ReturnType<Multer["single"]> {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_FILE_SIZE },
    fileFilter(_req, file, cb) {
      if (ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(new Error("Only JPEG, PNG, and WebP images are allowed"))
      }
    },
  }).single(fieldName)
}

/**
 * Wraps a single-file image upload middleware so multer errors (wrong type /
 * too large) become a 400 JSON error the centralized handler understands.
 */
export function createImageUploadErrorHandler(
  middleware: ReturnType<Multer["single"]>,
  options: { fieldLabel: string; code: string },
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    middleware(req, res, (err?: unknown) => {
      if (!err) {
        next()
        return
      }
      const multerErr = err as Error & { code?: string }
      const message =
        multerErr.code === "LIMIT_FILE_SIZE"
          ? `${options.fieldLabel} must be 5MB or smaller`
          : multerErr.message || `Invalid ${options.fieldLabel.toLowerCase()}`
      next(Object.assign(new Error(message), { status: 400, code: options.code }))
    })
  }
}
