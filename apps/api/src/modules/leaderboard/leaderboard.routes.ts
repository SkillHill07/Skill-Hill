import { Router } from "express"
import { leaderboardService } from "./leaderboard.service.js"
import { authenticate, optionalAuth } from "../auth/middleware/auth.middleware.js"
import { validateRequest } from "../../middlewares/validate-request.js"
import { sendSuccess } from "../../utils/response.js"
import {
  leaderboardSchema,
  myRankSchema,
  weeklyLeaderboardSchema,
  availableWeeksSchema,
} from "./leaderboard.validation.js"
import type { Request, Response, NextFunction } from "express"

export const leaderboardRouter: Router = Router()

/**
 * @openapi
 * /contests/{contestId}/leaderboard:
 *   get:
 *     tags: [Leaderboards]
 *     summary: Contest leaderboard — top ranked participants (public)
 *     description: >
 *       Ranked by totalScore (best submission wins), ties broken by earlier
 *       submission time. Only participants who submitted are ranked.
 *       Draft/cancelled contests return 404 for non-staff.
 *     parameters:
 *       - in: path
 *         name: contestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 100
 *         description: Number of entries to return
 *     responses:
 *       200:
 *         description: Ranked entries with participant names
 *       404:
 *         description: Contest not found (or draft/cancelled for non-staff)
 */
leaderboardRouter.get(
  "/:contestId/leaderboard",
  optionalAuth,
  validateRequest(leaderboardSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100
      const result = await leaderboardService.getLeaderboard(
        req.params.contestId as string,
        limit,
        req.user,
      )
      sendSuccess(res, result)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{contestId}/leaderboard/me:
 *   get:
 *     tags: [Leaderboards]
 *     summary: Current user's rank and score in a contest
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rank (null until the user has a submission) + score
 */
leaderboardRouter.get(
  "/:contestId/leaderboard/me",
  authenticate,
  validateRequest(myRankSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await leaderboardService.getMyRank(
        req.user!.userId,
        req.params.contestId as string,
      )
      sendSuccess(res, result)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{contestId}/leaderboard/weekly:
 *   get:
 *     tags: [Leaderboards]
 *     summary: Weekly leaderboard for eternal contests
 *     description: >
 *       Ranked by best submission score within a Monday–Sunday (UTC) window.
 *       Defaults to the current week if `week` is omitted.
 *     parameters:
 *       - in: path
 *         name: contestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 100
 *       - in: query
 *         name: week
 *         schema:
 *           type: string
 *           format: date
 *         description: Any date within the target week (snapped to Monday)
 *     responses:
 *       200:
 *         description: Ranked entries for the week
 */
leaderboardRouter.get(
  "/:contestId/leaderboard/weekly",
  optionalAuth,
  validateRequest(weeklyLeaderboardSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100
      const week = req.query.week ? new Date(req.query.week as string) : undefined
      const result = await leaderboardService.getWeeklyLeaderboard(
        req.params.contestId as string,
        limit,
        week,
        req.user,
      )
      sendSuccess(res, result)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{contestId}/leaderboard/weeks:
 *   get:
 *     tags: [Leaderboards]
 *     summary: Available weeks for an eternal contest
 *     description: >
 *       Returns recent week start dates (Mondays) that have submissions.
 *     parameters:
 *       - in: path
 *         name: contestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *           maximum: 52
 *     responses:
 *       200:
 *         description: Array of ISO week start dates
 */
leaderboardRouter.get(
  "/:contestId/leaderboard/weeks",
  optionalAuth,
  validateRequest(availableWeeksSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 12
      const weeks = await leaderboardService.getAvailableWeeks(
        req.params.contestId as string,
        limit,
      )
      sendSuccess(res, { weeks })
    } catch (err) {
      next(err)
    }
  },
)
