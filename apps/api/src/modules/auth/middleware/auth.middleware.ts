import type { Request, Response, NextFunction } from "express"
import { authService } from "../services/auth.service.js"
import type { Role } from "@skillcontest/shared-types"
import { sendError } from "../../../utils/response.js"
import { logger } from "../../../utils/logger.js"

export type { }

/**
 * Middleware: Requires a valid JWT access token.
 * Attaches decoded user payload to req.user.
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.warn({ ip: req.ip, path: req.path }, "auth_failed: no_token")
      sendError(res, "Authentication required", 401, "No token provided")
      return
    }

    const token = authHeader.split(" ")[1]
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
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1]
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
