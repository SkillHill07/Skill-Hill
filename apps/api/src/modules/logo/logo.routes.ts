import { Router } from "express"
import { logoService } from "./logo.service.js"
import {
  authenticate,
  requireRole,
} from "../auth/middleware/auth.middleware.js"
import { validateRequest } from "../../middlewares/validate-request.js"
import { sendSuccess } from "../../utils/response.js"
import {
  createImageUploadMiddleware,
  createImageUploadErrorHandler,
} from "../../utils/upload-middleware.js"
import { updateLogoSchema } from "./logo.validation.js"
import type { Request, Response, NextFunction } from "express"

export const logoRouter: Router = Router()

const uploadLogoMiddleware = createImageUploadMiddleware("image")
const handleLogoUploadErrors = createImageUploadErrorHandler(uploadLogoMiddleware, {
  fieldLabel: "Logo image",
  code: "INVALID_LOGO_IMAGE",
})

/**
 * @openapi
 * /site/logo:
 *   get:
 *     tags: [Site Content]
 *     summary: Get the site logo (singleton — auto-created on first call)
 *     responses:
 *       200:
 *         description: Logo document (logoUrl may be null until an image is uploaded)
 */
logoRouter.get("/site/logo", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const logo = await logoService.getLogo()
    sendSuccess(res, logo)
  } catch (err) {
    next(err)
  }
})

/**
 * @openapi
 * /site/logo:
 *   put:
 *     tags: [Site Content]
 *     summary: Update the site logo fields (altText, tagline, or logoUrl) — admin/creator
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               logoUrl: { type: string, nullable: true, description: "R2 URL — set via the upload endpoint instead" }
 *               altText: { type: string }
 *               tagline: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Updated logo
 */
logoRouter.put(
  "/site/logo",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(updateLogoSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const logo = await logoService.updateLogo(req.body)
      sendSuccess(res, logo, "Site logo updated")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /site/logo/upload:
 *   post:
 *     tags: [Site Content]
 *     summary: Upload the site logo image (multipart, Cloudflare R2) — admin/creator
 *     description: >
 *       Accepts multipart/form-data with an "image" file (JPEG, PNG, or WebP, max 5MB).
 *       Compressed to WebP (512x512) and stored in R2; the returned logoUrl is persisted.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Logo uploaded
 *       400:
 *         description: Invalid image or no file provided
 */
logoRouter.post(
  "/site/logo/upload",
  authenticate,
  requireRole("admin", "creator"),
  handleLogoUploadErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw Object.assign(new Error("A logo image is required (field: image)"), {
          status: 400,
          code: "LOGO_IMAGE_REQUIRED",
        })
      }
      const logo = await logoService.uploadLogo(req.file.buffer, req.file.mimetype)
      sendSuccess(res, logo, "Site logo uploaded")
    } catch (err) {
      next(err)
    }
  },
)
