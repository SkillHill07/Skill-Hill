import { RateLimiterRedis } from "rate-limiter-flexible"
import { createMiddleware } from "../../middlewares/rate-limiter.js"
import { redis } from "../../config/redis.js"

/**
 * Submission rate limit: 1 submission per 30 seconds per user per problem.
 * Must run AFTER authenticate (req.user) and validateRequest (req.body.problemId).
 */
export const submissionLimiter = createMiddleware(
  new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl:submit:",
    points: 1,
    duration: 30,
  }),
  "You can only submit once every 30 seconds per problem",
  (req) => `${req.user?.userId ?? req.ip ?? "unknown"}:${req.body.problemId ?? "unknown"}`,
)
