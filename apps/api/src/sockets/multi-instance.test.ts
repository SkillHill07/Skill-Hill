import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { spawn, type ChildProcess } from "child_process"
import path from "path"
import { fileURLToPath } from "url"
import { io as ioc, type Socket as ClientSocket } from "socket.io-client"
import { generateAccessToken } from "../modules/auth/services/auth-jwt.js"

/**
 * Two-process test for the Redis adapter (SOCKET_REDIS_ADAPTER=true):
 *  1. Spawns TWO real node processes, each running a socket.io server wired to
 *     the same Redis via @socket.io/redis-adapter.
 *  2. A client connects to instance A.
 *  3. An event is emitted on instance B (via its POST /emit trigger).
 *  4. The client on instance A must receive it — proving cross-process relay.
 *
 * Skipped when Redis is unreachable (e.g. CI without Redis): start Redis and
 * re-run to execute.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..", "..", "..")
const FIXTURE = path.join(__dirname, "fixtures", "multi-instance-server.ts")

const PORT_A = 43190
const PORT_B = 43191

async function isRedisAvailable(): Promise<boolean> {
  const Redis = (await import("ioredis")).default
  // Fast-fail probe: no retries, so a down Redis rejects within ~100ms.
  const probe = new Redis({ lazyConnect: true, retryStrategy: () => null })
  try {
    await probe.ping()
    return true
  } catch {
    return false
  } finally {
    probe.disconnect()
  }
}

function spawnInstance(port: number): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", FIXTURE, String(port)],
      {
        cwd: APP_ROOT,
        env: { ...process.env, SOCKET_REDIS_ADAPTER: "true" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
    let out = ""
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`instance ${port}: startup timeout`))
    }, 20000)
    child.stdout?.on("data", (chunk) => {
      out += String(chunk)
      if (out.includes(`READY ${port}`)) {
        clearTimeout(timer)
        resolve(child)
      }
    })
    child.on("error", (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on("exit", (code) => {
      clearTimeout(timer)
      if (code !== 0 && !out.includes(`READY ${port}`)) {
        reject(new Error(`instance ${port} exited early with code ${code}`))
      }
    })
  })
}

// Checked BEFORE the describe block is registered (top-level await) — a
// describe.skipIf condition evaluated inside beforeAll would always skip.
const redisAvailable = await isRedisAvailable()

describe.skipIf(!redisAvailable)("socket.io redis adapter — two processes", () => {
  let childA: ChildProcess | null = null
  let childB: ChildProcess | null = null
  let client: ClientSocket | null = null

  beforeAll(async () => {
    childA = await spawnInstance(PORT_A)
    childB = await spawnInstance(PORT_B)
  }, 60000)

  afterAll(() => {
    client?.close()
    childA?.kill()
    childB?.kill()
  })

  it(
    "relays an event emitted on instance B to a client connected to instance A",
    async () => {
      const token = generateAccessToken({
        userId: "user-1",
        email: "user@test.com",
        role: "user",
      })
      const received: unknown[] = []
      client = ioc(`http://localhost:${PORT_A}`, {
        auth: { token },
        transports: ["websocket"],
        reconnection: false,
      })
      client.on("submission:completed", (payload) => received.push(payload))
      await new Promise<void>((resolve, reject) => {
        client!.on("connect", () => resolve())
        client!.on("connect_error", (err) => reject(err))
      })

      const res = await fetch(`http://localhost:${PORT_B}/emit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "user-1",
          event: "submission:completed",
          payload: { submissionId: "s1", status: "accepted", totalScore: 100 },
        }),
      })
      expect(res.ok).toBe(true)

      const deadline = Date.now() + 5000
      while (received.length === 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50))
      }

      expect(received).toHaveLength(1)
      expect(received[0]).toMatchObject({
        submissionId: "s1",
        status: "accepted",
        totalScore: 100,
      })
    },
    15000,
  )
})
