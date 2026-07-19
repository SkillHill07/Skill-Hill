import { Router } from "express"
import { authenticate } from "../middleware/auth.middleware.js"
import { sendEmailOtp, verifyEmailOtp } from "../services/auth-otp.service.js"
import { verifyOtpSchema } from "../auth.validators.js"
import { validateRequest } from "../../../middlewares/validate-request.js"
import { sendOtpLimiter, verifyOtpLimiter } from "../../../middlewares/rate-limiter.js"
import { sendSuccess } from "../../../utils/response.js"
import type { Request, Response, NextFunction } from "express"

export const otpRouter: Router = Router()

/**
 * @openapi
 * /auth/otp/send:
 *   post:
 *     tags: [Auth - OTP]
 *     summary: Send email verification OTP
 *     description: >
 *       Sends a 6-digit OTP to the authenticated user's email address.
 *       Rate limited to 1 request per 60 seconds per user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OTP sent successfully
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
 *                         expiresInSeconds:
 *                           type: integer
 *                           description: OTP expiry time in seconds
 *                           example: 600
 *       400:
 *         description: Email already verified
 *       401:
 *         description: Authentication required
 *       429:
 *         description: OTP cooldown or rate limited
 */
otpRouter.post(
  "/send",
  authenticate,
  sendOtpLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await sendEmailOtp(req.user!.userId)
      sendSuccess(res, result, "OTP sent to your email")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /auth/otp/verify:
 *   post:
 *     tags: [Auth - OTP]
 *     summary: Verify email OTP
 *     description: >
 *       Verifies the 6-digit OTP sent to the user's email.
 *       On success, marks the user's email as verified.
 *       Max 5 incorrect attempts before the OTP is invalidated.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otp
 *             properties:
 *               otp:
 *                 type: string
 *                 pattern: "^\\d{6}$"
 *                 description: 6-digit OTP code
 *                 example: "482913"
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: "#/components/schemas/SuccessResponse"
 *       400:
 *         description: Invalid OTP or email already verified
 *       401:
 *         description: Authentication required
 *       410:
 *         description: OTP expired
 *       429:
 *         description: Too many incorrect attempts
 */
otpRouter.post(
  "/verify",
  authenticate,
  verifyOtpLimiter,
  validateRequest(verifyOtpSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await verifyEmailOtp(req.user!.userId, req.body.otp)
      sendSuccess(res, null, "Email verified successfully")
    } catch (err) {
      next(err)
    }
  },
)
