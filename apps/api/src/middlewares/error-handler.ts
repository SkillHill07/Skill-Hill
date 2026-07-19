import type { Request, Response, NextFunction } from "express"
import { sendError } from "../utils/response.js"
import { logger } from "../utils/logger.js"

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const errWithMeta = err as { status?: number; code?: string }
  const status = errWithMeta.status ?? 500
  const code = errWithMeta.code
  const error = status === 500 && process.env.NODE_ENV === "production"
    ? "internal server error"
    : err.message

  if (status >= 500) {
    logger.error({
      err,
      code,
      path: req.path,
      method: req.method,
      ip: req.ip,
    }, "internal_server_error")
  } else if (status >= 400) {
    logger.warn({
      err: err.message,
      code,
      path: req.path,
      method: req.method,
      ip: req.ip,
    }, `request_error: ${code || "client_error"}`)
  }

  sendError(res, error, status, undefined, code)
}
