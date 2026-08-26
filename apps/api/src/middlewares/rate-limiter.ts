import { redis } from "../config/redis.js"
import { logger } from "../utils/logger.js"
import type { Request, Response, NextFunction } from "express"

/**
 * Fixed-window counter on Upstash Redis (replaces rate-limiter-flexible,
 * which needs a TCP client). INCR + first-hit EXPIRE; consume() rejects
 * with msBeforeNext when the window is exhausted.
 * ponytail: INCR and EXPIRE are not atomic — if expire fails the key lives
 * forever. A Lua script (redis.eval) makes it atomic; upgrade if keys leak.
 */
export class RedisRateLimiter {
  readonly keyPrefix: string
  private readonly points: number
  private readonly duration: number

  constructor(opts: { keyPrefix: string; points: number; duration: number }) {
    this.keyPrefix = opts.keyPrefix
    this.points = opts.points
    this.duration = opts.duration
  }

  async consume(key: string): Promise<void> {
    const fullKey = `${this.keyPrefix}${key}`
    const count = await redis.incr(fullKey)
    if (count === 1) {
      await redis.expire(fullKey, this.duration)
    }
    if (count > this.points) {
      const ttl = await redis.ttl(fullKey)
      throw Object.assign(new Error("Rate limit exceeded"), {
        msBeforeNext: ttl * 1000,
      })
    }
  }
}

/**
 * Wraps a RedisRateLimiter instance into an Express middleware function.
 * Consumes 1 point per request. Returns 429 with JSON error if limit exceeded.
 * Optionally keys on a custom identifier (e.g. authenticated userId) instead of IP.
 */
export function createMiddleware(
  limiter: RedisRateLimiter,
  errorMessage: string,
  keyResolver?: (req: Request) => string,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = keyResolver ? keyResolver(req) : req.ip ?? "unknown"
      await limiter.consume(key)
      next()
    } catch (rejRes) {
      const rej = rejRes as { msBeforeNext?: number }
      // If msBeforeNext is missing, Redis might be down — fall back to 60s
      const retryAfter = rej.msBeforeNext ? Math.ceil(rej.msBeforeNext / 1000) : 60
      logger.warn({
        keyPrefix: limiter.keyPrefix,
        retryAfter,
        path: req.path,
      }, "rate_limit_hit")
      res.set("Retry-After", String(retryAfter))
      res.status(429).json({
        success: false,
        error: errorMessage,
        retryAfterSeconds: retryAfter,
      })
    }
  }
}

// --- Rate limiters ---

/**
 * Rate limiter for login attempts.
 * 5 attempts per IP per 60 second window.
 */
export const loginLimiter = createMiddleware(
  new RedisRateLimiter({
    keyPrefix: "rl:login:",
    points: 5,
    duration: 60,
  }),
  "Too many login attempts. Please try again after a minute.",
)

/**
 * Rate limiter for registration.
 * 3 attempts per IP per 60 second window.
 */
export const registerLimiter = createMiddleware(
  new RedisRateLimiter({
    keyPrefix: "rl:register:",
    points: 3,
    duration: 60,
  }),
  "Too many registration attempts. Please try again after a minute.",
)

/**
 * Rate limiter for token refresh.
 * 10 attempts per IP per 60 second window.
 */
export const refreshLimiter = createMiddleware(
  new RedisRateLimiter({
    keyPrefix: "rl:refresh:",
    points: 10,
    duration: 60,
  }),
  "Too many refresh attempts. Please try again after a minute.",
)

/**
 * Rate limiter for OTP send requests.
 * 5 requests per IP per 60 second window.
 */
export const sendOtpLimiter = createMiddleware(
  new RedisRateLimiter({
    keyPrefix: "rl:otp-send:",
    points: 5,
    duration: 60,
  }),
  "Too many OTP requests. Please try again after a minute.",
)

/**
 * Rate limiter for OTP verification.
 * 5 requests per IP per 60 second window.
 */
export const verifyOtpLimiter = createMiddleware(
  new RedisRateLimiter({
    keyPrefix: "rl:otp-verify:",
    points: 5,
    duration: 60,
  }),
  "Too many verification attempts. Please try again after a minute.",
)

/**
 * Rate limiter for forgot-password requests.
 * 3 requests per IP per 60 second window.
 */
export const forgotPasswordLimiter = createMiddleware(
  new RedisRateLimiter({
    keyPrefix: "rl:forgot-pw:",
    points: 3,
    duration: 60,
  }),
  "Too many password reset requests. Please try again after a minute.",
)

/**
 * Rate limiter for reset-password requests.
 * 5 requests per IP per 60 second window.
 */
export const resetPasswordLimiter = createMiddleware(
  new RedisRateLimiter({
    keyPrefix: "rl:reset-pw:",
    points: 5,
    duration: 60,
  }),
  "Too many reset attempts. Please try again after a minute.",
)

/**
 * Rate limiter for contest joins.
 * 3 join attempts per user per 60 second window.
 * Must be placed AFTER the `authenticate` middleware so req.user is set.
 */
export const joinLimiter = createMiddleware(
  new RedisRateLimiter({
    keyPrefix: "rl:join:",
    points: 3,
    duration: 60,
  }),
  "Too many join attempts. Please try again after a minute.",
  (req) => req.user?.userId ?? req.ip ?? "unknown",
)

/**
 * Rate limiter for withdrawal requests.
 * 3 attempts per user per 5 minute window (money-moving endpoint).
 * Must be placed AFTER the `authenticate` middleware so req.user is set.
 */
export const withdrawLimiter = createMiddleware(
  new RedisRateLimiter({
    keyPrefix: "rl:withdraw:",
    points: 3,
    duration: 300,
  }),
  "Too many withdrawal requests. Please try again in a few minutes.",
  (req) => req.user?.userId ?? req.ip ?? "unknown",
)

// Submission rate limiting (1 per 30s per problem) lands with the submission
// module in Phase 4 — reusing this middleware factory there.
