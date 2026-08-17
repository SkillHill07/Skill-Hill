import { Router } from "express"
import { submissionService } from "./submission.service.js"
import {
  authenticate,
  requireRole,
} from "../auth/middleware/auth.middleware.js"
import { validateRequest } from "../../middlewares/validate-request.js"
import { sendSuccess } from "../../utils/response.js"
import { adminListSubmissionsSchema } from "./submission.validation.js"
import type { Request, Response, NextFunction } from "express"
import type { SubmissionStatus } from "@skillcontest/shared-types"

export const adminSubmissionRouter: Router = Router()

adminSubmissionRouter.use(authenticate)

/**
 * @openapi
 * /admin/contests/{contestId}/submissions:
 *   get:
 *     tags: [Admin - Submissions]
 *     summary: Audit view — all submissions in a contest (admin/creator)
 *     description: >
 *       Paginated list of every submission for a contest, newest first, with
 *       the participant's name/email and the problem's title populated.
 *       Full detail is included (code, public test results, compiler output,
 *       timestamps) so admins can audit the judging lifecycle. Hidden test
 *       case details are never stored, so only pass/fail counts are visible.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, running, accepted, rejected, error, timeout]
 *         description: Filter by submission status
 *       - in: query
 *         name: problemId
 *         schema:
 *           type: string
 *         description: Filter by problem
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by participant
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *         description: Filter by language key
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
 *         description: Paginated submissions with populated user/problem
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin/creator role required
 *       404:
 *         description: Contest not found
 */
adminSubmissionRouter.get(
  "/contests/:contestId/submissions",
  requireRole("admin", "creator"),
  validateRequest(adminListSubmissionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await submissionService.listSubmissionsAdmin(
        req.params.contestId as string,
        {
          status: req.query.status as SubmissionStatus | undefined,
          problemId: req.query.problemId as string | undefined,
          userId: req.query.userId as string | undefined,
          language: req.query.language as string | undefined,
          page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        },
      )
      sendSuccess(res, result)
    } catch (err) {
      next(err)
    }
  },
)
