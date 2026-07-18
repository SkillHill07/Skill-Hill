import type { Request, Response, NextFunction } from "express"
import { sendError } from "../utils/response.js"

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = (err as { status?: number }).status ?? 500
  const error = status === 500 && process.env.NODE_ENV === "production"
    ? "internal server error"
    : err.message
  sendError(res, error, status)
}
