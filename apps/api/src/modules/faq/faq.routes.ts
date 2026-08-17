import { Router } from "express"
import { faqService } from "./faq.service.js"
import {
  authenticate,
  optionalAuth,
  requireRole,
} from "../auth/middleware/auth.middleware.js"
import { validateRequest } from "../../middlewares/validate-request.js"
import { sendError, sendSuccess } from "../../utils/response.js"
import {
  createFaqSchema,
  updateFaqSchema,
  deleteFaqSchema,
} from "./faq.validation.js"
import type { Request, Response, NextFunction } from "express"

export const faqRouter: Router = Router()

/**
 * @openapi
 * /site/faqs:
 *   get:
 *     tags: [Site Content]
 *     summary: List FAQs (public — active items only, ordered; optional category filter)
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Filter by exact category
 *       - in: query
 *         name: includeInactive
 *         schema: { type: boolean }
 *         description: Staff only — include inactive FAQs
 *     responses:
 *       200:
 *         description: Ordered list of FAQs
 */
faqRouter.get(
  "/site/faqs",
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const includeInactive = req.query.includeInactive === "true"
      const isStaff = req.user?.role === "admin" || req.user?.role === "creator"
      if (includeInactive && !isStaff) {
        sendError(res, "You do not have permission to view inactive FAQs", 403)
        return
      }
      const category =
        typeof req.query.category === "string" && req.query.category.trim() !== ""
          ? req.query.category
          : undefined
      const faqs = await faqService.listFaqs(includeInactive, category)
      sendSuccess(res, faqs)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /site/faqs:
 *   post:
 *     tags: [Site Content]
 *     summary: Create an FAQ — admin/creator
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question, answer]
 *             properties:
 *               question: { type: string }
 *               answer: { type: string }
 *               category: { type: string, nullable: true }
 *               order: { type: integer }
 *               active: { type: boolean }
 *     responses:
 *       201:
 *         description: FAQ created
 */
faqRouter.post(
  "/site/faqs",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(createFaqSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const faq = await faqService.createFaq(req.body)
      sendSuccess(res, faq, "FAQ created", 201)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /site/faqs/{id}:
 *   patch:
 *     tags: [Site Content]
 *     summary: Update an FAQ — admin/creator
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated FAQ
 */
faqRouter.patch(
  "/site/faqs/:id",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(updateFaqSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const faq = await faqService.updateFaq(req.params.id as string, req.body)
      sendSuccess(res, faq, "FAQ updated")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /site/faqs/{id}:
 *   delete:
 *     tags: [Site Content]
 *     summary: Delete an FAQ — admin/creator
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: FAQ deleted
 */
faqRouter.delete(
  "/site/faqs/:id",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(deleteFaqSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await faqService.deleteFaq(req.params.id as string)
      sendSuccess(res, null, "FAQ deleted")
    } catch (err) {
      next(err)
    }
  },
)
