import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { type Request } from "express"
import { razorpayWebhookRouter } from "./razorpay.webhook.js"

/**
 * Webhook route tests. The signature check uses the RAW request body (stashed
 * by the express.json verify hook) — this app-level verify is reproduced here
 * so the route is tested exactly as it runs in production.
 */
const mocks = vi.hoisted(() => ({
  validateSignature: vi.fn(),
  processWebhook: vi.fn(),
  webhookSecret: { value: "whsec_test" },
}))

vi.mock("razorpay", () => ({
  default: { validateWebhookSignature: mocks.validateSignature },
}))
vi.mock("../payment/payment.service.js", () => ({
  paymentService: { processWebhook: mocks.processWebhook },
}))
vi.mock("../../config/index.js", () => ({
  config: {
    get RAZORPAY_WEBHOOK_SECRET() {
      return mocks.webhookSecret.value
    },
  },
}))
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}))

const app = express()
app.use(
  express.json({
    verify: (req, _res, buf) => {
      ;(req as Request & { rawBody?: string }).rawBody = buf.toString("utf8")
    },
  }),
)
app.use(razorpayWebhookRouter)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.webhookSecret.value = "whsec_test"
})

describe("POST /razorpay", () => {
  it("rejects a missing signature before any processing", async () => {
    const res = await request(app).post("/razorpay").send({ event: "payment.captured" })

    expect(res.status).toBe(400)
    expect(mocks.processWebhook).not.toHaveBeenCalled()
  })

  it("rejects an invalid HMAC signature", async () => {
    mocks.validateSignature.mockReturnValue(false)

    const res = await request(app)
      .post("/razorpay")
      .set("x-razorpay-signature", "forged")
      .send({ event: "payment.captured" })

    expect(res.status).toBe(400)
    expect(mocks.validateSignature).toHaveBeenCalledWith(
      expect.stringContaining("payment.captured"),
      "forged",
      "whsec_test",
    )
    expect(mocks.processWebhook).not.toHaveBeenCalled()
  })

  it("dispatches a valid signed event to the payment service", async () => {
    mocks.validateSignature.mockReturnValue(true)
    mocks.processWebhook.mockResolvedValue({ handled: true })

    const res = await request(app)
      .post("/razorpay")
      .set("x-razorpay-signature", "valid_sig")
      .send({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1" } } } })

    expect(res.status).toBe(200)
    expect(mocks.validateSignature).toHaveBeenCalledWith(
      expect.stringContaining("payment.captured"),
      "valid_sig",
      "whsec_test",
    )
    expect(mocks.processWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ event: "payment.captured" }),
    )
  })

  it("returns 503 when the webhook secret is not configured", async () => {
    mocks.webhookSecret.value = ""

    const res = await request(app)
      .post("/razorpay")
      .set("x-razorpay-signature", "whatever")
      .send({ event: "payment.captured" })

    expect(res.status).toBe(503)
    expect(mocks.validateSignature).not.toHaveBeenCalled()
  })
})
