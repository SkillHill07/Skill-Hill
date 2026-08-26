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
import { assertAccountStatus } from "./auth-google.service.js"

const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
const GITHUB_USERINFO_URL = "https://api.github.com/user"
const GITHUB_EMAIL_URL = "https://api.github.com/user/emails"

const SCOPES = ["read:user", "user:email"]

// CSRF protection: one-time state values with a 10-minute TTL.
const OAUTH_STATE_TTL_SECONDS = 600
const OAUTH_STATE_PREFIX = "oauth:state:github:"

export async function createGithubOAuthState(): Promise<string> {
  const state = crypto.randomBytes(16).toString("hex")
  await redis.set(`${OAUTH_STATE_PREFIX}${state}`, "1", {
    ex: OAUTH_STATE_TTL_SECONDS,
  })
  return state
}

export async function consumeGithubOAuthState(state: string): Promise<boolean> {
  if (!state) return false
  const deleted = await redis.del(`${OAUTH_STATE_PREFIX}${state}`)
  return deleted > 0
}

export function getGithubAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: config.GITHUB_CLIENT_ID,
    redirect_uri: config.GITHUB_CALLBACK_URL,
    scope: SCOPES.join(","),
    allow_signup: "true",
  })
  if (state) params.set("state", state)
  return `${GITHUB_AUTH_URL}?${params.toString()}`
}

interface GithubUserInfo {
  id: number
  login: string
  name: string
  email: string
  avatar_url: string
}

interface GithubTokenResponse {
  access_token: string
  token_type: string
  scope: string
  error?: string
  error_description?: string
}

interface GithubEmail {
  email: string
  primary: boolean
  verified: boolean
  visibility: string | null
}

async function exchangeCodeForTokens(code: string): Promise<string> {
  const body = new URLSearchParams({
    code,
    client_id: config.GITHUB_CLIENT_ID,
    client_secret: config.GITHUB_CLIENT_SECRET,
    redirect_uri: config.GITHUB_CALLBACK_URL,
  })

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  })

  const data = (await response.json()) as GithubTokenResponse

  if (!response.ok || data.error) {
    logger.warn({ error: data.error_description || data.error }, "github_token_exchange_failed")
    throw Object.assign(
      new Error(`GitHub token exchange failed: ${data.error_description || data.error}`),
      { status: 400, code: "GITHUB_TOKEN_EXCHANGE_FAILED" },
    )
  }

  return data.access_token
}

async function getUserInfo(accessToken: string): Promise<GithubUserInfo & { verified_email: string; email_verified: boolean }> {
  const response = await fetch(GITHUB_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    logger.warn({ status: response.status }, "github_userinfo_failed")
    throw Object.assign(
      new Error("Failed to fetch GitHub user info"),
      { status: 400, code: "GITHUB_USERINFO_FAILED" },
    )
  }

  const user = (await response.json()) as GithubUserInfo

  // GitHub may not expose a public email — fetch primary email separately
  let verifiedEmail = user.email
  let emailVerified = true

  if (!user.email) {
    const emailsRes = await fetch(GITHUB_EMAIL_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    })
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as GithubEmail[]
      const primary = emails.find((e) => e.primary)
      if (primary) {
        verifiedEmail = primary.email
        emailVerified = primary.verified
      }
    }
  }

  return {
    ...user,
    verified_email: verifiedEmail || `${user.login}@github.com`,
    email_verified: emailVerified,
  }
}

export async function handleGithubCallback(
  code: string,
): Promise<{ user: IUser; tokens: AuthTokens; isNewUser: boolean }> {
  const accessToken = await exchangeCodeForTokens(code)
  const githubUser = await getUserInfo(accessToken)

  // +refreshTokens: the field is select:false and we push to it below.
  let user = await User.findOne({
    $or: [{ githubId: String(githubUser.id) }, { email: githubUser.verified_email }],
  }).select("+refreshTokens")

  let isNewUser = false

  if (user) {
    // Banned/flagged accounts must never regain access via OAuth
    assertAccountStatus(user)
    if (!user.githubId) {
      user.githubId = String(githubUser.id)
      user.authProvider = user.authProvider === "google" ? "email" : "email"
    }
    if (!user.firstName && githubUser.name) {
      const parts = githubUser.name.split(" ")
      user.firstName = parts[0]
      user.lastName = parts.slice(1).join(" ") || ""
    }
    if (!user.avatarUrl && githubUser.avatar_url) {
      user.avatarUrl = githubUser.avatar_url
    }
    user.lastLoginAt = new Date()
    user.isEmailVerified = user.isEmailVerified || githubUser.email_verified
    await user.save({ validateBeforeSave: false })
  } else {
    const name = githubUser.name || githubUser.login
    const nameParts = name.split(" ")
    user = await User.create({
      firstName: nameParts[0] || "GitHub",
      lastName: nameParts.slice(1).join(" ") || "User",
      email: githubUser.verified_email,
      githubId: String(githubUser.id),
      authProvider: "github",
      avatarUrl: githubUser.avatar_url,
      isEmailVerified: githubUser.email_verified,
    })
    isNewUser = true
  }

  const payload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  }

  const accessTokenJwt = generateAccessToken(payload)
  const refreshToken = generateRefreshToken(payload)
  await storeRefreshToken(payload.userId, refreshToken)
  user.refreshTokens = pushRefreshToken(user.refreshTokens, refreshToken)
  await user.save({ validateBeforeSave: false })

  logger.info({ userId: user._id.toString(), email: user.email, isNewUser },
    isNewUser ? "github_user_created" : "github_user_logged_in")

  return {
    user,
    tokens: { accessToken: accessTokenJwt, refreshToken, expiresIn: config.ACCESS_TOKEN_EXPIRY_SECONDS },
    isNewUser,
  }
}

export async function linkGithubAccount(
  userId: string,
  code: string,
): Promise<{ user: IUser }> {
  const user = await User.findById(userId)
  if (!user) {
    throw Object.assign(new Error("User not found"), { status: 404, code: "USER_NOT_FOUND" })
  }
  if (user.accountStatus === "banned") {
    throw Object.assign(new Error("Your account has been banned."), { status: 403, code: "ACCOUNT_BANNED" })
  }
  if (user.accountStatus === "flagged") {
    throw Object.assign(new Error("Your account is under review."), { status: 403, code: "ACCOUNT_FLAGGED" })
  }

  const accessToken = await exchangeCodeForTokens(code)
  const githubUser = await getUserInfo(accessToken)

  const existingUser = await User.findOne({
    githubId: String(githubUser.id),
    _id: { $ne: userId },
  })
  if (existingUser) {
    throw Object.assign(
      new Error("This GitHub account is already linked to another user."),
      { status: 409, code: "GITHUB_ALREADY_LINKED" },
    )
  }

  if (user.githubId === String(githubUser.id)) {
    return { user }
  }

  user.githubId = String(githubUser.id)
  user.authProvider = user.password ? "email" : "github"
  if (!user.firstName && githubUser.name) {
    const parts = githubUser.name.split(" ")
    user.firstName = parts[0]
    user.lastName = parts.slice(1).join(" ") || ""
  }
  if (!user.avatarUrl && githubUser.avatar_url) {
    user.avatarUrl = githubUser.avatar_url
  }
  user.isEmailVerified = user.isEmailVerified || githubUser.email_verified
  await user.save({ validateBeforeSave: false })

  logger.info({ userId, githubId: String(githubUser.id) }, "github_account_linked")
  return { user }
}
