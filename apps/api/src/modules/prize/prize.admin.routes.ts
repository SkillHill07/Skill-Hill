import { Router } from "express"
import { prizeService } from "./prize.service.js"
import { authenticate, requireRole } from "../auth/middleware/auth.middleware.js"
import { validateRequest } from "../../middlewares/validate-request.js"
import { sendSuccess } from "../../utils/response.js"
import { auditService } from "../audit/audit.service.js"
import { adminRedistributeSchema } from "./prize.validation.js"
import type { Request, Response, NextFunction } from "express"

/** Mounted at /admin. */
export const adminPrizeRouter: Router = Router()

adminPrizeRouter.use(authenticate)

/**
 * @openapi
 * /admin/contests/{id}/prizes/redistribute:
 *   post:
 *     tags: [Admin - Prizes]
 *     summary: Re-run prize distribution for a settled contest (admin only)
 *     description: >
 *       Idempotent — already-credited winners are skipped, stuck
 *       pending/failed winners get their wallet credit retried. Used to
 *       recover from a failed distribution at settle time.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Distribution summary
 *       400:
 *         description: Contest not settled
 *       403:
 *         description: Admin role required
 */
adminPrizeRouter.post(
  "/contests/:id/prizes/redistribute",
  requireRole("admin"),
  validateRequest(adminRedistributeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await prizeService.distribute(req.params.id as string)
      await auditService.log({
        actorId: req.user!.userId,
        actorRole: req.user!.role,
        action: "prize.redistribute",
        resource: "contest",
        resourceId: req.params.id as string,
        details: { distributed: result.distributed, failed: result.failed },
        ip: req.ip ?? null,
      })
      sendSuccess(res, result, "Prize distribution re-run")
    } catch (err) {
      next(err)
    }
  },
)
