import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Server } from "socket.io"
import { setIO, emitToUser, isSocketServerReady } from "./emitter.js"

describe("emitToUser", () => {
  beforeEach(() => {
    setIO(null)
  })

  it("is a silent no-op before the socket server is initialized", () => {
    expect(isSocketServerReady()).toBe(false)
    expect(() => emitToUser("user-1", "submission:queued", { ok: true })).not.toThrow()
  })

  it("emits to the user's room when the socket server is initialized", () => {
    const emit = vi.fn()
    const to = vi.fn(() => ({ emit }))
    setIO({ to } as unknown as Server)

    emitToUser("user-1", "submission:queued", { submissionId: "s1" })

    expect(isSocketServerReady()).toBe(true)
    expect(to).toHaveBeenCalledWith("user:user-1")
    expect(emit).toHaveBeenCalledWith("submission:queued", { submissionId: "s1" })
  })

  it("keeps different users in separate rooms", () => {
    const emit = vi.fn()
    const to = vi.fn(() => ({ emit }))
    setIO({ to } as unknown as Server)

    emitToUser("user-2", "submission:completed", { status: "accepted" })

    expect(to).toHaveBeenCalledWith("user:user-2")
    expect(emit).toHaveBeenCalledWith("submission:completed", { status: "accepted" })
  })
})
