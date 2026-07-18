export type Role = "user" | "admin" | "creator"

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
