import { z } from "zod"

const idParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id format"),
})

const baseFields = {
  title: z
    .string()
    .min(1, "Title is required")
    .max(120, "Title must be at most 120 characters")
    .trim(),
  description: z
    .string()
    .min(1, "Description is required")
    .max(1000, "Description must be at most 1000 characters")
    .trim(),
  icon: z.string().max(100, "Icon must be at most 100 characters").trim(),
}

export const createWhyChooseUsSchema = z.object({
  body: z.object({
    ...baseFields,
    icon: baseFields.icon.optional(),
    order: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  }),
})

export const updateWhyChooseUsSchema = z.object({
  params: idParam,
  body: z.object({
    title: baseFields.title.optional(),
    description: baseFields.description.optional(),
    icon: baseFields.icon.optional(),
    order: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  }),
})

export const deleteWhyChooseUsSchema = z.object({
  params: idParam,
})

export type CreateWhyChooseUsBody = z.infer<typeof createWhyChooseUsSchema>["body"]
export type UpdateWhyChooseUsBody = z.infer<typeof updateWhyChooseUsSchema>["body"]
