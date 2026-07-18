import { Router } from "express"
import { sendSuccess } from "../../utils/response.js"

export const healthRouter: Router = Router()

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 *     responses:
 *       200:
 *         description: API is healthy
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
 *                         status:
 *                           type: string
 *                           example: ok
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 */
healthRouter.get("/", (_req, res) => {
  sendSuccess(res, { status: "ok", timestamp: new Date().toISOString() })
})
