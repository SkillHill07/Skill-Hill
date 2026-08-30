import { z } from "zod"

export const testCaseSchema = z.object({
  input: z.string().min(1, "Test case input is required"),
  expectedOutput: z.string().min(1, "Test case expected output is required"),
  isPublic: z.boolean().default(false),
  order: z.number().int().default(0),
  description: z.string().max(500, "Description must be at most 500 characters").optional(),
})

export const createProblemSchema = z.object({
  params: z.object({
    contestId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid contest id"),
  }),
  body: z.object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(300, "Title must be at most 300 characters")
      .trim(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug can only contain lowercase letters, numbers, and hyphens")
      .optional(),
    description: z.string().min(1, "Problem description is required"),
    imageUrls: z.array(z.string().url("Image URL must be a valid URL").max(500)).optional(),
    type: z.enum(["coding", "mcq"], {
      errorMap: () => ({ message: "Type must be coding or mcq" }),
    }).default("coding"),
    difficulty: z.enum(["easy", "medium", "hard"], {
      errorMap: () => ({ message: "Difficulty must be easy, medium, or hard" }),
    }),
    points: z.number().int().min(1, "Points must be at least 1"),
    order: z.number().int().default(0),
    timeLimit: z.number().int().min(100).max(30000).default(2000),
    memoryLimit: z.number().int().min(16).max(1024).default(256),
    languageSupport: z.array(z.string().min(1)).optional(),
    solutionTemplate: z.record(z.string()).optional(),
    testCases: z.array(testCaseSchema).default([]),
    options: z.array(z.string().min(1, "Option text cannot be empty")).optional(),
    correctAnswer: z.number().int("correctAnswer must be an integer").nonnegative("correctAnswer cannot be negative").nullable().optional(),
  }).superRefine((data, ctx) => {
    const options = data.options
    if (data.type === "mcq") {
      if (!options || options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "MCQ problems require at least 2 options",
          path: ["options"],
        })
      }
      if (data.correctAnswer === undefined || data.correctAnswer === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "MCQ problems require a correctAnswer (0-based option index)",
          path: ["correctAnswer"],
        })
      } else if (options && data.correctAnswer >= options.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "correctAnswer must be a valid option index",
          path: ["correctAnswer"],
        })
      }
    } else if (!data.languageSupport || data.languageSupport.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Coding problems require at least one supported language",
        path: ["languageSupport"],
      })
    }
  }),
})

export const updateProblemSchema = z.object({
  params: z.object({
    contestId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid contest id"),
    problemId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid problem id"),
  }),
  body: z.object({
    title: z.string().min(3).max(300).trim().optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug can only contain lowercase letters, numbers, and hyphens")
      .optional(),
    description: z.string().min(1).optional(),
    imageUrls: z.array(z.string().url("Image URL must be a valid URL").max(500)).optional(),
    type: z.enum(["coding", "mcq"], {
      errorMap: () => ({ message: "Type must be coding or mcq" }),
    }).optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    points: z.number().int().min(1).optional(),
    order: z.number().int().optional(),
    timeLimit: z.number().int().min(100).max(30000).optional(),
    memoryLimit: z.number().int().min(16).max(1024).optional(),
    languageSupport: z.array(z.string().min(1)).optional(),
    solutionTemplate: z.record(z.string()).optional(),
    status: z.enum(["draft", "published"]).optional(),
    options: z.array(z.string().min(1, "Option text cannot be empty")).optional(),
    correctAnswer: z.number().int("correctAnswer must be an integer").nonnegative("correctAnswer cannot be negative").nullable().optional(),
  }).superRefine((data, ctx) => {
    // Switching to mcq requires options + a valid answer index.
    if (data.type === "mcq") {
      if (!data.options || data.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "MCQ problems require at least 2 options",
          path: ["options"],
        })
      }
      if (data.correctAnswer === undefined || data.correctAnswer === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "MCQ problems require a correctAnswer (0-based option index)",
          path: ["correctAnswer"],
        })
      }
    }
    // Editing an existing MCQ's options must keep the answer in range.
    if (data.options && data.correctAnswer !== undefined && data.correctAnswer !== null) {
      if (data.correctAnswer >= data.options.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "correctAnswer must be a valid option index",
          path: ["correctAnswer"],
        })
      }
    }
    if (data.type === "coding" && data.languageSupport !== undefined && data.languageSupport.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Coding problems require at least one supported language",
        path: ["languageSupport"],
      })
    }
  }),
})

export const deleteProblemSchema = z.object({
  params: z.object({
    contestId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid contest id"),
    problemId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid problem id"),
  }),
})

export const listContestProblemsSchema = z.object({
  params: z.object({
    contestId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid contest id"),
  }),
})

export const getContestProblemSchema = z.object({
  params: z.object({
    contestId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid contest id"),
    problemId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid problem id"),
  }),
})

export const getPracticeProblemSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid problem id"),
  }),
})

export const getPracticeProblemBySlugSchema = z.object({
  params: z.object({
    slug: z.string().min(1).max(200),
  }),
})

export const uploadProblemImageSchema = z.object({
  params: z.object({
    contestId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid contest id"),
    problemId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid problem id"),
  }),
})

export const removeProblemImageSchema = z.object({
  params: z.object({
    contestId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid contest id"),
    problemId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid problem id"),
    index: z.string().regex(/^\d+$/, "Image index must be a non-negative integer"),
  }),
})

export const addTestCaseSchema = z.object({
  params: z.object({
    contestId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid contest id"),
    problemId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid problem id"),
  }),
  body: testCaseSchema,
})

export const removeTestCaseSchema = z.object({
  params: z.object({
    contestId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid contest id"),
    problemId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid problem id"),
    testCaseId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid test case id"),
  }),
})

export const listPracticeProblemsSchema = z.object({
  query: z.object({
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    type: z.enum(["coding", "mcq"]).optional(),
    search: z.string().trim().min(1).max(100).optional(),
    language: z.string().trim().min(1).max(50).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
})

export type CreateProblemBody = z.infer<typeof createProblemSchema>["body"]
export type UpdateProblemBody = z.infer<typeof updateProblemSchema>["body"]
export type TestCaseInput = z.infer<typeof testCaseSchema>
