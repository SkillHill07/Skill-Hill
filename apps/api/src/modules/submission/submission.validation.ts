import { z } from "zod"
import { SUBMISSION_STATUSES } from "@skillcontest/shared-types"

export const createSubmissionSchema = z.object({
  params: z.object({
    contestId: z.string().min(1, "Contest id is required"),
  }),
  body: z.object({
    problemId: z.string().min(1, "Problem id is required"),
    // Required for coding problems; ignored/absent for mcq (the answer index
    // goes in `code`).
    language: z.string().min(1, "Language key is required").max(50).optional(),
    // For coding: the source code. For mcq: the chosen option index as string.
    code: z.string().min(1, "Code is required").max(200000, "Code is too long"),
  }),
})

export const listSubmissionsSchema = z.object({
  params: z.object({
    contestId: z.string().min(1, "Contest id is required"),
  }),
})

export const getSubmissionSchema = z.object({
  params: z.object({
    contestId: z.string().min(1, "Contest id is required"),
    submissionId: z.string().min(1, "Submission id is required"),
  }),
})

/**
 * Admin audit view — all submissions for a contest (admin/creator only).
 * The query part is validated here (400 on bad input) but read from req.query
 * in the handler, since validateRequest only re-attaches req.body.
 */
export const adminListSubmissionsSchema = z.object({
  params: z.object({
    contestId: z.string().min(1, "Contest id is required"),
  }),
  query: z.object({
    status: z.enum(SUBMISSION_STATUSES).optional(),
    problemId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid problem id").optional(),
    userId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid user id").optional(),
    language: z.string().max(50, "Language key is too long").optional(),
    page: z.coerce.number().int().min(1, "Page must be at least 1").optional(),
    limit: z
      .coerce
      .number()
      .int()
      .min(1, "Limit must be at least 1")
      .max(100, "Limit must be at most 100")
      .optional(),
  }),
})

export type CreateSubmissionBody = z.infer<typeof createSubmissionSchema>["body"]
