import { z } from "zod"

export const updateLogoSchema = z.object({
  body: z.object({
    logoUrl: z
      .string()
      .url("Logo URL must be a valid URL")
      .max(500, "Logo URL must be at most 500 characters")
      .nullable()
      .optional(),
    altText: z
      .string()
      .max(120, "Alt text must be at most 120 characters")
      .trim()
      .optional(),
    tagline: z
      .string()
      .max(200, "Tagline must be at most 200 characters")
      .trim()
      .nullable()
      .optional(),
  }),
})

export type UpdateLogoBody = z.infer<typeof updateLogoSchema>["body"]
