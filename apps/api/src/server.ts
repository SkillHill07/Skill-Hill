import { createApp } from "./app.js"
import { config } from "./config/index.js"
import { connectRedis, redis } from "./config/redis.js"
import { connectMongo, disconnectMongo } from "./config/mongodb.js"
import { validateEnv } from "./utils/validate-env.js"
import { logger } from "./utils/logger.js"
import { startContestWorker } from "./jobs/contest.worker.js"
import { startJudgeWorker } from "./modules/judge/index.js"
import { seedDefaultLanguages } from "./modules/language/index.js"
import { initSocketServer, closeSocketServer } from "./sockets/index.js"

async function bootstrap() {
  // Validate environment variables before starting
  validateEnv()

  // MongoDB is required — fail fast if it can't connect
  await connectMongo()

  // Seed the default language catalog (idempotent — existing entries untouched)
  await seedDefaultLanguages()

  // Connect to Redis (non-blocking — app starts even if Redis is down)
  connectRedis().catch((err) => {
    logger.warn({ err: (err as Error).message }, "redis_connection_error")
  })

  const app = await createApp()

  // Start the contest job worker (freeze/settle) in-process for Phase 2.
  // Extract to a separate process when job volume grows (see jobs/contest.worker.ts).
  startContestWorker()

  // Start the judge worker (Phase 4). Untrusted code runs in Docker containers
  // from this worker — never on the request path. Requires Docker on the host
  // (set DOCKER_HOST on Windows: npipe:////./pipe/docker_engine).
  startJudgeWorker()

  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "api_listening")
  })

  // Real-time submission status push (Phase 4 task 8) — authenticated sockets
  // join user rooms; judge/submission services emit queued/running/completed.
  initSocketServer(server)

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutdown_started")
    closeSocketServer()
    server.close()
    try {
      await disconnectMongo()
      await redis.quit()
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "shutdown_cleanup_error")
    }
    process.exit(0)
  }

  process.on("SIGINT", () => void shutdown("SIGINT"))
  process.on("SIGTERM", () => void shutdown("SIGTERM"))
}

bootstrap().catch((err) => {
  logger.error({ err }, "bootstrap_failed")
  process.exit(1)
})
