import type { ISubmission } from "../modules/submission/submission.model.js"
import type { SubmissionStatus, SubmissionStatusEvent } from "@skillcontest/shared-types"
import { emitToUser } from "./emitter.js"

/** Phase 4 task 8 — submission status events (see PHASE4_CODE_EXECUTION.md). */
export const SUBMISSION_EVENT = {
  QUEUED: "submission:queued",
  RUNNING: "submission:running",
  COMPLETED: "submission:completed",
} as const

export type SubmissionEventName = (typeof SUBMISSION_EVENT)[keyof typeof SUBMISSION_EVENT]

function userIdOf(submission: ISubmission): string {
  return submission.userId.toString()
}

/** Compact event for queued/running — the client just needs to know the state. */
function statusPayload(
  submission: ISubmission,
  status: SubmissionStatus,
): SubmissionStatusEvent {
  return {
    submissionId: submission._id.toString(),
    contestId: submission.contestId.toString(),
    problemId: submission.problemId.toString(),
    status,
  }
}

/**
 * Full public result for the completed event. Mirrors what GET
 * /submissions/:sid returns — only stored (public) test results and hidden
 * counts. The submitted code is deliberately NOT included. Fields are read
 * directly off the document (works for mongoose docs and test doubles).
 */
function completedPayload(submission: ISubmission): SubmissionStatusEvent {
  return {
    submissionId: submission._id.toString(),
    contestId: submission.contestId.toString(),
    problemId: submission.problemId.toString(),
    status: submission.status,
    totalScore: submission.totalScore,
    publicPassed: submission.publicPassed,
    publicTotal: submission.publicTotal,
    hiddenPassed: submission.hiddenPassed,
    hiddenTotal: submission.hiddenTotal,
    executionTime: submission.executionTime,
    memoryUsed: submission.memoryUsed,
    compilerOutput: submission.compilerOutput,
    judgedAt: submission.judgedAt ? new Date(submission.judgedAt).toISOString() : null,
  }
}

export function emitSubmissionQueued(submission: ISubmission): void {
  emitToUser(userIdOf(submission), SUBMISSION_EVENT.QUEUED, statusPayload(submission, "pending"))
}

export function emitSubmissionRunning(submission: ISubmission): void {
  emitToUser(userIdOf(submission), SUBMISSION_EVENT.RUNNING, statusPayload(submission, "running"))
}

export function emitSubmissionCompleted(submission: ISubmission): void {
  emitToUser(userIdOf(submission), SUBMISSION_EVENT.COMPLETED, completedPayload(submission))
}
