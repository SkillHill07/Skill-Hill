import { Router } from "express"
import { paymentService } from "./payment.service.js"
import { authenticate } from "../auth/middleware/auth.middleware.js"
import { validateRequest } from "../../middlewares/validate-request.js"
import { sendSuccess } from "../../utils/response.js"
import { createOrderSchema, listPaymentsSchema } from "./payment.validation.js"
import type { Request, Response, NextFunction } from "express"
import type { PaymentStatus } from "@skillcontest/shared-types"

export const paymentRouter: Router = Router()

paymentRouter.use(authenticate)

/**
 * @openapi
 * /payments/create-order:
 *   post:
 *     tags: [Payments]
 *     summary: Create a Razorpay order (wallet deposit)
 *     description: >
 *       Returns the order id + your public key id so the frontend can open
 *       Razorpay Checkout. The payment is credited to the user's wallet only
 *       after the HMAC-verified webhook confirms capture. Returns 503
 *       PAYMENTS_NOT_CONFIGURED until Razorpay env vars are set.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: integer
 *                 description: Paise — min ₹10, max ₹5,000 per order
 *               purpose:
 *                 type: string
 *                 enum: [deposit, contest]
 *                 default: deposit
 *               contestId:
 *                 type: string
 *                 description: Optional contest id the deposit is for (metadata only)
 *     responses:
 *       200:
 *         description: Razorpay order created
 *       400:
 *         description: Validation failed / free contest has no fee
 *       503:
 *         description: Payments not configured
 */
paymentRouter.post(
  "/create-order",
  validateRequest(createOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await paymentService.createOrder(req.user!.userId, req.body)
      sendSuccess(res, order, "Razorpay order created")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /payments:
 *   get:
 *     tags: [Payments]
 *     summary: Current user's payment history (paginated)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [created, attempted, paid, failed, refunded]
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
 *         description: Paginated payment records
 */
paymentRouter.get(
  "/",
  validateRequest(listPaymentsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentService.listUserPayments(req.user!.userId, {
        status: req.query.status as PaymentStatus | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      })
      sendSuccess(res, result)
    } catch (err) {
      next(err)
    }
  },
)
