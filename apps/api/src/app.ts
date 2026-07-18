import express, { type Express } from "express"
import helmet from "helmet"
import cors from "cors"
import { healthRouter } from "./modules/health/health.routes.js"
import { errorHandler } from "./middlewares/error-handler.js"

export async function createApp(): Promise<Express> {
  const app = express()

  app.use(helmet())
  app.use(cors())
  app.use(express.json())

  app.use("/health", healthRouter)

  app.use(errorHandler)

  return app
}
