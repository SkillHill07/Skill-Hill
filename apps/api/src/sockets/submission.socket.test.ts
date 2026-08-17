import { describe, it, expect, vi, beforeAll, afterAll } from "vitest"
import { createServer, type Server as HttpServer } from "http"
import type { AddressInfo } from "net"
import { io as ioc, type Socket as ClientSocket } from "socket.io-client"
import type { ISubmission } from "../modules/submission/submission.model.js"
import { initSocketServer, closeSocketServer } from "./socket-server.js"
import { emitToUser } from "./emitter.js"
import { emitSubmissionCompleted } from "./submission.socket.js"

/**
 * Integration tests for the socket.io submission-status delivery:
 *  - handshake auth (valid token accepted, invalid/missing rejected)
 *  - authenticated clients join `user:{userId}` rooms
 *  - emitToUser / emitSubmission* events reach exactly the owning client
 */
vi.mock("../modules/auth/services/auth-jwt.js", () => ({
  verifyAccessToken: vi.fn((token: string) => {
    if (token === "valid-token") {
      return { userId: "user-1", email: "user@test.com", role: "user" }
    }
    if (token === "other-token") {
      return { userId: "user-2", email: "other@test.com", role: "user" }
    }
    throw new Error("jwt verification failed")
  }),
}))
vi.mock("../utils/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn(), debug: vi.fn() },
}))

// Fields are read directly off the document (no toJSON) — mirror a real doc.
const fakeSubmission = {
  _id: "s1",
  userId: "user-1",
  contestId: "c1",
  problemId: "p1",
  status: "accepted",
  totalScore: 100,
  publicPassed: 1,
  publicTotal: 1,
  hiddenPassed: 2,
  hiddenTotal: 2,
  executionTime: 12,
  memoryUsed: 2048,
  compilerOutput: null,
  judgedAt: new Date("2026-01-01T00:00:00.000Z"),
} as unknown as ISubmission

let httpServer: HttpServer
let url: string
let client: ClientSocket | null = null

async function connectAsync(sock: ClientSocket): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    sock.once("connect", () => resolve())
    sock.once("connect_error", (err) => reject(err))
  })
}

async function waitFor(cond: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("timed out waiting for socket events")
    await new Promise((r) => setTimeout(r, 10))
  }
}

beforeAll(async () => {
  httpServer = createServer()
  initSocketServer(httpServer)
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const { port } = httpServer.address() as AddressInfo
  url = `http://localhost:${port}`
})

afterAll(async () => {
  client?.close()
  closeSocketServer()
  await new Promise((r) => setTimeout(r, 100))
})

describe("socket handshake auth", () => {
  it("rejects connections without a token", async () => {
    const anon = ioc(url, { transports: ["websocket"], reconnection: false })
    const err = await new Promise<Error>((resolve) => {
      const t = setTimeout(() => resolve(new Error("no connect_error received")), 3000)
      anon.once("connect_error", (e) => {
        clearTimeout(t)
        resolve(e)
      })
    })
    anon.close()
    expect(err.message).toBe("Authentication required")
  })

  it("rejects connections with an invalid token", async () => {
    const bad = ioc(url, {
      auth: { token: "bad-token" },
      transports: ["websocket"],
      reconnection: false,
    })
    const err = await new Promise<Error>((resolve) => {
      const t = setTimeout(() => resolve(new Error("no connect_error received")), 3000)
      bad.once("connect_error", (e) => {
        clearTimeout(t)
        resolve(e)
      })
    })
    bad.close()
    expect(err.message).toBe("Invalid or expired token")
  })
})

describe("submission status delivery", () => {
  it("delivers queued/running/completed events to the owning user's room", async () => {
    const events: Array<{ event: string; payload: unknown }> = []
    client = ioc(url, {
      auth: { token: "valid-token" },
      transports: ["websocket"],
      reconnection: false,
    })
    client.on("submission:queued", (p) => events.push({ event: "submission:queued", payload: p }))
    client.on("submission:running", (p) => events.push({ event: "submission:running", payload: p }))
    client.on("submission:completed", (p) =>
      events.push({ event: "submission:completed", payload: p }),
    )
    await connectAsync(client)

    emitToUser("user-1", "submission:queued", { submissionId: "s1", status: "pending" })
    emitToUser("user-1", "submission:running", { submissionId: "s1", status: "running" })
    emitSubmissionCompleted(fakeSubmission)

    await waitFor(() => events.length === 3)

    expect(events[0]).toEqual({
      event: "submission:queued",
      payload: { submissionId: "s1", status: "pending" },
    })
    expect(events[1]).toEqual({
      event: "submission:running",
      payload: { submissionId: "s1", status: "running" },
    })
    expect(events[2].event).toBe("submission:completed")
    expect(events[2].payload).toMatchObject({
      submissionId: "s1",
      contestId: "c1",
      problemId: "p1",
      status: "accepted",
      totalScore: 100,
      publicPassed: 1,
      publicTotal: 1,
      hiddenPassed: 2,
      hiddenTotal: 2,
      executionTime: 12,
      memoryUsed: 2048,
      compilerOutput: null,
      judgedAt: "2026-01-01T00:00:00.000Z",
    })
  })

  it("does not deliver events to a different user's room", async () => {
    const received: string[] = []
    const other = ioc(url, {
      auth: { token: "other-token" }, // user-2 — a different room
      transports: ["websocket"],
      reconnection: false,
    })
    other.on("submission:queued", () => received.push("queued"))
    await connectAsync(other)

    // user-1's room is separate — emitting for user-1 must not reach this client.
    emitToUser("user-1", "submission:queued", { submissionId: "s1", status: "pending" })

    await new Promise((r) => setTimeout(r, 150))
    expect(received).toEqual([])
    other.close()
  })
})
