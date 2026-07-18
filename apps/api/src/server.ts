import { createApp } from "./app.js"
import { config } from "./config/index.js"

async function bootstrap() {
  const app = await createApp()

  app.listen(config.PORT, () => {
    console.log(`api listening on :${config.PORT}`)
  })
}

bootstrap().catch((err) => {
  console.error("failed to bootstrap", err)
  process.exit(1)
})
