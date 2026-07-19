import { Router } from "express"
import { authService } from "../services/auth.service.js"
import { authenticate } from "../middleware/auth.middleware.js"
import { uploadAvatarMiddleware } from "../middleware/upload.middleware.js"
import { uploadAvatar } from "../services/upload.service.js"
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  setPasswordSchema,
} from "../auth.validators.js"
import { validateRequest } from "../../../middlewares/validate-request.js"
import {
  loginLimiter,
  registerLimiter,
  refreshLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from "../../../middlewares/rate-limiter.js"
import { sendSuccess } from "../../../utils/response.js"
import type { Request, Response, NextFunction } from "express"

export const authRouter: Router = Router()

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - password
 *               - turnstileToken
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *               turnstileToken:
 *                 type: string
 *                 description: Cloudflare Turnstile token
 *     responses:
 *       201:
 *         description: User registered successfully
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
 *       400:
 *         description: Validation error or Turnstile failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       409:
 *         description: Email already exists
 */
authRouter.post(
  "/register",
  registerLimiter,
  validateRequest(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, tokens } = await authService.registerUser(req.body)
      sendSuccess(res, { user, tokens }, "Registration successful", 201)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
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
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *               turnstileToken:
 *                 type: string
 *                 description: Cloudflare Turnstile token
 *     responses:
 *       200:
 *         description: Login successful
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
 *         description: Account banned or flagged
 */
authRouter.post(
  "/login",
  loginLimiter,
  validateRequest(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, tokens } = await authService.loginUser(req.body)
      sendSuccess(res, { user, tokens }, "Login successful")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token using refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
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
 *         description: Invalid or expired refresh token
 */
authRouter.post(
  "/refresh",
  refreshLimiter,
  validateRequest(refreshSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, tokens } = await authService.refreshTokens(
        req.body.refreshToken,
      )
      sendSuccess(res, { user, tokens }, "Tokens refreshed")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and revoke refresh token
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Authentication required
 */
authRouter.post(
  "/logout",
  authenticate,
  validateRequest(logoutSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.logoutUser(req.user!.userId, req.body.refreshToken)
      sendSuccess(res, null, "Logged out successfully")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
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
 */
authRouter.get(
  "/me",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authService.getMe(req.user!.userId)
      sendSuccess(res, user)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /auth/me:
 *   put:
 *     tags: [Auth]
 *     summary: Update current authenticated user's profile (with avatar upload)
 *     description: >
 *       Updates the authenticated user's profile fields.
 *       Accepts multipart/form-data — text fields + optional "avatar" file.
 *       Only provided fields are updated — omitted fields are left unchanged.
 *       The avatar is compressed to WebP (400x400) and uploaded to Cloudflare R2.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               phone:
 *                 type: string
 *                 nullable: true
 *                 example: "9876543210"
 *               phoneCountryCode:
 *                 type: string
 *                 nullable: true
 *                 example: "+91"
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Profile picture (JPEG, PNG, or WebP, max 5MB)
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: "#/components/schemas/SuccessResponse"
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: "#/components/schemas/User"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
authRouter.put(
  "/me",
  authenticate,
  uploadAvatarMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId
      const updateFields: Record<string, unknown> = {}

      // Parse text fields from multipart form
      if (req.body.firstName !== undefined) updateFields.firstName = req.body.firstName
      if (req.body.lastName !== undefined) updateFields.lastName = req.body.lastName
      if (req.body.phone !== undefined) updateFields.phone = req.body.phone || null
      if (req.body.phoneCountryCode !== undefined) updateFields.phoneCountryCode = req.body.phoneCountryCode || null

      // Handle avatar upload
      if (req.file) {
        const avatarUrl = await uploadAvatar(
          req.file.buffer,
          req.file.mimetype,
          userId,
        )
        updateFields.avatarUrl = avatarUrl
      }

      const user = await authService.updateProfile(
        userId,
        updateFields as Parameters<typeof authService.updateProfile>[1],
      )
      sendSuccess(res, user, "Profile updated successfully")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /auth/me:
 *   delete:
 *     tags: [Auth]
 *     summary: Delete own account (soft delete)
 *     description: >
 *       Soft-deletes the authenticated user's account.
 *       Sets `deletedAt` timestamp, marks account as inactive,
 *       and revokes all active sessions.
 *       The account can potentially be restored by an admin.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/SuccessResponse"
 *       400:
 *         description: Account already deleted
 *       401:
 *         description: Authentication required
 */
authRouter.delete(
  "/me",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.deleteAccount(req.user!.userId)
      sendSuccess(res, null, "Account deleted successfully")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /auth/check:
 *   get:
 *     tags: [Auth]
 *     summary: Validate current session and return user status
 *     description: >
 *       Validates the current access token and returns basic user info.
 *       Useful for the frontend to check if a session is still valid
 *       on app startup or after navigation.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session is valid
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
 *                         userId:
 *                           type: string
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *                         accountStatus:
 *                           type: string
 *                         isEmailVerified:
 *                           type: boolean
 *       401:
 *         description: Invalid or expired token
 */
authRouter.get(
  "/check",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authService.getMe(req.user!.userId)
      sendSuccess(res, {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        isEmailVerified: user.isEmailVerified,
      })
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset email
 *     description: >
 *       Sends a password reset link to the user's email if the account exists.
 *       Always returns success to prevent email enumeration attacks.
 *       Rate limited to 3 requests per minute per IP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - turnstileToken
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               turnstileToken:
 *                 type: string
 *                 description: Cloudflare Turnstile token
 *     responses:
 *       200:
 *         description: If the email exists, a reset link has been sent
 *       400:
 *         description: Turnstile verification failed
 *       429:
 *         description: Too many requests
 */
authRouter.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validateRequest(forgotPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.forgotPassword(req.body.email, req.body.turnstileToken)
      sendSuccess(res, null, "If an account exists with this email, a password reset link has been sent.")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using a valid reset token
 *     description: >
 *       Resets the user's password and revokes all existing sessions.
 *       The reset token is obtained from the password reset email
 *       along with the user's email address.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - token
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address (from the reset link)
 *               token:
 *                 type: string
 *                 description: Reset token from the password reset email
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: New password (min 8 characters)
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Password too short
 *       410:
 *         description: Reset token invalid or expired
 */
authRouter.post(
  "/reset-password",
  resetPasswordLimiter,
  validateRequest(resetPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.resetPassword(
        req.body.email,
        req.body.token,
        req.body.password,
      )
      sendSuccess(res, null, "Password reset successfully. Please login with your new password.")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /auth/set-password:
 *   post:
 *     tags: [Auth]
 *     summary: Set or change password
 *     description: >
 *       Sets a password for Google-linked accounts (enables email-password login).
 *       Changes the password for existing email-password accounts (requires currentPassword).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: New password (min 8 characters)
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 description: Current password (required if changing an existing password)
 *     responses:
 *       200:
 *         description: Password set successfully
 *       400:
 *         description: Password too short or missing current password
 *       401:
 *         description: Current password incorrect
 */
authRouter.post(
  "/set-password",
  authenticate,
  validateRequest(setPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.setPassword(
        req.user!.userId,
        req.body.password,
        req.body.currentPassword,
      )
      const msg = req.body.currentPassword
        ? "Password changed successfully"
        : "Password set successfully. You can now log in with email and password."
      sendSuccess(res, null, msg)
    } catch (err) {
      next(err)
    }
  },
)
