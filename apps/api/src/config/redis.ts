import { Redis } from "ioredis"
import { config } from "./index.js"

let redisInstance: Redis | null = null

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      lazyConnect: true,
    })

    redisInstance.on("error", (err) => {
      console.error("Redis connection error:", err.message)
    })

    redisInstance.on("connect", () => {
      console.log("Redis connected")
    })
  }

  return redisInstance
}

export const redis = getRedis()

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect()
  } catch (err) {
    console.warn(
      "Redis connection failed, running without Redis:",
      (err as Error).message,
    )
  }
}
