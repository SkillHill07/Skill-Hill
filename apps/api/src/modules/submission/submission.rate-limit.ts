import {
  RedisRateLimiter,
  createMiddleware,
} from "../../middlewares/rate-limiter.js"

/**
 * Submission rate limit: 1 submission per 30 seconds per user per problem.
 * Must run AFTER authenticate (req.user) and validateRequest (req.body.problemId).
 */
export const submissionLimiter = createMiddleware(
  new RedisRateLimiter({
    keyPrefix: "rl:submit:",
    points: 1,
    duration: 30,
  }),
  "You can only submit once every 30 seconds per problem",
  (req) => `${req.user?.userId ?? req.ip ?? "unknown"}:${req.body.problemId ?? "unknown"}`,
)
