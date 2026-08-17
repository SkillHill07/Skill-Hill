import { z } from "zod"

export const leaderboardSchema = z.object({
  params: z.object({
    contestId: z.string().min(1, "Contest id is required"),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
})

export const myRankSchema = z.object({
  params: z.object({
    contestId: z.string().min(1, "Contest id is required"),
  }),
})
