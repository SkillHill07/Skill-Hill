import { z } from "zod"

export const leaderboardSchema = z.object({
  params: z.object({
    contestId: z.string().min(1, "Contest id is required"),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
})

export const weeklyLeaderboardSchema = z.object({
  params: z.object({
    contestId: z.string().min(1, "Contest id is required"),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    week: z.coerce.date({ invalid_type_error: "week must be a valid date" }).optional(),
  }),
})

export const myRankSchema = z.object({
  params: z.object({
    contestId: z.string().min(1, "Contest id is required"),
  }),
})

export const availableWeeksSchema = z.object({
  params: z.object({
    contestId: z.string().min(1, "Contest id is required"),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(52).optional(),
  }),
})
