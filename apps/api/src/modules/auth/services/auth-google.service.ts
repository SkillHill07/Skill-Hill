import crypto from "crypto"
import { config } from "../../../config/index.js"
import { redis } from "../../../config/redis.js"
import { User, type IUser } from "../auth.schema.js"
import type { AuthTokens } from "@skillcontest/shared-types"
import {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  pushRefreshToken,
} from "./auth-jwt.js"
import { logger } from "../../../utils/logger.js"

// --- Google OAuth helpers ---

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

const SCOPES = ["openid", "email", "profile"]

// CSRF protection: one-time state values with a 10-minute TTL.
const OAUTH_STATE_TTL_SECONDS = 600
const OAUTH_STATE_PREFIX = "oauth:state:google:"

export function assertAccountStatus(user: IUser): void {
  if (user.accountStatus === "banned") {
    throw Object.assign(
      new Error("Your account has been banned. Please contact support."),
      { status: 403, code: "ACCOUNT_BANNED" },
    )
  }
  if (user.accountStatus === "flagged") {
    throw Object.assign(
      new Error("Your account is under review. Please contact support."),
      { status: 403, code: "ACCOUNT_FLAGGED" },
    )
  }
}

interface GoogleTokens {
  access_token: string
  id_token: string
  expires_in: number
}

interface GoogleUserInfo {
  sub: string
  email: string
  email_verified: boolean
  name: string
  given_name: string
  family_name: string
  picture: string
}

/**
 * Create and persist a one-time CSRF state value for the OAuth flow.
 */
export async function createOAuthState(): Promise<string> {
  const state = crypto.randomBytes(16).toString("hex")
  await redis.set(`${OAUTH_STATE_PREFIX}${state}`, "1", {
    ex: OAUTH_STATE_TTL_SECONDS,
  })
  return state
}

/**
 * Verify and consume a one-time CSRF state value. Returns false when the
 * state is missing, expired, or already used.
 */
export async function consumeOAuthState(state: string): Promise<boolean> {
  if (!state) return false
  const deleted = await redis.del(`${OAUTH_STATE_PREFIX}${state}`)
  return deleted > 0
}

/**
 * Generate the Google OAuth consent URL to redirect users to.
 */
export function getGoogleAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID,
    redirect_uri: config.GOOGLE_CALLBACK_URL,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  })
  if (state) params.set("state", state)

  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange an authorization code for tokens from Google.
 */
async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    code,
    client_id: config.GOOGLE_CLIENT_ID,
    client_secret: config.GOOGLE_CLIENT_SECRET,
    redirect_uri: config.GOOGLE_CALLBACK_URL,
    grant_type: "authorization_code",
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.warn({ error: errorText }, "google_token_exchange_failed")
    throw Object.assign(
      new Error(`Google token exchange failed: ${errorText}`),
      { status: 400, code: "GOOGLE_TOKEN_EXCHANGE_FAILED" },
    )
  }

  return response.json() as Promise<GoogleTokens>
}

/**
 * Fetch user info from Google using the access token.
 */
async function getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    logger.warn({ status: response.status }, "google_userinfo_failed")
    throw Object.assign(
      new Error("Failed to fetch Google user info"),
      { status: 400, code: "GOOGLE_USERINFO_FAILED" },
    )
  }

  return response.json() as Promise<GoogleUserInfo>
}

/**
 * Handle the full Google OAuth callback flow:
 * 1. Exchange authorization code for tokens
 * 2. Get user info from Google
 * 3. Find or create user in DB
 * 4. Issue JWT tokens
 */
export async function handleGoogleCallback(
  code: string,
): Promise<{ user: IUser; tokens: AuthTokens; isNewUser: boolean }> {
  // Exchange code for tokens
  const googleTokens = await exchangeCodeForTokens(code)

  // Get user info
  const googleUser = await getUserInfo(googleTokens.access_token)

  // Check if user already exists by googleId or email.
  // +refreshTokens: the field is select:false and we push to it below.
  let user = await User.findOne({
    $or: [{ googleId: googleUser.sub }, { email: googleUser.email }],
  }).select("+refreshTokens")

  let isNewUser = false

  if (user) {
    // Banned/flagged accounts must never regain access via OAuth
    assertAccountStatus(user)

    // Existing user — link googleId if not already linked
    if (!user.googleId) {
      user.googleId = googleUser.sub
      user.authProvider = "email" // Keep original provider, just link Google
    }

    // Update profile info from Google if fields are empty
    if (!user.firstName && googleUser.given_name) {
      user.firstName = googleUser.given_name
    }
    if (!user.lastName && googleUser.family_name) {
      user.lastName = googleUser.family_name
    }

    user.lastLoginAt = new Date()
    user.isEmailVerified = user.isEmailVerified || googleUser.email_verified
    await user.save({ validateBeforeSave: false })
  } else {
    // New user — create from Google profile (no password needed)
    user = await User.create({
      firstName: googleUser.given_name || googleUser.name.split(" ")[0] || "Google",
      lastName: googleUser.family_name || googleUser.name.split(" ").slice(1).join(" ") || "User",
      email: googleUser.email,
      googleId: googleUser.sub,
      authProvider: "google",
      isEmailVerified: googleUser.email_verified,
      // password is intentionally omitted — pre-save hook only fires
      // if password is modified; no password means Google-only auth
    })
    isNewUser = true
  }

  // Generate JWT tokens
  const payload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  }

  const accessToken = generateAccessToken(payload)
  const refreshToken = generateRefreshToken(payload)

  // Store refresh token in Redis
  await storeRefreshToken(payload.userId, refreshToken)

  // Store refresh token in DB (capped at 10)
  user.refreshTokens = pushRefreshToken(user.refreshTokens, refreshToken)
  await user.save({ validateBeforeSave: false })

  logger.info({
    userId: user._id.toString(),
    email: user.email,
    isNewUser,
  }, isNewUser ? "google_user_created" : "google_user_logged_in")

  return {
    user,
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: config.ACCESS_TOKEN_EXPIRY_SECONDS,
    },
    isNewUser,
  }
}

/**
 * Link a Google account to an existing logged-in user.
 * Allows users who registered via email-password to also sign in with Google.
 * Throws if the Google ID is already linked to another account.
 */
export async function linkGoogleAccount(
  userId: string,
  code: string,
): Promise<{ user: IUser }> {
  // Find user FIRST to avoid wasted Google API calls if user is banned/flagged
  const user = await User.findById(userId)
  if (!user) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
      code: "USER_NOT_FOUND",
    })
  }

  // Banned/flagged users cannot link Google accounts
  if (user.accountStatus === "banned") {
    throw Object.assign(
      new Error("Your account has been banned."),
      { status: 403, code: "ACCOUNT_BANNED" },
    )
  }
  if (user.accountStatus === "flagged") {
    throw Object.assign(
      new Error("Your account is under review."),
      { status: 403, code: "ACCOUNT_FLAGGED" },
    )
  }

  // Exchange code for tokens
  const googleTokens = await exchangeCodeForTokens(code)

  // Get Google user info
  const googleUser = await getUserInfo(googleTokens.access_token)

  // Check if Google ID is already linked to another account
  const existingUser = await User.findOne({
    googleId: googleUser.sub,
    _id: { $ne: userId },
  })

  if (existingUser) {
    throw Object.assign(
      new Error("This Google account is already linked to another user."),
      { status: 409, code: "GOOGLE_ALREADY_LINKED" },
    )
  }

  // If already linked, no-op
  if (user.googleId === googleUser.sub) {
    return { user }
  }

  // Link Google account
  user.googleId = googleUser.sub
  user.authProvider = user.password ? "email" : "google"
  // Update profile info from Google if fields are empty
  if (!user.firstName && googleUser.given_name) {
    user.firstName = googleUser.given_name
  }
  if (!user.lastName && googleUser.family_name) {
    user.lastName = googleUser.family_name
  }
  user.isEmailVerified = user.isEmailVerified || googleUser.email_verified

  await user.save({ validateBeforeSave: false })

  logger.info({ userId, googleId: googleUser.sub }, "google_account_linked")

  return { user }
}
