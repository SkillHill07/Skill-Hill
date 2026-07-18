import express, { type Express } from "express"
import helmet from "helmet"
import cors from "cors"
import swaggerUi from "swagger-ui-express"
import { healthRouter } from "./modules/health/health.routes.js"
import { swaggerSpec } from "./config/swagger.js"
import { errorHandler } from "./middlewares/error-handler.js"

export async function createApp(): Promise<Express> {
  const app = express()

  app.use(helmet())
  app.use(cors())
  app.use(express.json())

  app.use("/health", healthRouter)

  app.get("/api-docs.json", (_req, res) => {
    res.json(swaggerSpec)
  })
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))

  app.use(errorHandler)

  return app
}
