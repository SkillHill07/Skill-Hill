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
  subtitle: z
    .string()
    .max(300, "Subtitle must be at most 300 characters")
    .trim()
    .nullable(),
  imageUrl: z
    .string()
    .url("Image URL must be a valid URL")
    .max(500, "Image URL must be at most 500 characters")
    .nullable(),
  ctaText: z
    .string()
    .max(60, "CTA text must be at most 60 characters")
    .trim()
    .nullable(),
  ctaLink: z
    .string()
    .url("CTA link must be a valid URL")
    .max(500, "CTA link must be at most 500 characters")
    // The frontend renders this as an <a href> — block executable schemes.
    .refine(
      (url) => !/^(javascript|data|vbscript):/i.test(url),
      "CTA link must use a safe scheme (http/https)",
    )
    .nullable(),
}

export const createBannerSchema = z.object({
  body: z.object({
    ...baseFields,
    subtitle: baseFields.subtitle.optional(),
    imageUrl: baseFields.imageUrl.optional(),
    ctaText: baseFields.ctaText.optional(),
    ctaLink: baseFields.ctaLink.optional(),
    order: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  }),
})

export const updateBannerSchema = z.object({
  params: idParam,
  body: z.object({
    title: baseFields.title.optional(),
    subtitle: baseFields.subtitle.optional(),
    imageUrl: baseFields.imageUrl.optional(),
    ctaText: baseFields.ctaText.optional(),
    ctaLink: baseFields.ctaLink.optional(),
    order: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  }),
})

export const deleteBannerSchema = z.object({
  params: idParam,
})

export const uploadBannerImageSchema = z.object({
  params: idParam,
})

export type CreateBannerBody = z.infer<typeof createBannerSchema>["body"]
export type UpdateBannerBody = z.infer<typeof updateBannerSchema>["body"]
