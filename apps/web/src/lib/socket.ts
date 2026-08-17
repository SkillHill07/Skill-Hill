"use client"

import { io, type Socket } from "socket.io-client"
import { API_URL } from "./api"

let socket: Socket | null = null

export interface SubmissionStatusEvent {
  submissionId: string
  contestId: string
  problemId: string
  status: string
  totalScore?: number
  publicPassed?: number
  publicTotal?: number
  hiddenPassed?: number
  hiddenTotal?: number
  executionTime?: number
  memoryUsed?: number
  compilerOutput?: string | null
  judgedAt?: string | null
}

/** Lazily connect once (cookie-based auth is sent automatically). */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    })
  }
  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}
