import type { Server } from "socket.io"

/**
 * Realtime hub. Holds the single socket.io instance so any module (judge,
 * submission, ...) can emit targeted events without importing the server.
 * Initialized once at boot via `setIO`; before that (or in tests) emits are
 * silent no-ops — clients fall back to polling the REST endpoint.
 */
let io: Server | null = null

export function setIO(instance: Server | null): void {
  io = instance
}

export function isSocketServerReady(): boolean {
  return io !== null
}

/**
 * Emit an event to a specific user's room (`user:{userId}`). No-op when the
 * socket server isn't initialized — never throws, never blocks callers.
 */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload)
}
