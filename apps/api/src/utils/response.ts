import type { Response } from "express"

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  status = 200,
) {
  res.status(status).json({ success: true, data, message })
}

export function sendError(
  res: Response,
  error: string,
  status = 400,
  message?: string,
) {
  res.status(status).json({ success: false, error, message })
}
