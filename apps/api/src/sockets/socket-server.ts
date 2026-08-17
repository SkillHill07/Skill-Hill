import { Server, type Socket } from "socket.io"
import type { Server as HttpServer } from "http"
import { createAdapter } from "@socket.io/redis-adapter"
import { config } from "../config/index.js"
import { getRedis } from "../config/redis.js"
import {
  verifyAccessToken,
  type TokenPayload,
} from "../modules/auth/services/auth-jwt.js"
import { logger } from "../utils/logger.js"
import { setIO } from "./emitter.js"

const allowedOrigins = config.CORS_ORIGINS.split(",").map((o) => o.trim())

let io: Server | null = null
// Pub/sub clients created for the Redis adapter (closed on shutdown).
let adapterClients: Array<{ quit: () => Promise<unknown> }> = []

/**
 * Extract the access token from a socket handshake. Order: handshake `auth`
 * (client `io(url, { auth: { token } })`), Authorization: Bearer header, then
 * the `accessToken` cookie (browser flows where the token is HttpOnly).
 * Exported for unit testing.
 */
export function extractTokenFromHandshake(socket: Socket): string | null {
  if (typeof socket.handshake.auth?.token === "string" && socket.handshake.auth.token) {
    return socket.handshake.auth.token
  }

  const authHeader = socket.handshake.headers.authorization
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }

  const cookie = socket.handshake.headers.cookie ?? ""
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name === "accessToken" && rest.length > 0) {
      return rest.join("=")
    }
  }
  return null
}

/**
 * socket.io middleware — verifies the JWT and attaches the user to
 * `socket.data.user`. Connections without a valid token are rejected.
 */
export function createSocketAuthMiddleware() {
  return (socket: Socket, next: (err?: Error) => void): void => {
    const token = extractTokenFromHandshake(socket)
    if (!token) {
      next(new Error("Authentication required"))
      return
    }
    try {
      socket.data.user = verifyAccessToken(token)
      next()
    } catch {
      next(new Error("Invalid or expired token"))
    }
  }
}

/**
 * Attach the socket.io server to the HTTP server and start accepting
 * connections. Each authenticated user joins `user:{userId}` so submission
 * status events reach exactly the owning client. Returns the server instance.
 */
export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  })

  // Multi-instance mode (SOCKET_REDIS_ADAPTER=true): relay broadcasts across
  // processes via Redis pub/sub. The pub/sub clients inherit the app's resilient
  // ioredis options (enableOfflineQueue) — the adapter's publish() is fire-and-
  // forget with no catch, so offline queuing must stay ON to avoid unhandled
  // rejections when Redis hiccups.
  if (config.SOCKET_REDIS_ADAPTER) {
    const pubClient = getRedis().duplicate()
    const subClient = pubClient.duplicate()
    io.adapter(createAdapter(pubClient, subClient))
    adapterClients = [pubClient, subClient]
    logger.info({}, "socket_redis_adapter_enabled")
  }

  io.use(createSocketAuthMiddleware())

  io.on("connection", (socket) => {
    const user = socket.data.user as TokenPayload
    socket.join(`user:${user.userId}`)
    logger.info({ userId: user.userId }, "socket_connected")

    socket.on("disconnect", () => {
      logger.info({ userId: user.userId }, "socket_disconnected")
    })
  })

  setIO(io)
  logger.info({}, "socket_server_started")
  return io
}

/** Close the socket server (graceful shutdown). Disconnects all clients. */
export function closeSocketServer(): void {
  if (io) {
    io.close()
    io = null
    setIO(null)
  }
  for (const client of adapterClients) {
    void client.quit().catch(() => {})
  }
  adapterClients = []
}
