import { Router } from "express"
import { paymentService } from "./payment.service.js"
import { authenticate, requireRole } from "../auth/middleware/auth.middleware.js"
import { validateRequest } from "../../middlewares/validate-request.js"
import { sendSuccess } from "../../utils/response.js"
import { auditService } from "../audit/audit.service.js"
import { adminListPaymentsSchema, adminRefundSchema } from "./payment.validation.js"
import type { Request, Response, NextFunction } from "express"
import type { PaymentStatus } from "@skillcontest/shared-types"

export const adminPaymentRouter: Router = Router()

adminPaymentRouter.use(authenticate)

/**
 * @openapi
 * /admin/payments:
 *   get:
 *     tags: [Admin - Payments]
 *     summary: Audit view of all payments (admin/creator)
 *     description: Filters + pagination, user populated.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [created, attempted, paid, failed, refunded]
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Paginated payments with user info
 */
adminPaymentRouter.get(
  "/payments",
  requireRole("admin", "creator"),
  validateRequest(adminListPaymentsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentService.listAllPayments({
        status: req.query.status as PaymentStatus | undefined,
        userId: req.query.userId as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      })
      sendSuccess(res, result)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /admin/payments/refund:
 *   post:
 *     tags: [Admin - Payments]
 *     summary: Refund a captured payment back to the user's card (admin only)
 *     description: >
 *       Reverses the wallet deposit first (blocked with 400 if the user spent
 *       the money — no double-pay), then refunds via Razorpay. Idempotent:
 *       already-refunded payments are returned as-is.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paymentId]
 *             properties:
 *               paymentId:
 *                 type: string
 *                 description: Our Payment record id (not the Razorpay id)
 *     responses:
 *       200:
 *         description: Payment refunded
 *       400:
 *         description: Payment not paid / wallet deposit gone
 *       403:
 *         description: Admin role required
 *       404:
 *         description: Payment not found
 */
adminPaymentRouter.post(
  "/payments/refund",
  requireRole("admin"),
  validateRequest(adminRefundSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await paymentService.refundPayment(req.body.paymentId)
      await auditService.log({
        actorId: req.user!.userId,
        actorRole: req.user!.role,
        action: "payment.refund",
        resource: "payment",
        resourceId: req.body.paymentId,
        ip: req.ip ?? null,
      })
      sendSuccess(res, payment, "Payment refunded")
    } catch (err) {
      next(err)
    }
  },
)
