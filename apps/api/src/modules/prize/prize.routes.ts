import { Router } from "express"
import { prizeService } from "./prize.service.js"
import { authenticate, optionalAuth } from "../auth/middleware/auth.middleware.js"
import { validateRequest } from "../../middlewares/validate-request.js"
import { sendSuccess } from "../../utils/response.js"
import {
  contestPrizesSchema,
  listUserPrizesSchema,
  recentWinnersSchema,
} from "./prize.validation.js"
import type { Request, Response, NextFunction } from "express"

/** Mounted at /contests — GET /:id/prizes (public). */
export const contestPrizeRouter: Router = Router()

/**
 * @openapi
 * /contests/{id}/prizes:
 *   get:
 *     tags: [Prizes]
 *     summary: Prize breakdown for a contest (public)
 *     description: >
 *       Share table rendered against the current pool (indicative pre-settle)
 *       plus the actual winners with amounts once the contest is settled.
 *       Draft/cancelled contests are hidden from non-staff.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Prize structure + winners
 *       404:
 *         description: Contest not found (or hidden draft)
 */
contestPrizeRouter.get(
  "/:id/prizes",
  optionalAuth,
  validateRequest(contestPrizesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await prizeService.getContestPrizes(
        req.params.id as string,
        req.user ?? null,
      )
      sendSuccess(res, result)
    } catch (err) {
      next(err)
    }
  },
)

/** Mounted at /prizes — public recent-winners feed (must be mounted BEFORE the authed user router). */
export const publicPrizeRouter: Router = Router()

/**
 * @openapi
 * /prizes/recent:
 *   get:
 *     tags: [Prizes]
 *     summary: Recent credited winners (public)
 *     description: >
 *       Newest first — winner name/avatar + contest title + amount.
 *       Powers the homepage winners wall.
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Recent winners
 */
publicPrizeRouter.get(
  "/recent",
  validateRequest(recentWinnersSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const winners = await prizeService.listRecentWinners(
        req.query.limit ? parseInt(req.query.limit as string, 10) : 10,
      )
      sendSuccess(res, winners)
    } catch (err) {
      next(err)
    }
  },
)

/** Mounted at /prizes — GET / (user's prize history). */
export const userPrizeRouter: Router = Router()

userPrizeRouter.use(authenticate)

/**
 * @openapi
 * /prizes:
 *   get:
 *     tags: [Prizes]
 *     summary: Current user's prize history (paginated)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Paginated prizes (contest title/slug populated)
 */
userPrizeRouter.get(
  "/",
  validateRequest(listUserPrizesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await prizeService.listUserPrizes(req.user!.userId, {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      })
      sendSuccess(res, result)
    } catch (err) {
      next(err)
    }
  },
)
