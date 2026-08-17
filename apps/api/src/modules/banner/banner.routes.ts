import { Router } from "express"
import { bannerService } from "./banner.service.js"
import {
  authenticate,
  optionalAuth,
  requireRole,
} from "../auth/middleware/auth.middleware.js"
import { validateRequest } from "../../middlewares/validate-request.js"
import { sendError, sendSuccess } from "../../utils/response.js"
import {
  createImageUploadMiddleware,
  createImageUploadErrorHandler,
} from "../../utils/upload-middleware.js"
import {
  createBannerSchema,
  updateBannerSchema,
  deleteBannerSchema,
  uploadBannerImageSchema,
} from "./banner.validation.js"
import type { Request, Response, NextFunction } from "express"

export const bannerRouter: Router = Router()

const uploadBannerImageMiddleware = createImageUploadMiddleware("image")
const handleBannerImageErrors = createImageUploadErrorHandler(uploadBannerImageMiddleware, {
  fieldLabel: "Banner image",
  code: "INVALID_BANNER_IMAGE",
})

/**
 * @openapi
 * /site/banners:
 *   get:
 *     tags: [Site Content]
 *     summary: List banners (public — active items only, ordered)
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema: { type: boolean }
 *         description: Staff only — include inactive banners
 *     responses:
 *       200:
 *         description: Ordered list of banners
 */
bannerRouter.get(
  "/site/banners",
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const includeInactive = req.query.includeInactive === "true"
      const isStaff = req.user?.role === "admin" || req.user?.role === "creator"
      if (includeInactive && !isStaff) {
        sendError(res, "You do not have permission to view inactive banners", 403)
        return
      }
      const banners = await bannerService.listBanners(includeInactive)
      sendSuccess(res, banners)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /site/banners:
 *   post:
 *     tags: [Site Content]
 *     summary: Create a banner — admin/creator
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               subtitle: { type: string, nullable: true }
 *               imageUrl: { type: string, nullable: true, description: "Set via the image upload endpoint" }
 *               ctaText: { type: string, nullable: true }
 *               ctaLink: { type: string, nullable: true, description: "absolute URL" }
 *               order: { type: integer }
 *               active: { type: boolean }
 *     responses:
 *       201:
 *         description: Banner created
 */
bannerRouter.post(
  "/site/banners",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(createBannerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const banner = await bannerService.createBanner(req.body)
      sendSuccess(res, banner, "Banner created", 201)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /site/banners/{id}:
 *   patch:
 *     tags: [Site Content]
 *     summary: Update a banner — admin/creator
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated banner
 */
bannerRouter.patch(
  "/site/banners/:id",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(updateBannerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const banner = await bannerService.updateBanner(req.params.id as string, req.body)
      sendSuccess(res, banner, "Banner updated")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /site/banners/{id}:
 *   delete:
 *     tags: [Site Content]
 *     summary: Delete a banner — admin/creator
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Banner deleted
 */
bannerRouter.delete(
  "/site/banners/:id",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(deleteBannerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await bannerService.deleteBanner(req.params.id as string)
      sendSuccess(res, null, "Banner deleted")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /site/banners/{id}/image:
 *   post:
 *     tags: [Site Content]
 *     summary: Upload a banner image (multipart, Cloudflare R2) — admin/creator
 *     description: >
 *       Accepts multipart/form-data with an "image" file (JPEG, PNG, or WebP, max 5MB).
 *       Compressed to WebP (max 1920x720) and stored in R2; the returned URL is persisted.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
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
 *         description: Image uploaded
 *       404:
 *         description: Banner not found
 */
bannerRouter.post(
  "/site/banners/:id/image",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(uploadBannerImageSchema),
  handleBannerImageErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw Object.assign(new Error("A banner image is required (field: image)"), {
          status: 400,
          code: "BANNER_IMAGE_REQUIRED",
        })
      }
      // Verify the banner exists BEFORE uploading, so an unknown banner can't
      // orphan an R2 object.
      await bannerService.assertBannerExists(req.params.id as string)
      const banner = await bannerService.uploadBannerImage(
        req.params.id as string,
        req.file.buffer,
        req.file.mimetype,
      )
      sendSuccess(res, banner, "Banner image uploaded")
    } catch (err) {
      next(err)
    }
  },
)
