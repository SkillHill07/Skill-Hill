import { Router } from "express"
import { submissionService } from "./submission.service.js"
import { authenticate } from "../auth/middleware/auth.middleware.js"
import { validateRequest } from "../../middlewares/validate-request.js"
import { submissionLimiter } from "./submission.rate-limit.js"
import { sendSuccess } from "../../utils/response.js"
import {
  createSubmissionSchema,
  listSubmissionsSchema,
  getSubmissionSchema,
} from "./submission.validation.js"
import type { Request, Response, NextFunction } from "express"

export const submissionRouter: Router = Router()

/**
 * @openapi
 * /contests/{contestId}/submissions:
 *   post:
 *     tags: [Submissions]
 *     summary: Submit code for judging (returns immediately, judged async)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [problemId, code]
 *             properties:
 *               problemId: { type: string }
 *               language: { type: string, description: "language key — required for coding problems" }
 *               code: { type: string, description: "source code, or the chosen option index for mcq" }
 *     responses:
 *       202:
 *         description: Submission queued for judging
 *       429:
 *         description: Rate limited (1 submission / 30s / problem)
 */
submissionRouter.post(
  "/:contestId/submissions",
  authenticate,
  validateRequest(createSubmissionSchema),
  submissionLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const submission = await submissionService.createSubmission(
        req.user!.userId,
        req.params.contestId as string,
        req.body,
      )
      sendSuccess(res, submission, "Submission queued for judging", 202)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{contestId}/submissions:
 *   get:
 *     tags: [Submissions]
 *     summary: List the current user's submissions for a contest
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
 *         description: Own submissions, newest first
 */
submissionRouter.get(
  "/:contestId/submissions",
  authenticate,
  validateRequest(listSubmissionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const submissions = await submissionService.listSubmissions(
        req.user!.userId,
        req.params.contestId as string,
      )
      sendSuccess(res, submissions)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{contestId}/submissions/{submissionId}:
 *   get:
 *     tags: [Submissions]
 *     summary: Get a single submission (owner or staff)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Submission details (public test results only)
 *       403:
 *         description: Not the owner
 */
submissionRouter.get(
  "/:contestId/submissions/:submissionId",
  authenticate,
  validateRequest(getSubmissionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const submission = await submissionService.getSubmission(
        req.user!.userId,
        req.params.contestId as string,
        req.params.submissionId as string,
        req.user?.role,
      )
      sendSuccess(res, submission)
    } catch (err) {
      next(err)
    }
  },
)
