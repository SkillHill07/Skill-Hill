import { type Multer } from "multer"
import { createImageUploadMiddleware } from "../../../utils/upload-middleware.js"

/**
 * Multer middleware that accepts a single file upload for the "avatar" field.
 * Validates file type and size. Stores file in memory (buffer) for Sharp processing.
 */
export const uploadAvatarMiddleware: ReturnType<Multer["single"]> =
  createImageUploadMiddleware("avatar")
