import { Router } from "express"
import { authenticate, requireRole } from "../middleware/auth.middleware.js"
import {
  listUsers,
  getUserDetails,
  changeUserStatus,
  changeUserRole,
} from "../services/auth-admin-accounts.service.js"
import { changeStatusSchema, changeRoleSchema } from "../auth.validators.js"
import { validateRequest } from "../../../middlewares/validate-request.js"
import { sendSuccess } from "../../../utils/response.js"
import { auditService } from "../../audit/audit.service.js"
import type { Request, Response, NextFunction } from "express"

export const adminAccountsRouter: Router = Router()

// All account management routes require authentication
adminAccountsRouter.use(authenticate)

/**
 * @openapi
 * /admin/accounts:
 *   get:
 *     tags: [Admin - Accounts]
 *     summary: List users with optional filters
 *     description: >
 *       Returns a paginated list of users. Supports filtering by accountStatus,
 *       role, kycStatus, and text search on name/email.
 *       Admin/creator only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: accountStatus
 *         schema:
 *           type: string
 *           enum: [active, inactive, flagged, banned]
 *         description: Filter by account status
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, admin, creator]
 *         description: Filter by role
 *       - in: query
 *         name: kycStatus
 *         schema:
 *           type: string
 *           enum: [pending, verified, rejected]
 *         description: Filter by KYC status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email (case-insensitive)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page (max 100)
 *     responses:
 *       200:
 *         description: Paginated list of users
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: "#/components/schemas/SuccessResponse"
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         users:
 *                           type: array
 *                           items:
 *                             type: object
 *                         total:
 *                           type: integer
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin/creator role required
 */
adminAccountsRouter.get(
  "/",
  requireRole("admin", "creator"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        accountStatus,
        role,
        kycStatus,
        search,
        page,
        limit,
      } = req.query

      const result = await listUsers({
        accountStatus: (accountStatus as string) || undefined,
        role: (role as string) || undefined,
        kycStatus: (kycStatus as string) || undefined,
        search: (search as string) || undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      })
      sendSuccess(res, result)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /admin/accounts/{userId}:
 *   get:
 *     tags: [Admin - Accounts]
 *     summary: Get full user details
 *     description: Returns complete user profile (excluding decrypted KYC).
 *       Admin/creator only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB user ID
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: "#/components/schemas/SuccessResponse"
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: "#/components/schemas/User"
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin/creator role required
 *       404:
 *         description: User not found
 */
adminAccountsRouter.get(
  "/:userId",
  requireRole("admin", "creator"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId as string
      const user = await getUserDetails(userId)
      sendSuccess(res, user)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /admin/accounts/{userId}/status:
 *   patch:
 *     tags: [Admin - Accounts]
 *     summary: Change user account status
 *     description: >
 *       Ban, unban, flag, or activate a user account.
 *       Banning or flagging revokes all active sessions.
 *       Admin only. Cannot modify your own status.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, flagged, banned]
 *                 description: New account status
 *               reason:
 *                 type: string
 *                 description: Reason for the status change
 *     responses:
 *       200:
 *         description: Account status updated
 *       400:
 *         description: Cannot self-modify or invalid status
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 *       404:
 *         description: User not found
 */
adminAccountsRouter.patch(
  "/:userId/status",
  requireRole("admin"),
  validateRequest(changeStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId as string
      const { user } = await changeUserStatus(
        userId,
        req.body.status,
        req.user!.userId,
        req.body.reason,
      )
      await auditService.log({
        actorId: req.user!.userId,
        actorRole: req.user!.role,
        action: "user.status",
        resource: "user",
        resourceId: userId,
        details: { status: req.body.status, reason: req.body.reason ?? null },
        ip: req.ip ?? null,
      })
      sendSuccess(res, user, `Account status changed to ${req.body.status}`)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /admin/accounts/{userId}/role:
 *   patch:
 *     tags: [Admin - Accounts]
 *     summary: Change user role
 *     description: >
 *       Promote or demote a user's role.
 *       Revokes all active sessions (forces re-login for new permissions).
 *       Admin only. Cannot modify your own role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, admin, creator]
 *                 description: New role
 *     responses:
 *       200:
 *         description: Role updated
 *       400:
 *         description: Cannot self-modify or invalid role
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 *       404:
 *         description: User not found
 */
adminAccountsRouter.patch(
  "/:userId/role",
  requireRole("admin"),
  validateRequest(changeRoleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId as string
      const { user } = await changeUserRole(
        userId,
        req.body.role,
        req.user!.userId,
      )
      await auditService.log({
        actorId: req.user!.userId,
        actorRole: req.user!.role,
        action: "user.role",
        resource: "user",
        resourceId: userId,
        details: { role: req.body.role },
        ip: req.ip ?? null,
      })
      sendSuccess(res, user, `Role changed to ${req.body.role}`)
    } catch (err) {
      next(err)
    }
  },
)
