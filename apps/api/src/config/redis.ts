import { Redis } from "@upstash/redis"
import { config } from "./index.js"

let redisInstance: Redis | null = null

export function getRedis(): Redis {
  if (!redisInstance) {
    // REST client — stateless HTTP calls against Upstash. Empty URL/token
    // (local dev) make every command fail fast, which the app tolerates
    // exactly like a down Redis: cache silently misses, limiter 429s,
    // token/OTP endpoints 500 until configured.
    redisInstance = new Redis({
      url: config.UPSTASH_REDIS_REST_URL || "http://localhost:6379",
      token: config.UPSTASH_REDIS_REST_TOKEN || "",
      automaticDeserialization: false, // keep get/set string semantics
    })
  }

  return redisInstance
}

export const redis = getRedis()

/**
 * No persistent connection exists (REST) — this pings to fail fast on
 * misconfigured credentials/network. Non-blocking: the app still starts
 * when Upstash is unreachable (individual features degrade).
 */
export async function connectRedis(): Promise<void> {
  try {
    await redis.ping()
  } catch (err) {
    console.warn(
      "Upstash Redis unreachable:",
      (err as Error).message,
    )
  }
}