import { Router } from "express"
import { walletService } from "./wallet.service.js"
import { initiatePayout } from "../payment/payout.service.js"
import { paymentService } from "../payment/payment.service.js"
import { authenticate } from "../auth/middleware/auth.middleware.js"
import { validateRequest } from "../../middlewares/validate-request.js"
import { sendSuccess, sendError } from "../../utils/response.js"
import {
  balanceSchema,
  depositSchema,
  transactionsSchema,
  withdrawSchema,
} from "./wallet.validation.js"
import { config } from "../../config/index.js"
import type { Request, Response, NextFunction } from "express"
import type { TransactionType } from "@skillcontest/shared-types"

export const walletRouter: Router = Router()

walletRouter.use(authenticate)

/**
 * @openapi
 * /wallet/balance:
 *   get:
 *     tags: [Wallet]
 *     summary: Current user's wallet balance
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Balance summary (paise) with lifetime totals
 */
walletRouter.get("/balance", validateRequest(balanceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const balance = await walletService.getBalance(req.user!.userId)
    sendSuccess(res, balance)
  } catch (err) {
    next(err)
  }
})

/**
 * @openapi
 * /wallet/transactions:
 *   get:
 *     tags: [Wallet]
 *     summary: Paginated transaction history (newest first)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [deposit, contest_fee, prize, refund, withdrawal]
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
 *         description: Paginated ledger rows
 */
walletRouter.get(
  "/transactions",
  validateRequest(transactionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await walletService.getTransactions(req.user!.userId, {
        type: req.query.type as TransactionType | undefined,
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
 * /wallet/deposit:
 *   post:
 *     tags: [Wallet]
 *     summary: Create a Razorpay order to deposit funds (wallet-centric alias)
 *     description: >
 *       Thin forwarder to the payment module (same as POST /payments/create-order
 *       with purpose=deposit). The wallet is credited only after the HMAC-verified
 *       webhook confirms capture. Returns 503 PAYMENTS_NOT_CONFIGURED until
 *       Razorpay env vars are set.
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
 *     responses:
 *       200:
 *         description: Razorpay order created (orderId + keyId for Checkout)
 *       400:
 *         description: Validation failed
 *       503:
 *         description: Payments not configured
 */
walletRouter.post(
  "/deposit",
  validateRequest(depositSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await paymentService.createOrder(req.user!.userId, {
        amount: req.body.amount,
        purpose: "deposit",
      })
      sendSuccess(res, order, "Razorpay order created")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /wallet/withdraw:
 *   post:
 *     tags: [Wallet]
 *     summary: Request a withdrawal (KYC verified required)
 *     description: >
 *       Deducts from the wallet and pays out via the RazorpayX payout gateway
 *       (UPI). Returns 503 PAYMENTS_NOT_CONFIGURED until RazorpayX env vars
 *       (key with payout permission + RAZORPAYX_ACCOUNT_NUMBER) are set.
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
 *                 description: Paise — minimum ₹100 (10000 paise)
 *               upiId:
 *                 type: string
 *                 description: Optional UPI id (defaults to the verified KYC UPI id)
 *     responses:
 *       201:
 *         description: Withdrawal requested (pending payout)
 *       400:
 *         description: Validation / insufficient balance / below minimum
 *       403:
 *         description: KYC required or wallet frozen
 *       503:
 *         description: Payments not configured
 */
walletRouter.post(
  "/withdraw",
  validateRequest(withdrawSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    // Fast-fail before any ledger mutation: without the RazorpayX payout
    // gateway the request cannot complete, and the default payout would
    // deduct, record a pending transaction, then reverse it — leaving a
    // failed ledger row and ~6 DB ops for a 503.
    if (!config.RAZORPAY_KEY_ID || !config.RAZORPAYX_ACCOUNT_NUMBER) {
      sendError(
        res,
        "Withdrawals are not available yet — payment processing is not configured",
        503,
        undefined,
        "PAYMENTS_NOT_CONFIGURED",
      )
      return
    }
    try {
      const tx = await walletService.withdraw(req.user!.userId, req.body.amount, {
        upiId: req.body.upiId,
        payout: initiatePayout,
      })
      sendSuccess(res, tx, "Withdrawal requested", 201)
    } catch (err) {
      next(err)
    }
  },
)
