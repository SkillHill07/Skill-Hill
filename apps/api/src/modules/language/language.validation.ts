import { z } from "zod"

export const createLanguageSchema = z.object({
  body: z.object({
    key: z
      .string()
      .regex(/^[a-z][a-z0-9]*$/, "Key can only contain lowercase letters and numbers")
      .toLowerCase()
      .trim(),
    name: z.string().min(1, "Name is required").max(50, "Name must be at most 50 characters").trim(),
    version: z.string().min(1, "Version is required").max(50, "Version must be at most 50 characters").trim(),
    extension: z
      .string()
      .regex(/^[a-z0-9]+$/, "Extension must be alphanumeric without a leading dot")
      .toLowerCase()
      .trim(),
    compileCommand: z.string().max(500, "Compile command must be at most 500 characters").nullable().optional(),
    runCommand: z.string().min(1, "Run command is required").max(500, "Run command must be at most 500 characters").trim(),
    dockerImage: z.string().min(1, "Docker image is required").max(200, "Docker image must be at most 200 characters").trim(),
    logoUrl: z.string().url("Logo URL must be a valid URL").max(500).nullable().optional(),
    enabled: z.boolean().optional(),
    order: z.number().int().min(0).optional(),
  }),
})

export const updateLanguageSchema = z.object({
  params: z.object({
    key: z.string().min(1, "Language key is required"),
  }),
  body: z.object({
    name: z.string().min(1).max(50).trim().optional(),
    version: z.string().min(1).max(50).trim().optional(),
    extension: z
      .string()
      .regex(/^[a-z0-9]+$/, "Extension must be alphanumeric without a leading dot")
      .toLowerCase()
      .trim()
      .optional(),
    compileCommand: z.string().max(500).nullable().optional(),
    runCommand: z.string().min(1).max(500).trim().optional(),
    dockerImage: z.string().min(1).max(200).trim().optional(),
    logoUrl: z.string().url("Logo URL must be a valid URL").max(500).nullable().optional(),
    enabled: z.boolean().optional(),
    order: z.number().int().min(0).optional(),
  }),
})

export const deleteLanguageSchema = z.object({
  params: z.object({
    key: z.string().min(1, "Language key is required"),
  }),
})

export type CreateLanguageBody = z.infer<typeof createLanguageSchema>["body"]
export type UpdateLanguageBody = z.infer<typeof updateLanguageSchema>["body"]
