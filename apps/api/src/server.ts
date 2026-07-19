import { createApp } from "./app.js"
import { config } from "./config/index.js"
import { connectRedis } from "./config/redis.js"

async function bootstrap() {
  // Connect to Redis (non-blocking — app starts even if Redis is down)
  connectRedis().catch((err) => {
    console.warn("Redis connection error:", (err as Error).message)
  })

  const app = await createApp()

  app.listen(config.PORT, () => {
    console.log(`api listening on :${config.PORT}`)
  })
}

bootstrap().catch((err) => {
  console.error("failed to bootstrap", err)
  process.exit(1)
})
