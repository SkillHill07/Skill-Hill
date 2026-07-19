import type { Role } from "@skillcontest/shared-types"

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string
        email: string
        role: Role
      }
    }
  }
}

export {}
