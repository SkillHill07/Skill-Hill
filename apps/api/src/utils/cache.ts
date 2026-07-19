import { redis } from "../config/redis.js"

const DEFAULT_TTL = 60 // seconds

export const cacheKeys = {
  userProfile: (userId: string) => `cache:user:${userId}:profile`,
  kycStatus: (userId: string) => `cache:user:${userId}:kyc`,
} as const

/**
 * Get a value from cache. Returns null if miss.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Set a value in cache with optional TTL (default 60s).
 */
export async function cacheSet(key: string, value: unknown, ttl = DEFAULT_TTL): Promise<void> {
  try {
    const serialized = JSON.stringify(value)
    await redis.setex(key, ttl, serialized)
  } catch {
    // Silently fail — cache miss is not a critical error
  }
}

/**
 * Delete one or more cache keys.
 */
export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch {
    // Silently fail
  }
}
