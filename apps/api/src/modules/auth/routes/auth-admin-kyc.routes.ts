import { Router } from "express"
import { authenticate, requireRole } from "../middleware/auth.middleware.js"
import {
  listPendingKyc,
  reviewKyc,
  getAdminKycDetails,
} from "../services/auth-kyc.service.js"
import { reviewKycSchema } from "../auth.validators.js"
import { validateRequest } from "../../../middlewares/validate-request.js"
import { sendSuccess } from "../../../utils/response.js"
import type { Request, Response, NextFunction } from "express"

export const adminKycRouter: Router = Router()

// All admin KYC routes require authentication + admin/creator role
adminKycRouter.use(authenticate, requireRole("admin", "creator"))

/**
 * @openapi
 * /admin/kyc/pending:
 *   get:
 *     tags: [Admin - KYC]
 *     summary: List all pending KYC submissions
 *     description: >
 *       Returns all users whose KYC status is "pending" (awaiting review).
 *       Only accessible by admin or creator roles.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending KYC users
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
 *                         total:
 *                           type: integer
 *                         users:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               firstName:
 *                                 type: string
 *                               lastName:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               accountStatus:
 *                                 type: string
 *                               panVerified:
 *                                 type: boolean
 *                               kycStatus:
 *                                 type: string
 *                                 enum: [pending, verified, rejected]
 *                               createdAt:
 *                                 type: string
 *                                 format: date-time
 *                               updatedAt:
 *                                 type: string
 *                                 format: date-time
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin/creator role required
 */
adminKycRouter.get(
  "/pending",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await listPendingKyc()
      sendSuccess(res, result)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /admin/kyc/{userId}:
 *   get:
 *     tags: [Admin - KYC]
 *     summary: Get full KYC details of a user (decrypted)
 *     description: >
 *       Returns decrypted KYC details for a specific user.
 *       Includes PAN, bank account, IFSC, and UPI values.
 *       Only accessible by admin or creator roles.
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
 *         description: User KYC details
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
 *                         user:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             firstName:
 *                               type: string
 *                             lastName:
 *                               type: string
 *                             email:
 *                               type: string
 *                             accountStatus:
 *                               type: string
 *                             panVerified:
 *                               type: boolean
 *                             kycStatus:
 *                               type: string
 *                         kyc:
 *                           type: object
 *                           properties:
 *                             panNumber:
 *                               type: string
 *                               nullable: true
 *                             bankAccountNumber:
 *                               type: string
 *                               nullable: true
 *                             ifscCode:
 *                               type: string
 *                               nullable: true
 *                             upiId:
 *                               type: string
 *                               nullable: true
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin/creator role required
 *       404:
 *         description: User not found
 */
adminKycRouter.get(
  "/:userId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId as string
      const result = await getAdminKycDetails(userId)
      sendSuccess(res, result)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /admin/kyc/{userId}/review:
 *   put:
 *     tags: [Admin - KYC]
 *     summary: Approve or reject a user's KYC submission
 *     description: >
 *       Sets the user's kycStatus to "verified" or "rejected".
 *       When approved, also sets panVerified = true.
 *       The admin's identity is logged for audit purposes.
 *       Only accessible by admin or creator roles.
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
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approved, rejected]
 *                 description: Approve or reject the KYC
 *               rejectionReason:
 *                 type: string
 *                 description: Required if rejected. Reason for rejection.
 *     responses:
 *       200:
 *         description: KYC review completed
 *       400:
 *         description: Missing rejection reason when rejected
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin/creator role required
 *       404:
 *         description: User not found
 */
adminKycRouter.put(
  "/:userId/review",
  validateRequest(reviewKycSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId as string
      const { user } = await reviewKyc(
        userId,
        req.body.action,
        req.user!.userId,
        req.user!.role,
        req.body.rejectionReason,
      )
      const actionLabel = req.body.action === "approved" ? "approved" : "rejected"
      sendSuccess(res, user, `KYC ${actionLabel} successfully`)
    } catch (err) {
      next(err)
    }
  },
)
