import { User, type IUser } from "../auth.schema.js"
import { revokeAllUserTokens } from "./auth-jwt.js"
import { logger } from "../../../utils/logger.js"
import { cacheDel, cacheKeys } from "../../../utils/cache.js"
import type { AccountStatus, Role } from "@skillcontest/shared-types"

// --- Types ---

interface ListUsersFilters {
  accountStatus?: string
  role?: string
  kycStatus?: string
  search?: string
  page?: number
  limit?: number
}

interface ListUsersResult {
  users: Array<{
    _id: string
    firstName: string
    lastName: string
    email: string
    role: Role
    accountStatus: AccountStatus
    isEmailVerified: boolean
    authProvider: string
    kycStatus: string
    panVerified: boolean
    createdAt: Date
    updatedAt: Date
    lastLoginAt: Date | null
  }>
  total: number
  page: number
  limit: number
  totalPages: number
}

// --- Service functions ---

/**
 * List users with optional filtering and pagination.
 * Admin/creator only.
 */
export async function listUsers(
  filters: ListUsersFilters,
): Promise<ListUsersResult> {
  const { accountStatus, role, kycStatus, search, page = 1, limit = 20 } = filters

  // Clamp page and limit
  const safePage = Math.max(1, page)
  const safeLimit = Math.min(Math.max(1, limit), 100)

  // Build query filter
  const query: Record<string, unknown> = {}

  if (accountStatus) {
    query.accountStatus = accountStatus
  }
  if (role) {
    query.role = role
  }
  if (kycStatus) {
    query.kycStatus = kycStatus
  }
  if (search && search.trim().length > 0) {
    // Escape regex special characters to prevent injection
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    query.$or = [
      { firstName: { $regex: escaped, $options: "i" } },
      { lastName: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
    ]
  }

  const skip = (safePage - 1) * safeLimit
  const total = await User.countDocuments(query)
  const totalPages = Math.ceil(total / safeLimit)

  const users = await User.find(query)
    .select("firstName lastName email role accountStatus isEmailVerified authProvider kycStatus panVerified createdAt updatedAt lastLoginAt")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(safeLimit)
    .lean()

  return {
    users: users as unknown as ListUsersResult["users"],
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
  }
}

/**
 * Get full details of a specific user (no decrypted KYC).
 * Admin/creator only.
 */
export async function getUserDetails(userId: string): Promise<IUser> {
  const user = await User.findById(userId).lean()
  if (!user) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
      code: "USER_NOT_FOUND",
    })
  }
  return user as unknown as IUser
}

/**
 * Change a user's account status (ban, unban, flag, activate).
 * Revokes all sessions when banning or flagging.
 * Admin only.
 */
export async function changeUserStatus(
  targetUserId: string,
  newStatus: AccountStatus,
  adminUserId: string,
  reason?: string,
): Promise<{ user: IUser }> {
  const user = await User.findById(targetUserId)
  if (!user) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
      code: "USER_NOT_FOUND",
    })
  }

  // Prevent admin from changing their own status
  if (targetUserId === adminUserId) {
    throw Object.assign(
      new Error("You cannot change your own account status"),
      { status: 400, code: "CANNOT_SELF_MODIFY" },
    )
  }

  const oldStatus = user.accountStatus
  const revokeSessions = newStatus === "banned" || newStatus === "flagged"

  // Set fields before single save
  user.accountStatus = newStatus
  if (revokeSessions) {
    user.refreshTokens = []
  }
  await user.save({ validateBeforeSave: false })

  // Revoke Redis-stored tokens
  if (revokeSessions) {
    await revokeAllUserTokens(targetUserId)
  }

  // Invalidate profile cache
  await cacheDel(cacheKeys.userProfile(targetUserId))

  logger.info({
    action: "account_status_changed",
    targetUserId,
    targetEmail: user.email,
    oldStatus,
    newStatus,
    changedBy: adminUserId,
    reason: reason ?? null,
  }, `account_${newStatus}`)

  return { user }
}

/**
 * Change a user's role (e.g., promote to admin, demote to user).
 * Admin only.
 */
export async function changeUserRole(
  targetUserId: string,
  newRole: Role,
  adminUserId: string,
): Promise<{ user: IUser }> {
  const user = await User.findById(targetUserId)
  if (!user) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
      code: "USER_NOT_FOUND",
    })
  }

  // Prevent admin from changing their own role
  if (targetUserId === adminUserId) {
    throw Object.assign(
      new Error("You cannot change your own role"),
      { status: 400, code: "CANNOT_SELF_MODIFY" },
    )
  }

  const oldRole = user.role
  user.role = newRole
  user.refreshTokens = []
  await user.save({ validateBeforeSave: false })

  // Revoke Redis-stored tokens
  await revokeAllUserTokens(targetUserId)

  // Invalidate profile cache
  await cacheDel(cacheKeys.userProfile(targetUserId))

  logger.info({
    action: "role_changed",
    targetUserId,
    targetEmail: user.email,
    oldRole,
    newRole,
    changedBy: adminUserId,
  }, `role_${newRole}`)

  return { user }
}

export const adminAccountsService = {
  listUsers,
  getUserDetails,
  changeUserStatus,
  changeUserRole,
}
