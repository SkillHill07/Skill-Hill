import { Router } from "express"
import { adminLoginUser } from "../services/auth.service.js"
import { loginSchema } from "../auth.validators.js"
import { validateRequest } from "../../../middlewares/validate-request.js"
import { loginLimiter } from "../../../middlewares/rate-limiter.js"
import { sendSuccess } from "../../../utils/response.js"
import { setAuthCookies } from "../../../utils/cookies.js"
import type { Request, Response, NextFunction } from "express"

export const adminAuthRouter: Router = Router()

/**
 * @openapi
 * /admin/auth/login:
 *   post:
 *     tags: [Admin - Auth]
 *     summary: Admin login (requires admin or creator role)
 *     description: >
 *       Authenticates with email and password, then verifies the user has
 *       an admin or creator role. Sets HttpOnly cookies with the tokens
 *       and returns user + tokens in the response body.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - turnstileToken
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@skillshill.com
 *               password:
 *                 type: string
 *                 format: password
 *               turnstileToken:
 *                 type: string
 *                 description: Cloudflare Turnstile token
 *     responses:
 *       200:
 *         description: Admin login successful
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
 *                           $ref: "#/components/schemas/User"
 *                         tokens:
 *                           $ref: "#/components/schemas/AuthTokens"
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Not an admin/creator, or account banned/flagged
 */
adminAuthRouter.post(
  "/login",
  loginLimiter,
  validateRequest(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, tokens } = await adminLoginUser(req.body)
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken)
      sendSuccess(res, { user, tokens }, "Admin login successful")
    } catch (err) {
      next(err)
    }
  },
)
