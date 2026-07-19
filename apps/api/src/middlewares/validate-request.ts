import type { Request, Response, NextFunction } from "express"
import type { ZodSchema } from "zod"
import { sendError } from "../utils/response.js"

/**
 * Middleware factory: Validates request body, query, and params against a Zod schema.
 * Attaches validated data back to req.body.
 */
export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    })

    if (!result.success) {
      const firstError = result.error.errors[0]
      const field = firstError.path.filter((p) => typeof p === "string").join(".")
      const message = firstError.message

      sendError(
        res,
        `Validation failed: ${field ? `${field} — ` : ""}${message}`,
        400,
        "Validation Error",
      )
      return
    }

    // Replace body with validated data
    req.body = result.data.body
    next()
  }
}
