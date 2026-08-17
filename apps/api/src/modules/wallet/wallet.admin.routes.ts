import { Router } from "express"
import { walletService } from "./wallet.service.js"
import { authenticate, requireRole } from "../auth/middleware/auth.middleware.js"
import { validateRequest } from "../../middlewares/validate-request.js"
import { sendSuccess } from "../../utils/response.js"
import { auditService } from "../audit/audit.service.js"
import { adminWalletStatusSchema } from "./wallet.validation.js"
import type { Request, Response, NextFunction } from "express"
import type { WalletStatus } from "@skillcontest/shared-types"

export const adminWalletRouter: Router = Router()

adminWalletRouter.use(authenticate)

/**
 * @openapi
 * /admin/wallets/{userId}/status:
 *   patch:
 *     tags: [Admin - Wallets]
 *     summary: Freeze / unfreeze a user's wallet (admin only)
 *     description: >
 *       Freezing blocks every balance mutation (deposit, deduct, credit,
 *       refund, withdraw) — reads still work. Used for fraud/suspension holds.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, frozen]
 *     responses:
 *       200:
 *         description: Wallet status updated
 *       403:
 *         description: Admin role required
 *       404:
 *         description: Wallet not found (user never transacted)
 */
adminWalletRouter.patch(
  "/wallets/:userId/status",
  requireRole("admin"),
  validateRequest(adminWalletStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wallet = await walletService.setStatus(
        req.params.userId as string,
        req.body.status as WalletStatus,
      )
      await auditService.log({
        actorId: req.user!.userId,
        actorRole: req.user!.role,
        action: "wallet.status",
        resource: "wallet",
        resourceId: req.params.userId as string,
        details: { status: req.body.status },
        ip: req.ip ?? null,
      })
      sendSuccess(res, wallet)
    } catch (err) {
      next(err)
    }
  },
)
