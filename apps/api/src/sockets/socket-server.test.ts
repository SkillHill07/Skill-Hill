import { describe, it, expect } from "vitest"
import type { Socket } from "socket.io"
import { extractTokenFromHandshake } from "./socket-server.js"

/**
 * Unit tests for the three handshake auth paths: auth.token, Authorization
 * Bearer header, and the accessToken cookie (primary browser flow).
 */
function handshake(overrides: Partial<Socket["handshake"]> = {}): Socket {
  return {
    handshake: { auth: {}, headers: {}, ...overrides },
  } as unknown as Socket
}

describe("extractTokenFromHandshake", () => {
  it("reads the token from handshake auth (auth.token)", () => {
    expect(extractTokenFromHandshake(handshake({ auth: { token: "jwt-abc" } }))).toBe(
      "jwt-abc",
    )
  })

  it("reads the token from the Authorization Bearer header", () => {
    expect(
      extractTokenFromHandshake(
        handshake({ headers: { authorization: "Bearer jwt-abc" } }),
      ),
    ).toBe("jwt-abc")
  })

  it("reads the token from the accessToken cookie", () => {
    expect(
      extractTokenFromHandshake(
        handshake({ headers: { cookie: "theme=dark; accessToken=jwt-cookie; other=1" } }),
      ),
    ).toBe("jwt-cookie")
  })

  it("handles a cookie value containing '=' (base64-style padding)", () => {
    expect(
      extractTokenFromHandshake(
        handshake({ headers: { cookie: "accessToken=abc=def==" } }),
      ),
    ).toBe("abc=def==")
  })

  it("returns null when no token is present", () => {
    expect(extractTokenFromHandshake(handshake())).toBeNull()
    expect(
      extractTokenFromHandshake(handshake({ headers: { cookie: "theme=dark" } })),
    ).toBeNull()
  })
})
