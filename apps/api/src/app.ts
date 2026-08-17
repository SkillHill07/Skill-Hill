import express, { type Express, type Request } from "express"
import helmet from "helmet"
import cors from "cors"
import cookieParser from "cookie-parser"
import swaggerUi from "swagger-ui-express"
import { healthRouter } from "./modules/health/health.routes.js"
import { authRouter } from "./modules/auth/routes/auth.routes.js"
import { googleAuthRouter } from "./modules/auth/routes/auth-google.routes.js"
import { githubAuthRouter } from "./modules/auth/routes/auth-github.routes.js"
import { otpRouter } from "./modules/auth/routes/auth-otp.routes.js"
import { kycRouter } from "./modules/auth/routes/auth-kyc.routes.js"
import { adminKycRouter } from "./modules/auth/routes/auth-admin-kyc.routes.js"
import { adminAccountsRouter } from "./modules/auth/routes/auth-admin-accounts.routes.js"
import { adminAuthRouter } from "./modules/auth/routes/auth-admin-auth.routes.js"
import { contestRouter } from "./modules/contest/contest.routes.js"
import { problemRouter, practiceProblemRouter } from "./modules/problem/problem.routes.js"
import { leaderboardRouter } from "./modules/leaderboard/index.js"
import { languageRouter } from "./modules/language/index.js"
import { submissionRouter, adminSubmissionRouter } from "./modules/submission/index.js"
import { walletRouter, adminWalletRouter } from "./modules/wallet/index.js"
import { paymentRouter, adminPaymentRouter } from "./modules/payment/index.js"
import { razorpayWebhookRouter } from "./modules/webhook/index.js"
import {
  contestPrizeRouter,
  userPrizeRouter,
  publicPrizeRouter,
  adminPrizeRouter,
} from "./modules/prize/index.js"
import { logoRouter } from "./modules/logo/index.js"
import { whyChooseUsRouter } from "./modules/whyChooseUs/index.js"
import { bannerRouter } from "./modules/banner/index.js"
import { faqRouter } from "./modules/faq/index.js"
import { adminAuditRouter } from "./modules/audit/index.js"
import { swaggerSpec } from "./config/swagger.js"
import { errorHandler } from "./middlewares/error-handler.js"
import { config } from "./config/index.js"

export async function createApp(): Promise<Express> {
  const app = express()

  app.use(helmet())
  // Parse allowed origins from comma-separated env var
  const allowedOrigins = config.CORS_ORIGINS.split(",").map((o) => o.trim())

  app.use(
    cors({
      origin(origin, callback) {
        // Allow requests with no origin (server-to-server, mobile apps, curl)
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true)
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`))
        }
      },
      credentials: true,
    }),
  )
  app.use(cookieParser())
  // Capture the raw body so the Razorpay webhook can verify its HMAC over the
  // exact bytes before parsing (must use the raw payload, never req.body).
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        ;(req as Request & { rawBody?: string }).rawBody = buf.toString("utf8")
      },
    }),
  )

  // Public routes
  app.use("/health", healthRouter)

  // Razorpay webhook — no auth (HMAC-verified inside the route)
  app.use("/webhooks", razorpayWebhookRouter)
  app.use("/auth", authRouter)
  app.use("/auth/google", googleAuthRouter)
  app.use("/auth/github", githubAuthRouter)
  app.use("/auth/otp", otpRouter)
  app.use("/auth/kyc", kycRouter)
  app.use("/admin/kyc", adminKycRouter)
  app.use("/admin/accounts", adminAccountsRouter)
  app.use("/admin/auth", adminAuthRouter)

  // Contest platform
  app.use("/contests", contestRouter)
  app.use("/contests", problemRouter)
  app.use("/contests", leaderboardRouter)
  app.use("/contests", submissionRouter)
  app.use("/admin", adminSubmissionRouter)
  app.use("/languages", languageRouter)
  app.use("/problems", practiceProblemRouter)

  // Wallet (central ledger)
  app.use("/wallet", walletRouter)
  app.use("/admin", adminWalletRouter)

  // Payments (Razorpay orders + webhook-driven wallet deposits)
  app.use("/payments", paymentRouter)
  app.use("/admin", adminPaymentRouter)

  // Prizes (distribution + history)
  app.use("/contests", contestPrizeRouter)
  // publicPrizeRouter must precede userPrizeRouter (only the former is public)
  app.use("/prizes", publicPrizeRouter)
  app.use("/prizes", userPrizeRouter)
  app.use("/admin", adminPrizeRouter)

  // Site content (public marketing site)
  app.use(logoRouter)
  app.use(whyChooseUsRouter)
  app.use(bannerRouter)
  app.use(faqRouter)

  // Admin audit trail (read-only view)
  app.use("/admin", adminAuditRouter)

  // API docs
  app.get("/api-docs.json", (_req, res) => {
    res.json(swaggerSpec)
  })
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))

  // Error handling (must be last)
  app.use(errorHandler)

  return app
}
