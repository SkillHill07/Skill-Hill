import express from "express"
import { createServer } from "http"
import { connectRedis } from "../../config/redis.js"
import { initSocketServer, emitToUser } from "../index.js"

/**
 * Fixture for the two-process multi-instance test. Started as a child process:
 *   node --import tsx multi-instance-server.ts <port>
 *
 * Each instance boots a socket.io server (with the Redis adapter when
 * SOCKET_REDIS_ADAPTER=true) and exposes POST /emit so the test can trigger an
 * `emitToUser` on THIS instance and verify the other instance's clients
 * receive it via Redis.
 */
const port = Number(process.argv[2])
if (!Number.isInteger(port)) {
  console.error("usage: multi-instance-server.ts <port>")
  process.exit(1)
}

async function main(): Promise<void> {
  await connectRedis()

  const app = express()
  app.use(express.json())
  app.post("/emit", (req, res) => {
    const { userId, event, payload } = req.body as {
      userId: string
      event: string
      payload: unknown
    }
    emitToUser(userId, event, payload)
    res.json({ ok: true })
  })

  const httpServer = createServer(app)
  initSocketServer(httpServer)
  httpServer.listen(port, () => {
    console.log(`READY ${port}`)
  })
}

main().catch((err) => {
  console.error("fixture failed:", err)
  process.exit(1)
})
