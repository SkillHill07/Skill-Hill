import { Submission, type ISubmission } from "./submission.model.js"
import { Contest } from "../contest/contest.model.js"
import { Participation } from "../contest/participation.model.js"
import { Problem } from "../problem/problem.model.js"
import { Language } from "../language/language.model.js"
import { enqueueSubmission } from "../judge/judge.queue.js"
import { emitSubmissionQueued } from "../../sockets/index.js"
import { logger } from "../../utils/logger.js"
import type { SubmissionStatus } from "@skillcontest/shared-types"
import type { CreateSubmissionBody } from "./submission.validation.js"

/**
 * Create a submission and enqueue it for judging.
 *
 * Server-side checks (AI_rules D — never trust the client):
 *  1. Contest exists and is active
 *  2. User has joined the contest
 *  3. Problem belongs to the contest
 *  4. For coding: language exists + enabled in the catalog
 *     For mcq: `code` is a valid option index (0..options.length-1)
 *
 * Rate limiting (1 per 30s per problem) is enforced at the route boundary.
 */
async function createSubmission(
  userId: string,
  contestId: string,
  input: CreateSubmissionBody,
): Promise<ISubmission> {
  const contest = await Contest.findById(contestId)
  if (!contest) {
    throw Object.assign(new Error("Contest not found"), {
      status: 404,
      code: "CONTEST_NOT_FOUND",
    })
  }

  const isPracticeMode = input.mode === "run" || contest.status !== "active"

  // Find the problem early to check type
  const problemCheck = await Problem.findOne({ _id: input.problemId, contestId })
  if (!problemCheck) {
    throw Object.assign(new Error("Problem not found in this contest"), {
      status: 404,
      code: "PROBLEM_NOT_FOUND",
    })
  }

  // MCQ problems can always be submitted in practice mode (no Docker, no participation check)
  const isMcqPractice = problemCheck.type === "mcq" && isPracticeMode

  // For live contest submissions, require active status and participation
  if (!isPracticeMode && !isMcqPractice) {
    if (contest.status !== "active") {
      throw Object.assign(new Error("This contest is not accepting submissions"), {
        status: 400,
        code: "CONTEST_NOT_ACTIVE",
      })
    }
    const participation = await Participation.findOne({ userId, contestId })
    if (!participation) {
      throw Object.assign(new Error("Join the contest before submitting"), {
        status: 403,
        code: "NOT_JOINED",
      })
    }
  }

  const problem = problemCheck

  let language: string | null = null
  if (problem.type === "mcq") {
    // For mcq, `code` is the chosen option index (string).
    const selected = Number(input.code)
    if (!Number.isInteger(selected) || selected < 0 || selected >= problem.options.length) {
      throw Object.assign(new Error("Selected option is not a valid choice"), {
        status: 400,
        code: "INVALID_MCQ_ANSWER",
      })
    }
  } else {
    if (!input.language) {
      throw Object.assign(new Error("Language is required for coding problems"), {
        status: 400,
        code: "LANGUAGE_REQUIRED",
      })
    }
    const lang = await Language.findOne({ key: input.language, enabled: true })
    if (!lang) {
      throw Object.assign(new Error("Unsupported or disabled language"), {
        status: 400,
        code: "UNSUPPORTED_LANGUAGE",
      })
    }
    language = input.language
  }

  const submission = await Submission.create({
    userId,
    contestId,
    problemId: input.problemId,
    language,
    code: input.code,
    // Runs are a coding-problem affordance; MCQs are always scored submits.
    // Practice mode submissions (non-active contest or explicit run mode) don't affect leaderboard.
    mode: problem.type === "mcq" ? "submit" : (input.mode ?? "submit"),
    status: "pending",
    practice: isPracticeMode,
  })

  await enqueueSubmission(submission._id.toString())
  emitSubmissionQueued(submission)

  logger.info(
    { userId, contestId, problemId: input.problemId, submissionId: submission._id.toString() },
    "submission_created",
  )
  return submission
}

/** List the current user's submissions for a contest (newest first). */
async function listSubmissions(
  userId: string,
  contestId: string,
): Promise<ISubmission[]> {
  return Submission.find({ userId, contestId }).sort({ createdAt: -1 })
}

/** Get a single submission — owner-only, staff may view any. */
async function getSubmission(
  userId: string,
  contestId: string,
  submissionId: string,
  viewerRole?: string,
): Promise<ISubmission> {
  const submission = await Submission.findOne({ _id: submissionId, contestId })
  if (!submission) {
    throw Object.assign(new Error("Submission not found"), {
      status: 404,
      code: "SUBMISSION_NOT_FOUND",
    })
  }

  const isStaff = viewerRole === "admin" || viewerRole === "creator"
  if (submission.userId.toString() !== userId && !isStaff) {
    throw Object.assign(new Error("You cannot view this submission"), {
      status: 403,
      code: "FORBIDDEN",
    })
  }
  return submission
}

export interface AdminSubmissionFilters {
  status?: SubmissionStatus
  problemId?: string
  userId?: string
  language?: string
  page: number
  limit: number
}

/**
 * Admin audit view — every submission in a contest (admin/creator only),
 * newest first, with the participant's name/email and the problem's title
 * populated. Full detail is included (code, public test results, compiler
 * output, timestamps) so admins can audit the judging lifecycle.
 * Hidden case details are never stored, so nothing leaks beyond the counts.
 */
async function listSubmissionsAdmin(
  contestId: string,
  filters: AdminSubmissionFilters,
): Promise<{
  submissions: Array<Record<string, unknown>>
  total: number
  page: number
  limit: number
  totalPages: number
}> {
  const contestExists = await Contest.exists({ _id: contestId })
  if (!contestExists) {
    throw Object.assign(new Error("Contest not found"), {
      status: 404,
      code: "CONTEST_NOT_FOUND",
    })
  }

  const match: Record<string, unknown> = { contestId }
  if (filters.status) match.status = filters.status
  if (filters.problemId) match.problemId = filters.problemId
  if (filters.userId) match.userId = filters.userId
  if (filters.language) match.language = filters.language

  const [submissions, total] = await Promise.all([
    Submission.find(match)
      .sort({ createdAt: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .populate("userId", "firstName lastName email")
      .populate("problemId", "title slug type difficulty points"),
    Submission.countDocuments(match),
  ])

  logger.info({ contestId, total }, "admin_submissions_listed")
  return {
    submissions: submissions.map((s) => s.toJSON()),
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  }
}

export const submissionService = {
  createSubmission,
  listSubmissions,
  getSubmission,
  listSubmissionsAdmin,
}
