import { z } from "zod"

const idParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id format"),
})

const baseFields = {
  question: z
    .string()
    .min(1, "Question is required")
    .max(300, "Question must be at most 300 characters")
    .trim(),
  answer: z
    .string()
    .min(1, "Answer is required")
    .max(5000, "Answer must be at most 5000 characters")
    .trim(),
  category: z
    .string()
    .max(60, "Category must be at most 60 characters")
    .trim()
    .nullable(),
}

export const createFaqSchema = z.object({
  body: z.object({
    ...baseFields,
    category: baseFields.category.optional(),
    order: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  }),
})

export const updateFaqSchema = z.object({
  params: idParam,
  body: z.object({
    question: baseFields.question.optional(),
    answer: baseFields.answer.optional(),
    category: baseFields.category.optional(),
    order: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  }),
})

export const deleteFaqSchema = z.object({
  params: idParam,
})

export type CreateFaqBody = z.infer<typeof createFaqSchema>["body"]
export type UpdateFaqBody = z.infer<typeof updateFaqSchema>["body"]
