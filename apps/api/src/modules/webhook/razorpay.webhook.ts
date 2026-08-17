import { Router, type Request } from "express"
import Razorpay from "razorpay"
import { paymentService } from "../payment/payment.service.js"
import { config } from "../../config/index.js"
import { logger } from "../../utils/logger.js"

/**
 * Razorpay webhook — the ONLY payment confirmation channel. No auth
 * middleware: trust comes from the HMAC signature over the exact raw request
 * body (`x-razorpay-signature`), captured into `req.rawBody` by the global
 * `express.json({ verify })` hook before parsing. Never trust a client-side
 * `payment.success` callback.
 */
export const razorpayWebhookRouter: Router = Router()

razorpayWebhookRouter.post(
  "/razorpay",
  async (req: Request, res) => {
    const signature = req.headers["x-razorpay-signature"]
    const rawBody = (req as Request & { rawBody?: string }).rawBody

    if (!config.RAZORPAY_WEBHOOK_SECRET) {
      return res
        .status(503)
        .json({ success: false, error: "Webhooks are not configured" })
    }
    if (!signature || typeof signature !== "string" || !rawBody) {
      return res
        .status(400)
        .json({ success: false, error: "Missing signature or request body" })
    }

    const valid = Razorpay.validateWebhookSignature(
      rawBody,
      signature,
      config.RAZORPAY_WEBHOOK_SECRET,
    )
    if (!valid) {
      logger.warn({ ip: req.ip }, "webhook_signature_invalid")
      return res.status(400).json({ success: false, error: "Invalid signature" })
    }

    try {
      await paymentService.processWebhook(req.body)
      // Always 200 for recognized/ignored events — a non-2xx here makes
      // Razorpay retry, and most of the ~40 event types are irrelevant to us.
      return res.status(200).json({ success: true })
    } catch (err) {
      // Real processing failure (DB error etc.) — 500 signals Razorpay to retry.
      logger.error({ err: (err as Error).message }, "webhook_processing_error")
      return res.status(500).json({ success: false, error: "Processing failed" })
    }
  },
)
