import { Server, type Socket } from "socket.io"
import type { Server as HttpServer } from "http"
import { config } from "../config/index.js"
import {
  verifyAccessToken,
  type TokenPayload,
} from "../modules/auth/services/auth-jwt.js"
import { logger } from "../utils/logger.js"
import { setIO } from "./emitter.js"

const allowedOrigins = config.CORS_ORIGINS.split(",").map((o) => o.trim())

let io: Server | null = null

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

  // Single-instance mode: broadcasts reach clients connected to this process
  // only. Multi-instance relay is NOT available — Upstash Redis (REST) has no
  // pub/sub, so the old @socket.io/redis-adapter path was removed. If the API
  // ever scales to 2+ instances, revisit with a TCP Redis or a broker.
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
}
