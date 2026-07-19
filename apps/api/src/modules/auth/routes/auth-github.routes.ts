import { Router } from "express"
import type { Request, Response, NextFunction } from "express"
import { getGithubAuthUrl, handleGithubCallback, linkGithubAccount } from "../services/auth-github.service.js"
import { authenticate } from "../middleware/auth.middleware.js"
import { config } from "../../../config/index.js"
import { sendError, sendSuccess } from "../../../utils/response.js"
import { setAuthCookies } from "../../../utils/cookies.js"

export const githubAuthRouter: Router = Router()

const NOT_CONFIGURED = "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET."

/**
 * @openapi
 * /auth/github:
 *   get:
 *     tags: [Auth - GitHub OAuth]
 *     summary: Initiate GitHub OAuth sign-in
 *     responses:
 *       302:
 *         description: Redirect to GitHub OAuth consent screen
 *       503:
 *         description: GitHub OAuth not configured
 */
githubAuthRouter.get("/", (_req: Request, res: Response) => {
  if (!config.GITHUB_CLIENT_ID) {
    res.status(503).json({ success: false, error: NOT_CONFIGURED })
    return
  }
  res.redirect(getGithubAuthUrl())
})

/**
 * @openapi
 * /auth/github/callback:
 *   get:
 *     tags: [Auth - GitHub OAuth]
 *     summary: GitHub OAuth callback
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: error
 *         required: false
 *         schema: { type: string }
 *     responses:
 *       302:
 *         description: Redirects to frontend with tokens
 *       400:
 *         description: Missing authorization code
 */
githubAuthRouter.get("/callback", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, error: ghError } = req.query
    if (ghError) {
      res.redirect(`${config.FRONTEND_URL}/auth/callback?error=${encodeURIComponent("GitHub sign-in was cancelled")}`)
      return
    }
    if (!code || typeof code !== "string") {
      sendError(res, "Missing authorization code", 400)
      return
    }
    const { tokens, isNewUser } = await handleGithubCallback(code)
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken)
    res.redirect(
      `${config.FRONTEND_URL}/auth/callback?isNewUser=${isNewUser}`,
    )
  } catch (err) {
    next(err)
  }
})

/**
 * @openapi
 * /auth/github/link:
 *   post:
 *     tags: [Auth - GitHub OAuth]
 *     summary: Link GitHub account to the currently logged-in user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: GitHub account linked successfully
 *       401:
 *         description: Authentication required
 *       409:
 *         description: GitHub account already linked to another user
 */
githubAuthRouter.post("/link", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  if (!config.GITHUB_CLIENT_ID) {
    res.status(503).json({ success: false, error: NOT_CONFIGURED })
    return
  }
  try {
    const { code } = req.body
    if (!code || typeof code !== "string") {
      sendError(res, "Authorization code is required", 400)
      return
    }
    const { user } = await linkGithubAccount(req.user!.userId, code)
    sendSuccess(res, user, "GitHub account linked successfully")
  } catch (err) {
    next(err)
  }
})

/**
 * @openapi
 * /auth/github/url:
 *   get:
 *     tags: [Auth - GitHub OAuth]
 *     summary: Get GitHub OAuth URL (for AJAX/SDK flows)
 *     responses:
 *       200:
 *         description: GitHub OAuth URL
 *       503:
 *         description: GitHub OAuth not configured
 */
githubAuthRouter.get("/url", (_req: Request, res: Response) => {
  if (!config.GITHUB_CLIENT_ID) {
    res.status(503).json({ success: false, error: NOT_CONFIGURED })
    return
  }
  sendSuccess(res, { url: getGithubAuthUrl() })
})
