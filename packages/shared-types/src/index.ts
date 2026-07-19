export type Role = "user" | "admin" | "creator"

export type AccountStatus = "active" | "inactive" | "flagged" | "banned"

export type ContentStatus = "draft" | "published" | "archived" | "deleted"

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface BaseModel {
  _id: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  status: ContentStatus
}

export type AuthProvider = "email" | "google" | "github"

export type KycStatus = "pending" | "verified" | "rejected"

export interface User extends BaseModel {
  firstName: string
  lastName: string
  email: string
  phone: string | null
  phoneCountryCode: string | null
  isEmailVerified: boolean
  isPhoneVerified: boolean
  accountStatus: AccountStatus
  role: Role
  authProvider: AuthProvider
  googleId: string | null
  githubId: string | null
  avatarUrl: string | null
  panVerified: boolean
  kycStatus: KycStatus
  walletBalance: number
  lastLoginAt: string | null
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}


