import express, { type Express } from "express"
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
import { swaggerSpec } from "./config/swagger.js"
import { errorHandler } from "./middlewares/error-handler.js"
import { config } from "./config/index.js"

export async function createApp(): Promise<Express> {
  const app = express()

  app.use(helmet())
  app.use(
    cors({
      origin: config.FRONTEND_URL,
      credentials: true,
    }),
  )
  app.use(cookieParser())
  app.use(express.json())

  // Public routes
  app.use("/health", healthRouter)
  app.use("/auth", authRouter)
  app.use("/auth/google", googleAuthRouter)
  app.use("/auth/github", githubAuthRouter)
  app.use("/auth/otp", otpRouter)
  app.use("/auth/kyc", kycRouter)
  app.use("/admin/kyc", adminKycRouter)
  app.use("/admin/accounts", adminAccountsRouter)

  // API docs
  app.get("/api-docs.json", (_req, res) => {
    res.json(swaggerSpec)
  })
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))

  // Error handling (must be last)
  app.use(errorHandler)

  return app
}
