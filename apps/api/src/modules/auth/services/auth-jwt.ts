import jwt from "jsonwebtoken"
import { config } from "../../../config/index.js"
import { redis } from "../../../config/redis.js"
import type { Role } from "@skillcontest/shared-types"

export interface TokenPayload {
  userId: string
  email: string
  role: Role
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.ACCESS_TOKEN_EXPIRY,
  })
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.REFRESH_TOKEN_EXPIRY,
  })
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.JWT_SECRET) as TokenPayload
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as TokenPayload
}

export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  await redis.set(
    `refresh:${userId}:${token}`,
    "1",
    "EX",
    config.REFRESH_TOKEN_EXPIRY_SECONDS,
  )
}

export async function removeRefreshToken(userId: string, token: string): Promise<void> {
  await redis.del(`refresh:${userId}:${token}`)
}

export async function isTokenRevoked(userId: string, token: string): Promise<boolean> {
  const exists = await redis.get(`refresh:${userId}:${token}`)
  return exists === null
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  const pattern = `refresh:${userId}:*`
  let cursor = "0"
  const keys: string[] = []

  do {
    const result = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100)
    cursor = result[0]
    keys.push(...result[1])
  } while (cursor !== "0")

  if (keys.length > 0) {
    await redis.del(...keys)
  }
}

const MAX_REFRESH_TOKENS = 10

/**
 * Push a refresh token and cap the array to prevent unbounded growth.
 */
export function pushRefreshToken(tokens: string[], newToken: string): string[] {
  tokens.push(newToken)
  if (tokens.length > MAX_REFRESH_TOKENS) {
    tokens = tokens.slice(-MAX_REFRESH_TOKENS)
  }
  return tokens
}
