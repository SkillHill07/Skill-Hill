import { z } from "zod"

const OBJECT_ID = /^[a-f0-9]{24}$/

export const contestPrizesSchema = z.object({
  params: z.object({
    id: z.string().regex(OBJECT_ID, "Invalid contest id"),
  }),
})

export const listUserPrizesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
})

export const recentWinnersSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
})

export const adminRedistributeSchema = z.object({
  params: z.object({
    id: z.string().regex(OBJECT_ID, "Invalid contest id"),
  }),
})
