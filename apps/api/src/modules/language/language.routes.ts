import { Router } from "express"
import { languageService } from "./language.service.js"
import { authenticate, optionalAuth, requireRole } from "../auth/middleware/auth.middleware.js"
import { validateRequest } from "../../middlewares/validate-request.js"
import { sendSuccess } from "../../utils/response.js"
import { uploadImageToR2 } from "../../utils/upload.js"
import {
  createImageUploadMiddleware,
  createImageUploadErrorHandler,
} from "../../utils/upload-middleware.js"
import {
  createLanguageSchema,
  updateLanguageSchema,
  deleteLanguageSchema,
} from "./language.validation.js"
import type { Request, Response, NextFunction } from "express"

const uploadLogoMiddleware = createImageUploadMiddleware("logo")
const handleLogoErrors = createImageUploadErrorHandler(uploadLogoMiddleware, {
  fieldLabel: "Logo image",
  code: "INVALID_LOGO",
})

export const languageRouter: Router = Router()

/**
 * @openapi
 * /languages:
 *   get:
 *     tags: [Languages]
 *     summary: List supported languages (enabled only for public callers)
 *     parameters:
 *       - in: query
 *         name: includeDisabled
 *         schema:
 *           type: boolean
 *         description: Admin/creator only — include disabled languages
 *     responses:
 *       200:
 *         description: Language catalog
 */
languageRouter.get(
  "/",
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const includeDisabled = req.query.includeDisabled === "true"
      const isStaff = req.user?.role === "admin" || req.user?.role === "creator"
      if (includeDisabled && !isStaff) {
        throw Object.assign(new Error("Only staff can view disabled languages"), {
          status: 403,
          code: "FORBIDDEN",
        })
      }
      const languages = await languageService.listLanguages(includeDisabled && isStaff)
      sendSuccess(res, languages)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /languages/{key}:
 *   get:
 *     tags: [Languages]
 *     summary: Get a single language by key
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Language details
 *       404:
 *         description: Language not found
 */
languageRouter.get(
  "/:key",
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const language = await languageService.getLanguageByKey(
        req.params.key as string,
        req.user ?? null,
      )
      sendSuccess(res, language)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /languages:
 *   post:
 *     tags: [Languages]
 *     summary: Create a language — admin/creator
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, name, version, extension, runCommand, dockerImage]
 *             properties:
 *               key: { type: string, example: golang }
 *               name: { type: string }
 *               version: { type: string }
 *               extension: { type: string }
 *               compileCommand: { type: string, nullable: true }
 *               runCommand: { type: string }
 *               dockerImage: { type: string }
 *               enabled: { type: boolean }
 *               order: { type: integer }
 *     responses:
 *       201:
 *         description: Language created
 */
languageRouter.post(
  "/",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(createLanguageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const language = await languageService.createLanguage(req.body)
      sendSuccess(res, language, "Language created", 201)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /languages/{key}:
 *   patch:
 *     tags: [Languages]
 *     summary: Update a language — admin/creator
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               version: { type: string }
 *               extension: { type: string }
 *               compileCommand: { type: string, nullable: true }
 *               runCommand: { type: string }
 *               dockerImage: { type: string }
 *               enabled: { type: boolean }
 *               order: { type: integer }
 *     responses:
 *       200:
 *         description: Updated language
 */
languageRouter.patch(
  "/:key",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(updateLanguageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const language = await languageService.updateLanguage(
        req.params.key as string,
        req.body,
      )
      sendSuccess(res, language, "Language updated")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /languages/{key}:
 *   delete:
 *     tags: [Languages]
 *     summary: Delete a language — admin only (409 if referenced by problems)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Language deleted
 *       409:
 *         description: Language is in use by problems
 */
languageRouter.delete(
  "/:key",
  authenticate,
  requireRole("admin"),
  validateRequest(deleteLanguageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await languageService.deleteLanguage(req.params.key as string)
      sendSuccess(res, null, "Language deleted")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /languages/{key}/logo:
 *   post:
 *     tags: [Languages]
 *     summary: Upload a language logo — admin/creator
 *     description: >
 *       Accepts multipart/form-data with a "logo" file (JPEG, PNG, or WebP, max 5MB).
 *       The image is compressed to WebP (256x256) and uploaded to Cloudflare R2.
 *       Updates the language's `logoUrl`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [logo]
 *             properties:
 *               logo:
 *                 type: string
 *                 format: binary
 *                 description: Language logo (JPEG, PNG, or WebP, max 5MB)
 *     responses:
 *       200:
 *         description: Logo uploaded, language updated
 *       400:
 *         description: Invalid image or no file provided
 */
languageRouter.post(
  "/:key/logo",
  authenticate,
  requireRole("admin", "creator"),
  handleLogoErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw Object.assign(new Error("A logo image is required (field: logo)"), {
          status: 400,
          code: "LOGO_REQUIRED",
        })
      }
      // Verify the language exists before uploading, so an unknown key doesn't
      // leave an orphaned object in R2 (404 after upload).
      await languageService.getLanguageByKey(req.params.key as string, req.user ?? null)
      const logoUrl = await uploadImageToR2(req.file.buffer, req.file.mimetype, {
        folder: "languages",
        identifier: req.params.key as string,
        maxWidth: 256,
        maxHeight: 256,
        quality: 85,
      })
      const language = await languageService.updateLanguage(req.params.key as string, {
        logoUrl,
      })
      sendSuccess(res, language, "Logo uploaded")
    } catch (err) {
      next(err)
    }
  },
)
