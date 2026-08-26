import crypto from "crypto"
import { config } from "../../../config/index.js"
import { redis } from "../../../config/redis.js"
import { User, type IUser } from "../auth.schema.js"
import type { LoginBody, RegisterBody, UpdateProfileBody } from "../auth.validators.js"
import type { AuthTokens } from "@skillcontest/shared-types"
import type { Role } from "@skillcontest/shared-types"
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  storeRefreshToken,
  removeRefreshToken,
  isTokenRevoked,
  revokeAllUserTokens,
  pushRefreshToken,
} from "./auth-jwt.js"
import { sendEmail } from "../../../utils/email.js"
import { logger } from "../../../utils/logger.js"
import { verifyTurnstile } from "../../../utils/turnstile.js"
import { cacheGet, cacheSet, cacheDel, cacheKeys } from "../../../utils/cache.js"

export { verifyAccessToken, revokeAllUserTokens }


async function registerUser(
  input: RegisterBody,
): Promise<{ user: IUser; tokens: AuthTokens }> {
  const turnstileValid = await verifyTurnstile(input.turnstileToken)
  if (!turnstileValid) {
    logger.warn({ email: input.email }, "register_failed: turnstile")
    throw Object.assign(new Error("Turnstile verification failed"), {
      status: 400,
      code: "TURNSTILE_FAILED",
    })
  }

  const existingUser = await User.findOne({ email: input.email }).lean()
  if (existingUser) {
    logger.warn({ email: input.email }, "register_failed: email_exists")
    throw Object.assign(new Error("Email already registered"), {
      status: 409,
      code: "EMAIL_EXISTS",
    })
  }

  const user = await User.create({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    password: input.password,
  })

  const payload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  }

  const accessToken = generateAccessToken(payload)
  const refreshToken = generateRefreshToken(payload)

  await storeRefreshToken(payload.userId, refreshToken)

  user.refreshTokens = [refreshToken]
  await user.save({ validateBeforeSave: false })

  logger.info({ userId: user._id.toString(), email: user.email }, "user_registered")

  return {
    user,
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: config.ACCESS_TOKEN_EXPIRY_SECONDS,
    },
  }
}

async function loginUser(
  input: LoginBody,
): Promise<{ user: IUser; tokens: AuthTokens }> {
  const turnstileValid = await verifyTurnstile(input.turnstileToken)
  if (!turnstileValid) {
    throw Object.assign(new Error("Turnstile verification failed"), {
      status: 400,
      code: "TURNSTILE_FAILED",
    })
  }

  const user = await User.findOne({ email: input.email }).select("+password +refreshTokens")
  if (!user) {
    logger.warn({ email: input.email }, "login_failed: user_not_found")
    throw Object.assign(new Error("Invalid email or password"), {
      status: 401,
      code: "INVALID_CREDENTIALS",
    })
  }

  if (user.accountStatus === "banned") {
    logger.warn({ userId: user._id.toString(), email: user.email }, "login_failed: banned")
    throw Object.assign(
      new Error("Your account has been banned. Please contact support."),
      { status: 403, code: "ACCOUNT_BANNED" },
    )
  }

  if (user.accountStatus === "flagged") {
    logger.warn({ userId: user._id.toString(), email: user.email }, "login_failed: flagged")
    throw Object.assign(
      new Error("Your account is under review. Please contact support."),
      { status: 403, code: "ACCOUNT_FLAGGED" },
    )
  }

  // Users without a password must use Google sign-in
  if (!user.password) {
    logger.warn({ userId: user._id.toString(), email: user.email }, "login_failed: no_password_set")
    throw Object.assign(
      new Error("This account has no password set. Please sign in with Google or set a password first."),
      { status: 400, code: "NO_PASSWORD_SET" },
    )
  }

  const isPasswordValid = await user.comparePassword(input.password)
  if (!isPasswordValid) {
    logger.warn({ userId: user._id.toString(), email: user.email }, "login_failed: wrong_password")
    throw Object.assign(new Error("Invalid email or password"), {
      status: 401,
      code: "INVALID_CREDENTIALS",
    })
  }

  const payload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  }

  const accessToken = generateAccessToken(payload)
  const refreshToken = generateRefreshToken(payload)

  await storeRefreshToken(payload.userId, refreshToken)

  user.lastLoginAt = new Date()
  user.refreshTokens = pushRefreshToken(user.refreshTokens, refreshToken)
  await user.save({ validateBeforeSave: false })

  logger.info({ userId: user._id.toString(), email: user.email }, "user_logged_in")

  return {
    user,
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: config.ACCESS_TOKEN_EXPIRY_SECONDS,
    },
  }
}

async function refreshTokens(
  currentRefreshToken: string,
): Promise<{ user: IUser; tokens: AuthTokens }> {
  let payload
  try {
    payload = verifyRefreshToken(currentRefreshToken)
  } catch {
    logger.warn({ userId: "unknown" }, "refresh_failed: invalid_token")
    throw Object.assign(new Error("Invalid or expired refresh token"), {
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    })
  }

  const revoked = await isTokenRevoked(payload.userId, currentRefreshToken)
  if (revoked) {
    logger.warn({ userId: payload.userId }, "refresh_failed: token_revoked")
    await revokeAllUserTokens(payload.userId)
    await User.findByIdAndUpdate(payload.userId, { refreshTokens: [] })
    throw Object.assign(
      new Error("Refresh token has been revoked. Please login again."),
      { status: 401, code: "TOKEN_REVOKED" },
    )
  }

  await removeRefreshToken(payload.userId, currentRefreshToken)

  const newPayload = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  }

  const accessToken = generateAccessToken(newPayload)
  const refreshToken = generateRefreshToken(newPayload)

  await storeRefreshToken(payload.userId, refreshToken)

  // refreshTokens is select:false in the schema — it must be explicitly
  // included or the array read below crashes (undefined.filter).
  const user = await User.findById(payload.userId).select("+refreshTokens")
  if (!user) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
      code: "USER_NOT_FOUND",
    })
  }

  user.refreshTokens = pushRefreshToken(
    user.refreshTokens.filter((t) => t !== currentRefreshToken),
    refreshToken,
  )
  await user.save({ validateBeforeSave: false })

  logger.info({ userId: payload.userId }, "tokens_refreshed")

  return {
    user,
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: config.ACCESS_TOKEN_EXPIRY_SECONDS,
    },
  }
}

async function logoutUser(
  userId: string,
  refreshToken: string,
): Promise<void> {
  await removeRefreshToken(userId, refreshToken)
  await User.findByIdAndUpdate(userId, {
    $pull: { refreshTokens: refreshToken },
  })
  logger.info({ userId }, "user_logged_out")
}

async function getMe(userId: string): Promise<IUser> {
  // Try cache first
  const cached = await cacheGet<IUser>(cacheKeys.userProfile(userId))
  if (cached) return cached as IUser

  const user = await User.findById(userId).lean()
  if (!user) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
      code: "USER_NOT_FOUND",
    })
  }

  // Cache for 60s (user data rarely changes between requests)
  await cacheSet(cacheKeys.userProfile(userId), user)
  return user as unknown as IUser
}

async function updateProfile(
  userId: string,
  input: UpdateProfileBody & { avatarUrl?: string | null },
): Promise<IUser> {
  const user = await User.findById(userId)
  if (!user) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
      code: "USER_NOT_FOUND",
    })
  }

  if (input.firstName !== undefined) {
    user.firstName = input.firstName
  }
  if (input.lastName !== undefined) {
    user.lastName = input.lastName
  }
  if (input.phone !== undefined) {
    user.phone = input.phone
  }
  if (input.phoneCountryCode !== undefined) {
    user.phoneCountryCode = input.phoneCountryCode
  }
  if (input.avatarUrl !== undefined) {
    user.avatarUrl = input.avatarUrl
  }

  // If phone is removed, also reset verification
  if (input.phone === null) {
    user.isPhoneVerified = false
  }

  await user.save({ validateBeforeSave: true })

  // Invalidate profile cache
  await cacheDel(cacheKeys.userProfile(userId))

  logger.info({ userId }, "profile_updated")

  return user
}

// --- Forgot / Reset Password ---

const RESET_TOKEN_TTL_SECONDS = 15 * 60 // 15 minutes

function generateResetToken(): string {
  const bytes = crypto.randomBytes(32)
  return bytes.toString("hex")
}

function getResetKey(email: string, token: string): string {
  return `reset:${email}:${token}`
}

/**
 * Initiate a forgot-password flow.
 * Generates a reset token, stores it in Redis, and sends a reset link via email.
 * Always returns success regardless of whether the email exists (to prevent email enumeration).
 */
export async function forgotPassword(
  email: string,
  turnstileToken: string,
): Promise<void> {
  // Verify Turnstile
  const turnstileValid = await verifyTurnstile(turnstileToken)
  if (!turnstileValid) {
    throw Object.assign(new Error("Turnstile verification failed"), {
      status: 400,
      code: "TURNSTILE_FAILED",
    })
  }

  // Always return success to prevent email enumeration.
  // Only send email if the user actually exists.
  const user = await User.findOne({ email }).select("+password").lean()
  if (!user) {
    return
  }

  // Users without a password can't use password reset
  if (!user.password) {
    return
  }

  // Check account status
  if (user.accountStatus === "banned" || user.accountStatus === "flagged") {
    return
  }

  // Generate and store reset token
  const token = generateResetToken()
  const resetKey = getResetKey(email, token)
  await redis.setex(resetKey, RESET_TOKEN_TTL_SECONDS, user._id.toString())

  logger.info({ userId: user._id.toString(), email }, "forgot_password_email_sent")

  // Send email with reset link
  const resetLink = `${config.FRONTEND_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`

  await sendEmail({
    to: email,
    subject: "Reset Your SkillHill Password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Reset Your Password</h2>
        <p>Hi ${user.firstName},</p>
        <p>We received a request to reset your password. Click the button below to set a new one:</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" style="
            display: inline-block;
            background: #1a1a2e;
            color: white;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
          ">Reset Password</a>
        </div>
        <p style="color: #666;">
          This link expires in <strong>15 minutes</strong>.
          If you didn't request this, you can safely ignore this email.
        </p>
        <p style="color: #999; font-size: 12px;">
          Or copy this link into your browser:<br />
          <span style="color: #666;">${resetLink}</span>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">
          SkillHill — Skill-based coding contest platform
        </p>
      </div>
    `,
    text: `Reset your SkillHill password\n\nWe received a request to reset your password. Visit this link to set a new one:\n\n${resetLink}\n\nThis link expires in 15 minutes.\n\nIf you didn't request this, please ignore this email.`,
  })
}

/**
 * Reset the user's password using a valid reset token.
 * On success, updates the password and revokes all existing sessions.
 */
export async function resetPassword(
  email: string,
  token: string,
  newPassword: string,
): Promise<void> {
  // Validate password length
  if (newPassword.length < 8) {
    throw Object.assign(
      new Error("Password must be at least 8 characters"),
      { status: 400, code: "PASSWORD_TOO_SHORT" },
    )
  }

  // Find the reset token in Redis
  const resetKey = getResetKey(email, token)
  const userId = await redis.get(resetKey)

  if (!userId) {
    throw Object.assign(
      new Error("Reset token is invalid or has expired. Please request a new one."),
      { status: 410, code: "RESET_TOKEN_INVALID" },
    )
  }

  // Find user
  const user = await User.findById(userId).select("+password")
  if (!user) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
      code: "USER_NOT_FOUND",
    })
  }

  // Users without a password can't reset via token (no password to reset)
  if (!user.password) {
    await redis.del(resetKey)
    throw Object.assign(
      new Error("This account has no password set. Please sign in with Google or set a password from your profile."),
      { status: 400, code: "NO_PASSWORD_SET" },
    )
  }

  // Update password
  user.password = newPassword
  // Clear all refresh tokens to force re-login
  user.refreshTokens = []
  await user.save()

  // Revoke all refresh tokens in Redis
  await revokeAllUserTokens(user._id.toString())

  // Clean up the reset token
  await redis.del(resetKey)

  logger.info({ userId: user._id.toString(), email }, "password_reset_completed")
}

// --- Delete Account (soft delete) ---

/**
 * Soft-delete the authenticated user's account.
 * Sets `deletedAt` timestamp, clears refresh tokens, and revokes all sessions.
 * The account can potentially be restored by an admin.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const user = await User.findById(userId)
  if (!user) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
      code: "USER_NOT_FOUND",
    })
  }

  if (user.deletedAt) {
    throw Object.assign(
      new Error("Account is already deleted."),
      { status: 400, code: "ALREADY_DELETED" },
    )
  }

  user.deletedAt = new Date()
  user.accountStatus = "inactive"
  user.refreshTokens = []
  await user.save({ validateBeforeSave: false })

  await revokeAllUserTokens(userId)

  // Invalidate profile + kyc caches
  await cacheDel(cacheKeys.userProfile(userId), cacheKeys.kycStatus(userId))

  logger.info({ userId, email: user.email }, "account_deleted")
}

// --- Set Password (for Google-linked accounts to add email-password login) ---

/**
 * Set or change the authenticated user's password.
 * Google users can use this to add email-password login to their account.
 * Email-password users can use this to change their existing password.
 * Requires the current password if one exists.
 */
export async function setPassword(
  userId: string,
  newPassword: string,
  currentPassword?: string,
): Promise<void> {
  if (newPassword.length < 8) {
    throw Object.assign(
      new Error("Password must be at least 8 characters"),
      { status: 400, code: "PASSWORD_TOO_SHORT" },
    )
  }

  const user = await User.findById(userId).select("+password")
  if (!user) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
      code: "USER_NOT_FOUND",
    })
  }

  // If user already has a password, verify current password before allowing change
  if (user.password) {
    if (!currentPassword) {
      throw Object.assign(
        new Error("Current password is required to change your password."),
        { status: 400, code: "CURRENT_PASSWORD_REQUIRED" },
      )
    }

    const isValid = await user.comparePassword(currentPassword)
    if (!isValid) {
      throw Object.assign(
        new Error("Current password is incorrect."),
        { status: 401, code: "INVALID_CURRENT_PASSWORD" },
      )
    }
  }

  // Set the new password (pre-save hook will hash it)
  user.password = newPassword
  await user.save()

  // Invalidate profile cache (authProvider may have changed)
  await cacheDel(cacheKeys.userProfile(userId))

  logger.info({ userId, hasExistingPassword: !!currentPassword }, "password_set_or_changed")
}

// --- Admin Login ---

/**
 * Login with admin/creator role check.
 * Reuses the standard login flow then validates the user has an admin-level role.
 */
const ADMIN_ROLES: Role[] = ["admin", "creator"]

export async function adminLoginUser(
  input: LoginBody,
): Promise<{ user: IUser; tokens: AuthTokens }> {
  // Reuse standard login for credential validation + token generation
  const result = await loginUser(input)

  // Verify the user has an admin-level role
  if (!ADMIN_ROLES.includes(result.user.role)) {
    logger.warn({
      userId: result.user._id.toString(),
      email: result.user.email,
      role: result.user.role,
    }, "admin_login_failed: not_admin")
    throw Object.assign(
      new Error("Access denied. Admin or creator privileges required."),
      { status: 403, code: "ADMIN_REQUIRED" },
    )
  }

  logger.info({
    userId: result.user._id.toString(),
    email: result.user.email,
    role: result.user.role,
  }, "admin_login_success")

  return result
}

export const authService = {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword,
  setPassword,
  deleteAccount,
  verifyAccessToken,
  revokeAllUserTokens,
}
