import { Router } from "express"
import { authenticate } from "../middleware/auth.middleware.js"
import { updateKycDetails, getKycStatus, getKycDetails } from "../services/auth-kyc.service.js"
import { updateKycSchema } from "../auth.validators.js"
import { validateRequest } from "../../../middlewares/validate-request.js"
import { sendSuccess } from "../../../utils/response.js"
import type { Request, Response, NextFunction } from "express"

export const kycRouter: Router = Router()

/**
 * @openapi
 * /auth/kyc:
 *   put:
 *     tags: [Auth - KYC]
 *     summary: Update KYC details (PAN, Bank Account, IFSC, UPI)
 *     description: >
 *       Updates the authenticated user's KYC fields.
 *       All sensitive fields are encrypted at rest using AES-256-GCM.
 *       When any KYC field changes, `kycStatus` resets to "pending" for re-verification.
 *       Submit only the fields you want to update — omitted fields are left unchanged.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               panNumber:
 *                 type: string
 *                 description: PAN card number (10 characters, e.g., ABCDE1234F)
 *                 example: ABCDE1234F
 *               bankAccountNumber:
 *                 type: string
 *                 description: Bank account number (9-18 digits)
 *                 example: "123456789012"
 *               ifscCode:
 *                 type: string
 *                 description: IFSC code (11 characters, e.g., HDFC0001234)
 *                 example: HDFC0001234
 *               upiId:
 *                 type: string
 *                 description: UPI ID (e.g., username@paytm)
 *                 example: user@paytm
 *     responses:
 *       200:
 *         description: KYC details updated successfully
 *       400:
 *         description: Invalid field format
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Account banned
 */
kycRouter.put(
  "/",
  authenticate,
  validateRequest(updateKycSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await updateKycDetails(req.user!.userId, req.body)
      sendSuccess(res, user, "KYC details updated successfully")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /auth/kyc/status:
 *   get:
 *     tags: [Auth - KYC]
 *     summary: Get KYC verification status
 *     description: >
 *       Returns the user's KYC verification status and which fields have been submitted.
 *       Does NOT return the actual encrypted values — only booleans indicating presence.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KYC status retrieved
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
 *                         panVerified:
 *                           type: boolean
 *                         kycStatus:
 *                           type: string
 *                           enum: [pending, verified, rejected]
 *                         hasPan:
 *                           type: boolean
 *                         hasBankAccount:
 *                           type: boolean
 *                         hasIfsc:
 *                           type: boolean
 *                         hasUpiId:
 *                           type: boolean
 *       401:
 *         description: Authentication required
 */
kycRouter.get(
  "/status",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await getKycStatus(req.user!.userId)
      sendSuccess(res, status)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /auth/kyc/details:
 *   get:
 *     tags: [Auth - KYC]
 *     summary: Get decrypted KYC details (self only)
 *     description: >
 *       Returns the user's own KYC details with decrypted values.
 *       Only the authenticated user can access their own KYC details.
 *       Admin users can also access any user's KYC details.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KYC details retrieved
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
 *                         panNumber:
 *                           type: string
 *                           nullable: true
 *                         bankAccountNumber:
 *                           type: string
 *                           nullable: true
 *                         ifscCode:
 *                           type: string
 *                           nullable: true
 *                         upiId:
 *                           type: string
 *                           nullable: true
 *                         panVerified:
 *                           type: boolean
 *                         kycStatus:
 *                           type: string
 *                           enum: [pending, verified, rejected]
 *       401:
 *         description: Authentication required
 */
kycRouter.get(
  "/details",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const details = await getKycDetails(req.user!.userId)
      sendSuccess(res, details)
    } catch (err) {
      next(err)
    }
  },
)
