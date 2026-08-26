import { Router } from "express"
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  linkGoogleAccount,
  createOAuthState,
  consumeOAuthState,
} from "../services/auth-google.service.js"
import { authenticate } from "../middleware/auth.middleware.js"
import { config } from "../../../config/index.js"
import { sendError, sendSuccess } from "../../../utils/response.js"
import { setAuthCookies } from "../../../utils/cookies.js"
import { logger } from "../../../utils/logger.js"
import type { Request, Response, NextFunction } from "express"

export const googleAuthRouter: Router = Router()

/**
 * @openapi
 * /auth/google:
 *   get:
 *     tags: [Auth - Google OAuth]
 *     summary: Initiate Google OAuth sign-in
 *     description: >
 *       Redirects the user to Google's consent screen.
 *       The frontend should open this URL in a new window/tab,
 *       and listen for the redirect back to /auth/google/callback.
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth consent screen
 *       503:
 *         description: Google OAuth not configured (missing GOOGLE_CLIENT_ID)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
googleAuthRouter.get("/", async (_req: Request, res: Response) => {
  if (!config.GOOGLE_CLIENT_ID) {
    res.status(503).json({
      success: false,
      error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    })
    return
  }

  const state = await createOAuthState()
  const authUrl = getGoogleAuthUrl(state)
  res.redirect(authUrl)
})

/**
 * @openapi
 * /auth/google/callback:
 *   get:
 *     tags: [Auth - Google OAuth]
 *     summary: Google OAuth callback
 *     description: >
 *       Google redirects to this URL after the user consents.
 *       The authorization code is exchanged for tokens, and
 *       the user is created or logged in. Session cookies are set
 *       (HttpOnly) and the browser is redirected to the frontend.
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code from Google
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: One-time CSRF state issued by GET /auth/google
 *       - in: query
 *         name: error
 *         required: false
 *         schema:
 *           type: string
 *         description: Error from Google (if user denied consent)
 *     responses:
 *       302:
 *         description: >
 *           Redirects to the frontend with session cookies set.
 *           On success: {FRONTEND_URL}/auth/callback?isNewUser=true|false
 *           On error: {FRONTEND_URL}/auth/callback?error=...
 *       400:
 *         description: Missing authorization code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
googleAuthRouter.get(
  "/callback",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, state, error: googleError } = req.query

      const frontendUrl = config.FRONTEND_URL
      const fail = (message: string) =>
        res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(message)}`)

      // Handle user denying consent
      if (googleError) {
        fail("Google sign-in was cancelled")
        return
      }

      // CSRF protection: state must be a value we issued and not yet consumed
      if (typeof state !== "string" || !(await consumeOAuthState(state))) {
        logger.warn("google_oauth_failed: invalid_state")
        fail("Sign-in session expired. Please try again.")
        return
      }

      if (!code || typeof code !== "string") {
        sendError(res, "Missing authorization code", 400)
        return
      }

      const { tokens, isNewUser } = await handleGoogleCallback(code)

      // Set HttpOnly cookies on the API domain
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken)

      // Redirect to frontend — tokens are in cookies, never in the URL
      res.redirect(`${frontendUrl}/auth/callback?isNewUser=${isNewUser}`)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /auth/google/link:
 *   post:
 *     tags: [Auth - Google OAuth]
 *     summary: Link Google account to the currently logged-in user
 *     description: >
 *       Allows users who registered via email-password to link their Google account.
 *       After linking, they can sign in with either method.
 *       Requires an authorization code obtained from the Google OAuth flow.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 description: Authorization code from Google OAuth flow
 *     responses:
 *       200:
 *         description: Google account linked successfully
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
 *       409:
 *         description: Google account already linked to another user
 */
googleAuthRouter.post(
  "/link",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    if (!config.GOOGLE_CLIENT_ID) {
      res.status(503).json({
        success: false,
        error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      })
      return
    }

    try {
      const { code } = req.body
      if (!code || typeof code !== "string") {
        sendError(res, "Authorization code is required", 400)
        return
      }

      const { user } = await linkGoogleAccount(req.user!.userId, code)
      sendSuccess(res, user, "Google account linked successfully")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /auth/google/url:
 *   get:
 *     tags: [Auth - Google OAuth]
 *     summary: Get Google OAuth URL (for AJAX/SDK flows)
 *     description: >
 *       Returns the Google OAuth URL as JSON instead of redirecting.
 *       Useful for popup-based OAuth flows where the frontend
 *       opens the URL in a new window.
 *     responses:
 *       200:
 *         description: Google OAuth URL
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
 *                         url:
 *                           type: string
 *                           description: Google OAuth consent URL
 *       503:
 *         description: Google OAuth not configured
 */
googleAuthRouter.get("/url", async (_req: Request, res: Response) => {
  if (!config.GOOGLE_CLIENT_ID) {
    res.status(503).json({
      success: false,
      error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    })
    return
  }

  const state = await createOAuthState()
  const authUrl = getGoogleAuthUrl(state)
  sendSuccess(res, { url: authUrl })
})
