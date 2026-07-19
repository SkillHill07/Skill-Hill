import { RateLimiterRedis } from "rate-limiter-flexible"
import { redis } from "../config/redis.js"
import { logger } from "../utils/logger.js"
import type { Request, Response, NextFunction } from "express"

/**
 * Wraps a RateLimiterRedis instance into an Express middleware function.
 * Consumes 1 point per request. Returns 429 with JSON error if limit exceeded.
 */
function createMiddleware(
  limiter: RateLimiterRedis,
  errorMessage: string,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await limiter.consume(req.ip ?? "unknown")
      next()
    } catch (rejRes) {
      const rej = rejRes as { msBeforeNext?: number }
      // If msBeforeNext is missing, Redis might be down — fall back to 60s
      const retryAfter = rej.msBeforeNext ? Math.ceil(rej.msBeforeNext / 1000) : 60
      logger.warn({
        ip: req.ip ?? "unknown",
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
  new RateLimiterRedis({
    storeClient: redis,
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
  new RateLimiterRedis({
    storeClient: redis,
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
  new RateLimiterRedis({
    storeClient: redis,
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
  new RateLimiterRedis({
    storeClient: redis,
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
  new RateLimiterRedis({
    storeClient: redis,
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
  new RateLimiterRedis({
    storeClient: redis,
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
  new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl:reset-pw:",
    points: 5,
    duration: 60,
  }),
  "Too many reset attempts. Please try again after a minute.",
)
