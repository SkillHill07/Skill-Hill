import { Router } from "express"
import { auditService } from "./audit.service.js"
import { authenticate, requireRole } from "../auth/middleware/auth.middleware.js"
import { validateRequest } from "../../middlewares/validate-request.js"
import { sendSuccess } from "../../utils/response.js"
import { listAuditLogsSchema } from "./audit.validation.js"
import type { Request, Response, NextFunction } from "express"

/** Mounted at /admin. Read-only — entries are written by admin routes. */
export const adminAuditRouter: Router = Router()

adminAuditRouter.use(authenticate)

/**
 * @openapi
 * /admin/audit:
 *   get:
 *     tags: [Admin - Audit]
 *     summary: Read-only audit trail of admin actions (admin/creator)
 *     description: >
 *       Every action that mutates money, bans a user, or changes contest
 *       state is logged with who, what, when, ip and resource id. Newest
 *       first, filterable by action / actor / resource.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Exact action string (e.g. contest.publish, user.status)
 *       - in: query
 *         name: actorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: resource
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
 *         description: Paginated audit log
 */
adminAuditRouter.get(
  "/audit",
  requireRole("admin", "creator"),
  validateRequest(listAuditLogsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await auditService.listLogs({
        action: req.query.action as string | undefined,
        actorId: req.query.actorId as string | undefined,
        resource: req.query.resource as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      })
      sendSuccess(res, result)
    } catch (err) {
      next(err)
    }
  },
)
