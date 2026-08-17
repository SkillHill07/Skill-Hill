import { Router } from "express"
import { whyChooseUsService } from "./whyChooseUs.service.js"
import {
  authenticate,
  optionalAuth,
  requireRole,
} from "../auth/middleware/auth.middleware.js"
import { validateRequest } from "../../middlewares/validate-request.js"
import { sendError, sendSuccess } from "../../utils/response.js"
import {
  createWhyChooseUsSchema,
  updateWhyChooseUsSchema,
  deleteWhyChooseUsSchema,
} from "./whyChooseUs.validation.js"
import type { Request, Response, NextFunction } from "express"

export const whyChooseUsRouter: Router = Router()

/**
 * @openapi
 * /site/why-choose-us:
 *   get:
 *     tags: [Site Content]
 *     summary: List "why choose us" items (public — active items only, ordered)
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema: { type: boolean }
 *         description: Staff only — include inactive items
 *     responses:
 *       200:
 *         description: Ordered list of items
 *       403:
 *         description: includeInactive requested without staff role
 */
whyChooseUsRouter.get(
  "/site/why-choose-us",
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const includeInactive = req.query.includeInactive === "true"
      const isStaff = req.user?.role === "admin" || req.user?.role === "creator"
      if (includeInactive && !isStaff) {
        sendError(res, "You do not have permission to view inactive items", 403)
        return
      }
      const items = await whyChooseUsService.listWhyChooseUs(includeInactive)
      sendSuccess(res, items)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /site/why-choose-us:
 *   post:
 *     tags: [Site Content]
 *     summary: Create a "why choose us" item — admin/creator
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               icon: { type: string, description: "emoji or icon key" }
 *               order: { type: integer }
 *               active: { type: boolean }
 *     responses:
 *       201:
 *         description: Item created
 */
whyChooseUsRouter.post(
  "/site/why-choose-us",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(createWhyChooseUsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await whyChooseUsService.createWhyChooseUs(req.body)
      sendSuccess(res, item, "Item created", 201)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /site/why-choose-us/{id}:
 *   patch:
 *     tags: [Site Content]
 *     summary: Update a "why choose us" item — admin/creator
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated item
 *       404:
 *         description: Item not found
 */
whyChooseUsRouter.patch(
  "/site/why-choose-us/:id",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(updateWhyChooseUsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await whyChooseUsService.updateWhyChooseUs(
        req.params.id as string,
        req.body,
      )
      sendSuccess(res, item, "Item updated")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /site/why-choose-us/{id}:
 *   delete:
 *     tags: [Site Content]
 *     summary: Delete a "why choose us" item — admin/creator
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Item deleted
 */
whyChooseUsRouter.delete(
  "/site/why-choose-us/:id",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(deleteWhyChooseUsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await whyChooseUsService.deleteWhyChooseUs(req.params.id as string)
      sendSuccess(res, null, "Item deleted")
    } catch (err) {
      next(err)
    }
  },
)
