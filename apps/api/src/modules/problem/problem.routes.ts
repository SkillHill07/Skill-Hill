import { Router } from "express"
import { problemService } from "./problem.service.js"
import {
  authenticate,
  optionalAuth,
  requireRole,
} from "../auth/middleware/auth.middleware.js"
import { validateRequest } from "../../middlewares/validate-request.js"
import { sendError, sendSuccess } from "../../utils/response.js"
import { uploadImageToR2 } from "../../utils/upload.js"
import {
  createImageUploadMiddleware,
  createImageUploadErrorHandler,
} from "../../utils/upload-middleware.js"
import {
  createProblemSchema,
  updateProblemSchema,
  deleteProblemSchema,
  addTestCaseSchema,
  removeTestCaseSchema,
  uploadProblemImageSchema,
  removeProblemImageSchema,
  listPracticeProblemsSchema,
} from "./problem.validation.js"
import type { Request, Response, NextFunction } from "express"

export const problemRouter: Router = Router()

/** Mounted at /problems — public practice library. */
export const practiceProblemRouter: Router = Router()

/**
 * @openapi
 * /problems:
 *   get:
 *     tags: [Problems]
 *     summary: Practice library — problems from public contests
 *     description: >
 *       Problems from active/frozen/settled contests only. Hidden test cases
 *       and MCQ answers are stripped. Filters: difficulty, type, search,
 *       language. Paginated.
 *     parameters:
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [easy, medium, hard]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [coding, mcq]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
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
 *         description: Paginated practice problems with contest info
 */
practiceProblemRouter.get(
  "/",
  optionalAuth,
  validateRequest(listPracticeProblemsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await problemService.listPracticeProblems({
        difficulty: req.query.difficulty as string | undefined,
        type: req.query.type as string | undefined,
        search: req.query.search as string | undefined,
        language: req.query.language as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      })
      sendSuccess(res, result)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /problems/{id}:
 *   get:
 *     tags: [Problems]
 *     summary: Single practice problem
 *     description: >
 *       Full problem statement with public examples and starter templates.
 *       404 when the owning contest is draft/cancelled (treated as hidden).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Problem details
 *       404:
 *         description: Problem not found or not publicly visible
 */
practiceProblemRouter.get(
  "/:id",
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const problem = await problemService.getPracticeProblem(req.params.id as string)
      sendSuccess(res, problem)
    } catch (err) {
      next(err)
    }
  },
)

const uploadProblemImageMiddleware = createImageUploadMiddleware("image")
const handleProblemImageErrors = createImageUploadErrorHandler(
  uploadProblemImageMiddleware,
  { fieldLabel: "Problem image", code: "INVALID_PROBLEM_IMAGE" },
)

/**
 * @openapi
 * /contests/{contestId}/problems:
 *   get:
 *     tags: [Problems]
 *     summary: List problems in a contest (public — hidden test cases stripped)
 *     parameters:
 *       - in: path
 *         name: contestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Problem list (no hidden test cases)
 */
problemRouter.get(
  "/:contestId/problems",
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Admin/creator can request hidden test cases via ?includeHidden=true
      const includeHidden = req.query.includeHidden === "true"
      if (includeHidden && req.user?.role !== "admin" && req.user?.role !== "creator") {
        sendError(res, "You do not have permission to view hidden test cases", 403)
        return
      }
      const problems = await problemService.listProblems(
        req.params.contestId as string,
        includeHidden,
      )
      sendSuccess(res, problems)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{contestId}/problems/{problemId}:
 *   get:
 *     tags: [Problems]
 *     summary: Get a single problem (public — hidden test cases stripped)
 *     parameters:
 *       - in: path
 *         name: contestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: problemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Problem details
 *       404:
 *         description: Problem not found
 */
problemRouter.get(
  "/:contestId/problems/:problemId",
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Admin/creator can request hidden test cases via ?includeHidden=true
      const includeHidden = req.query.includeHidden === "true"
      if (includeHidden && req.user?.role !== "admin" && req.user?.role !== "creator") {
        sendError(res, "You do not have permission to view hidden test cases", 403)
        return
      }
      const problem = await problemService.getProblem(
        req.params.contestId as string,
        req.params.problemId as string,
        includeHidden,
      )
      sendSuccess(res, problem)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{contestId}/problems:
 *   post:
 *     tags: [Problems]
 *     summary: Add a problem to a draft contest — admin/creator
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
 *             required: [title, description, points]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               type: { type: string, enum: [coding, mcq], default: coding }
 *               difficulty: { type: string, enum: [easy, medium, hard] }
 *               points: { type: integer }
 *               timeLimit: { type: integer, description: "ms — coding only" }
 *               memoryLimit: { type: integer, description: "MB — coding only" }
 *               languageSupport: { type: array, items: { type: string }, description: "required for coding, empty for mcq" }
 *               solutionTemplate: { type: object }
 *               testCases:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [input, expectedOutput]
 *                   properties:
 *                     input: { type: string }
 *                     expectedOutput: { type: string }
 *                     isPublic: { type: boolean }
 *                     description: { type: string }
 *               options: { type: array, items: { type: string }, description: "mcq only — at least 2 choices" }
 *               correctAnswer: { type: integer, description: "mcq only — 0-based index into options, never returned publicly" }
 *     responses:
 *       201:
 *         description: Problem created
 */
problemRouter.post(
  "/:contestId/problems",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(createProblemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const problem = await problemService.createProblem(
        req.params.contestId as string,
        req.body,
      )
      sendSuccess(res, problem, "Problem created", 201)
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{contestId}/problems/{problemId}:
 *   patch:
 *     tags: [Problems]
 *     summary: Update a problem (draft contest only) — admin/creator
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: problemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated problem
 */
problemRouter.patch(
  "/:contestId/problems/:problemId",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(updateProblemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const problem = await problemService.updateProblem(
        req.params.contestId as string,
        req.params.problemId as string,
        req.body,
      )
      sendSuccess(res, problem, "Problem updated")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{contestId}/problems/{problemId}:
 *   delete:
 *     tags: [Problems]
 *     summary: Remove a problem (draft contest only) — admin/creator
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: problemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Problem removed
 */
problemRouter.delete(
  "/:contestId/problems/:problemId",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(deleteProblemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await problemService.deleteProblem(
        req.params.contestId as string,
        req.params.problemId as string,
      )
      sendSuccess(res, null, "Problem removed")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{contestId}/problems/{problemId}/test-cases:
 *   post:
 *     tags: [Problems]
 *     summary: Add a test case to a problem — admin/creator
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: problemId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [input, expectedOutput]
 *             properties:
 *               input: { type: string }
 *               expectedOutput: { type: string }
 *               isPublic: { type: boolean }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Test case added
 */
problemRouter.post(
  "/:contestId/problems/:problemId/test-cases",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(addTestCaseSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const problem = await problemService.addTestCase(
        req.params.contestId as string,
        req.params.problemId as string,
        req.body,
      )
      sendSuccess(res, problem, "Test case added")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{contestId}/problems/{problemId}/test-cases/{testCaseId}:
 *   delete:
 *     tags: [Problems]
 *     summary: Remove a test case — admin/creator
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: problemId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: testCaseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Test case removed
 */
problemRouter.delete(
  "/:contestId/problems/:problemId/test-cases/:testCaseId",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(removeTestCaseSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const problem = await problemService.removeTestCase(
        req.params.contestId as string,
        req.params.problemId as string,
        req.params.testCaseId as string,
      )
      sendSuccess(res, problem, "Test case removed")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{contestId}/problems/{problemId}/images:
 *   post:
 *     tags: [Problems]
 *     summary: Upload a problem statement image (appends to imageUrls) — admin/creator
 *     description: >
 *       Accepts multipart/form-data with an "image" file (JPEG, PNG, or WebP, max 5MB).
 *       The image is compressed to WebP (max 1280x1024) and uploaded to Cloudflare R2.
 *       Only while the contest is a draft.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: problemId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Statement image (JPEG, PNG, or WebP, max 5MB)
 *     responses:
 *       200:
 *         description: Image uploaded, problem imageUrls updated
 *       400:
 *         description: Invalid image or no file provided
 */
problemRouter.post(
  "/:contestId/problems/:problemId/images",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(uploadProblemImageSchema),
  handleProblemImageErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw Object.assign(new Error("A problem image is required (field: image)"), {
          status: 400,
          code: "IMAGE_REQUIRED",
        })
      }
      // Verify the problem exists and is editable BEFORE uploading, so an
      // unknown or locked problem can't orphan an R2 object.
      await problemService.assertProblemEditable(
        req.params.contestId as string,
        req.params.problemId as string,
      )
      const imageUrl = await uploadImageToR2(req.file.buffer, req.file.mimetype, {
        folder: "problems",
        identifier: req.params.problemId as string,
        maxWidth: 1280,
        maxHeight: 1024,
        quality: 82,
      })
      const problem = await problemService.addProblemImage(
        req.params.contestId as string,
        req.params.problemId as string,
        imageUrl,
      )
      sendSuccess(res, problem, "Problem image uploaded")
    } catch (err) {
      next(err)
    }
  },
)

/**
 * @openapi
 * /contests/{contestId}/problems/{problemId}/images/{index}:
 *   delete:
 *     tags: [Problems]
 *     summary: Remove a problem statement image by index — admin/creator
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: problemId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: index
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Image removed
 *       400:
 *         description: Image index out of range
 */
problemRouter.delete(
  "/:contestId/problems/:problemId/images/:index",
  authenticate,
  requireRole("admin", "creator"),
  validateRequest(removeProblemImageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const problem = await problemService.removeProblemImage(
        req.params.contestId as string,
        req.params.problemId as string,
        Number(req.params.index),
      )
      sendSuccess(res, problem, "Problem image removed")
    } catch (err) {
      next(err)
    }
  },
)
