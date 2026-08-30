import { Router } from "express"
import { contestService } from "./contest.service.js"
import { participationService } from "./participation.service.js"
import { authenticate, optionalAuth, requireRole } from "../auth/middleware/auth.middleware.js"
import { validateRequest } from "../../middlewares/validate-request.js"
import { joinLimiter } from "../../middlewares/rate-limiter.js"
import { sendSuccess } from "../../utils/response.js"
import { auditService } from "../audit/audit.service.js"
import {
  createContestSchema,
  updateContestSchema,
  getContestSchema,
  publishContestSchema,
  cancelContestSchema,
  freezeContestSchema,
  settleContestSchema,
  joinContestSchema,
  startContestSchema,
  listContestsSchema,
} from "./contest.validation.js"
import type { Request, Response, NextFunction } from "express"

export const contestRouter: Router = Router()

/**
 * @openapi
 * /contests:
 *   get:
 *     tags: [Contests]
 *     summary: List contests (active/upcoming by default)
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, upcoming, settled, frozen, cancelled, draft]
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
 *     responses:
 *       200:
 *         description: Paginated contest list
 */
contestRouter.get(
  "/",
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = (req.query.status as string) || undefined
      const problemType = (req.query.problemType as string) || undefined
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20
      // Validate via the schema to keep the same error shape
      const parsed = listContestsSchema.safeParse({ query: { status, problemType, page, limit } })
      if (!parsed.success) {
        const msg = parsed.error.errors[0]?.message ?? "Invalid query"
        throw Object.assign(new Error(msg), { status: 400, code: "VALIDATION_ERROR" })
      }
      const result = await contestService.listContests(
        parsed.data.query,
        req.user ?? null,
      )
      sendSuccess(res, result)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{id}:
 *   get:
 *     tags: [Contests]
 *     summary: Get a single contest by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contest details
 *       404:
 *         description: Contest not found
 */
contestRouter.get(
  "/:id",
  optionalAuth,
  validateRequest(getContestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contest = await contestService.getContestById(
        req.params.id as string,
        req.user ?? null,
      )
      sendSuccess(res, contest)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests:
 *   post:
 *     tags: [Contests]
 *     summary: Create a contest (draft) — admin/creator
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, startTime, endTime, prizePool]
 *             properties:
 *               title: { type: string }
 *               slug: { type: string }
 *               description: { type: string }
 *               type: { type: string, enum: [free, paid], default: free, description: "paid requires entryFee > 0" }
 *               startTime: { type: string, format: date-time }
 *               endTime: { type: string, format: date-time }
 *               entryFee: { type: integer, description: "in paise — required when type is paid" }
 *               prizePool: { type: integer, description: "in paise" }
 *               maxParticipants: { type: integer }
 *               rules: { type: string }
 *     responses:
 *       201:
 *         description: Draft contest created
 */
contestRouter.post(
  "/",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(createContestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contest = await contestService.createContest(req.body, req.user!.userId)
      await auditService.log({
        actorId: req.user!.userId,
        actorRole: req.user!.role,
        action: "contest.create",
        resource: "contest",
        resourceId: contest._id.toString(),
        details: { title: req.body.title, type: req.body.type },
        ip: req.ip ?? null,
      })
      sendSuccess(res, contest, "Contest draft created", 201)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{id}:
 *   patch:
 *     tags: [Contests]
 *     summary: Update a draft contest — admin/creator
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               type: { type: string, enum: [free, paid], description: "switching to paid requires entryFee > 0" }
 *               startTime: { type: string, format: date-time }
 *               endTime: { type: string, format: date-time }
 *               entryFee: { type: integer, description: "in paise" }
 *               prizePool: { type: integer, description: "in paise" }
 *     responses:
 *       200:
 *         description: Updated contest
 */
contestRouter.patch(
  "/:id",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(updateContestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contest = await contestService.updateContest(req.params.id as string, req.body)
      await auditService.log({
        actorId: req.user!.userId,
        actorRole: req.user!.role,
        action: "contest.update",
        resource: "contest",
        resourceId: req.params.id as string,
        details: { fields: Object.keys(req.body) },
        ip: req.ip ?? null,
      })
      sendSuccess(res, contest, "Contest updated")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{id}/publish:
 *   post:
 *     tags: [Contests]
 *     summary: Publish a contest (draft → active) — admin/creator
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contest published
 */
contestRouter.post(
  "/:id/publish",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(publishContestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contest = await contestService.publishContest(req.params.id as string)
      await auditService.log({
        actorId: req.user!.userId,
        actorRole: req.user!.role,
        action: "contest.publish",
        resource: "contest",
        resourceId: req.params.id as string,
        ip: req.ip ?? null,
      })
      sendSuccess(res, contest, "Contest published")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{id}/cancel:
 *   post:
 *     tags: [Contests]
 *     summary: Cancel a contest (refunds handled by wallet module — Phase 3)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Contest cancelled
 */
contestRouter.post(
  "/:id/cancel",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(cancelContestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contest = await contestService.cancelContest(
        req.params.id as string,
        req.body.reason,
      )
      await auditService.log({
        actorId: req.user!.userId,
        actorRole: req.user!.role,
        action: "contest.cancel",
        resource: "contest",
        resourceId: req.params.id as string,
        details: { reason: req.body.reason ?? null },
        ip: req.ip ?? null,
      })
      sendSuccess(res, contest, "Contest cancelled")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{id}/freeze:
 *   post:
 *     tags: [Contests]
 *     summary: Freeze a contest (active → frozen) — admin/creator or Upstash job worker
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contest frozen
 */
contestRouter.post(
  "/:id/freeze",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(freezeContestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contest = await contestService.freezeContest(req.params.id as string)
      await auditService.log({
        actorId: req.user!.userId,
        actorRole: req.user!.role,
        action: "contest.freeze",
        resource: "contest",
        resourceId: req.params.id as string,
        ip: req.ip ?? null,
      })
      sendSuccess(res, contest, "Contest frozen")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{id}/settle:
 *   post:
 *     tags: [Contests]
 *     summary: Settle a frozen contest (frozen → settled) — admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contest settled
 */
contestRouter.post(
  "/:id/settle",
  authenticate,
  requireRole("admin"),
  validateRequest(settleContestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contest = await contestService.settleContest(req.params.id as string)
      await auditService.log({
        actorId: req.user!.userId,
        actorRole: req.user!.role,
        action: "contest.settle",
        resource: "contest",
        resourceId: req.params.id as string,
        ip: req.ip ?? null,
      })
      sendSuccess(res, contest, "Contest settled")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{id}/join:
 *   post:
 *     tags: [Contests]
 *     summary: Join a contest (user)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [turnstileToken]
 *             properties:
 *               turnstileToken: { type: string }
 *     responses:
 *       201:
 *         description: Joined successfully
 */
contestRouter.post(
  "/:id/join",
  authenticate,
  joinLimiter,
  validateRequest(joinContestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const participation = await participationService.joinContest(
        req.user!.userId,
        req.params.id as string,
        req.body.turnstileToken,
      )
      sendSuccess(res, participation, "Joined contest", 201)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{id}/start:
 *   post:
 *     tags: [Contests]
 *     summary: Start a contest for the current user (one-time)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contest started
 */
contestRouter.post(
  "/:id/start",
  authenticate,
  validateRequest(startContestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const participation = await participationService.startContest(
        req.user!.userId,
        req.params.id as string,
      )
      sendSuccess(res, participation, "Contest started")
    } catch (err) {
      next(err)
    }
  },
)
