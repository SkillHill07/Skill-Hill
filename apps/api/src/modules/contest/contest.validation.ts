import { z } from "zod"

const OBJECT_ID = /^[a-f0-9]{24}$/i

export const createContestSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title must be at most 200 characters")
      .trim(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug can only contain lowercase letters, numbers, and hyphens")
      .optional(),
    description: z.string().max(10000, "Description must be at most 10000 characters").optional(),
    type: z.enum(["free", "paid"], {
      errorMap: () => ({ message: "Type must be free or paid" }),
    }).default("free"),
    startTime: z.coerce.date({ invalid_type_error: "Start time must be a valid date" }),
    endTime: z.coerce.date({ invalid_type_error: "End time must be a valid date" }),
    entryFee: z.number().int("Entry fee must be an integer (paise)").nonnegative("Entry fee cannot be negative").optional(),
    prizePool: z.number().int("Prize pool must be an integer (paise)").nonnegative("Prize pool cannot be negative"),
    maxParticipants: z.number().int().positive("Max participants must be at least 1").optional(),
    rules: z.string().max(20000, "Rules must be at most 20000 characters").optional(),
  }).refine(
    (data) => data.endTime.getTime() > data.startTime.getTime(),
    { message: "endTime must be after startTime", path: ["endTime"] },
  ).superRefine((data, ctx) => {
    // Strict fee coupling: free contests cannot charge, paid contests must charge.
    if (data.type === "paid" && (data.entryFee === undefined || data.entryFee <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Paid contests require an entry fee greater than 0 (paise)",
        path: ["entryFee"],
      })
    }
    if (data.type === "free" && data.entryFee !== undefined && data.entryFee > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Free contests cannot have an entry fee — set type to paid to charge",
        path: ["entryFee"],
      })
    }
  }),
})

export const updateContestSchema = z.object({
  params: z.object({
    id: z.string().regex(OBJECT_ID, "Invalid contest id"),
  }),
  body: z.object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title must be at most 200 characters")
      .trim()
      .optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug can only contain lowercase letters, numbers, and hyphens")
      .optional(),
    description: z.string().max(10000, "Description must be at most 10000 characters").optional(),
    type: z.enum(["free", "paid"], {
      errorMap: () => ({ message: "Type must be free or paid" }),
    }).optional(),
    startTime: z.coerce.date({ invalid_type_error: "Start time must be a valid date" }).optional(),
    endTime: z.coerce.date({ invalid_type_error: "End time must be a valid date" }).optional(),
    entryFee: z.number().int("Entry fee must be an integer (paise)").nonnegative("Entry fee cannot be negative").optional(),
    prizePool: z.number().int("Prize pool must be an integer (paise)").nonnegative("Prize pool cannot be negative").optional(),
    maxParticipants: z.number().int().positive("Max participants must be at least 1").nullable().optional(),
    rules: z.string().max(20000, "Rules must be at most 20000 characters").optional(),
  }).refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.endTime.getTime() > data.startTime.getTime()
      }
      return true
    },
    { message: "endTime must be after startTime", path: ["endTime"] },
  ).superRefine((data, ctx) => {
    // Switching to paid requires a positive entry fee. Free contests are
    // normalized to entryFee = 0 in the service, so no check needed here
    // (an entryFee bump on a free contest is forced back to 0 there too).
    if (data.type === "paid" && (data.entryFee === undefined || data.entryFee <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Paid contests require an entry fee greater than 0 (paise)",
        path: ["entryFee"],
      })
    }
  }),
})

export const getContestSchema = z.object({
  params: z.object({
    id: z.string().regex(OBJECT_ID, "Invalid contest id"),
  }),
})

export const publishContestSchema = z.object({
  params: z.object({
    id: z.string().regex(OBJECT_ID, "Invalid contest id"),
  }),
})

export const cancelContestSchema = z.object({
  params: z.object({
    id: z.string().regex(OBJECT_ID, "Invalid contest id"),
  }),
  body: z.object({
    reason: z.string().max(500, "Reason must be at most 500 characters").optional(),
  }),
})

export const freezeContestSchema = z.object({
  params: z.object({
    id: z.string().regex(OBJECT_ID, "Invalid contest id"),
  }),
})

export const settleContestSchema = z.object({
  params: z.object({
    id: z.string().regex(OBJECT_ID, "Invalid contest id"),
  }),
})

export const joinContestSchema = z.object({
  params: z.object({
    id: z.string().regex(OBJECT_ID, "Invalid contest id"),
  }),
  body: z.object({
    turnstileToken: z.string().min(1, "Turnstile verification is required"),
  }),
})

export const startContestSchema = z.object({
  params: z.object({
    id: z.string().regex(OBJECT_ID, "Invalid contest id"),
  }),
})

export const listContestsSchema = z.object({
  query: z.object({
    status: z.enum(["active", "upcoming", "settled", "frozen", "cancelled", "draft"], {
      errorMap: () => ({ message: "Status must be one of: active, upcoming, settled, frozen, cancelled, draft" }),
    }).optional(),
    problemType: z.enum(["coding", "mcq", "mixed"], {
      errorMap: () => ({ message: "problemType must be coding, mcq, or mixed" }),
    }).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
})

export type CreateContestBody = z.infer<typeof createContestSchema>["body"]
export type UpdateContestBody = z.infer<typeof updateContestSchema>["body"]
export type ListContestsQuery = z.infer<typeof listContestsSchema>["query"]
