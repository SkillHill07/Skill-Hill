import type { Request, Response, NextFunction } from "express"
import { authService } from "../services/auth.service.js"
import type { Role } from "@skillcontest/shared-types"
import { sendError } from "../../../utils/response.js"
import { logger } from "../../../utils/logger.js"

export type { }

/**
 * Extract a token from either the Authorization header (Bearer) or the
 * accessToken cookie. Cookie-based auth is used for browser clients;
 * header-based auth is used for mobile apps / programmatic access.
 */
function extractToken(req: Request): string | null {
  // 1. Try Authorization header (Bearer token)
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1]
  }

  // 2. Try accessToken cookie (HttpOnly, set by the server)
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken
  }

  return null
}

/**
 * Extract the refresh token from either the request body or the
 * refreshToken cookie.
 */
export function extractRefreshToken(req: Request): string | null {
  // 1. Try request body
  if (req.body?.refreshToken) {
    return req.body.refreshToken
  }

  // 2. Try refreshToken cookie
  if (req.cookies?.refreshToken) {
    return req.cookies.refreshToken
  }

  return null
}

/**
 * Middleware: Requires a valid JWT access token.
 * Attaches decoded user payload to req.user.
 * Checks the Authorization header first, then falls back to the
 * accessToken cookie.
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const token = extractToken(req)
    if (!token) {
      logger.warn({ ip: req.ip, path: req.path }, "auth_failed: no_token")
      sendError(res, "Authentication required", 401, "No token provided")
      return
    }

    const decoded = authService.verifyAccessToken(token)
    req.user = decoded
    next()
  } catch (error) {
    const isExpired = error instanceof Error && error.name === "TokenExpiredError"
    logger.warn({
      ip: req.ip,
      path: req.path,
      reason: isExpired ? "expired" : "invalid",
    }, isExpired ? "auth_failed: token_expired" : "auth_failed: invalid_token")
    const message = isExpired
      ? "Access token expired"
      : "Invalid access token"
    sendError(res, message, 401, "Authentication failed")
  }
}

/**
 * Middleware: Optionally attaches user if valid token exists, but doesn't block.
 * Checks Authorization header first, then falls back to the accessToken cookie.
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const token = extractToken(req)
    if (token) {
      const decoded = authService.verifyAccessToken(token)
      req.user = decoded
    }
  } catch {
    // Silently ignore invalid tokens for optional auth
  }
  next()
}

/**
 * Middleware factory: Requires the user to have one of the specified roles.
 * Must be used after `authenticate`.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      logger.warn({ ip: req.ip, path: req.path }, "role_check_failed: no_user")
      sendError(res, "Authentication required", 401)
      return
    }

    if (!roles.includes(req.user.role)) {
      logger.warn({
        userId: req.user.userId,
        role: req.user.role,
        requiredRoles: roles,
        path: req.path,
      }, "role_check_failed: insufficient_role")
      sendError(
        res,
        "You do not have permission to perform this action",
        403,
        "Forbidden",
      )
      return
    }

    next()
  }
}
