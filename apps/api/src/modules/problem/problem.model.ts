import { Schema, model, type Document, type Model, type Types } from "mongoose"
import type { Difficulty, ProblemStatus, ProblemType } from "@skillcontest/shared-types"

export interface ITestCase {
  _id?: Types.ObjectId
  input: string
  expectedOutput: string
  isPublic: boolean
  order: number
  description?: string
}

export interface IProblem extends Document {
  contestId: Types.ObjectId
  title: string
  slug: string
  description: string
  imageUrls: string[] // statement diagrams / images (hosted on Cloudflare R2)
  type: ProblemType // "coding" (judged by test cases) or "mcq" (multiple choice)
  difficulty: Difficulty
  points: number
  order: number
  timeLimit: number // ms (coding only)
  memoryLimit: number // MB (coding only)
  languageSupport: string[] // language keys — empty for mcq
  solutionTemplate: Record<string, string> // coding only
  testCases: ITestCase[]
  options: string[] // mcq only
  correctAnswer: number | null // mcq only — 0-based index into options
  mcqLayout: "grid" | "list" // mcq only — 2x2 grid or single-column list
  status: ProblemStatus
}

const testCaseSchema = new Schema<ITestCase>(
  {
    input: {
      type: String,
      required: [true, "Test case input is required"],
    },
    expectedOutput: {
      type: String,
      required: [true, "Test case expected output is required"],
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      default: "",
    },
  },
  { _id: true },
)

const problemSchema = new Schema<IProblem>(
  {
    contestId: {
      type: Schema.Types.ObjectId,
      ref: "Contest",
      required: [true, "Contest is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [300, "Title must be at most 300 characters"],
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug can only contain lowercase letters, numbers, and hyphens"],
    },
    description: {
      type: String,
      required: [true, "Problem description is required"],
    },
    imageUrls: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.every((url) => url.length <= 500),
        message: "Image URLs must be at most 500 characters",
      },
    },
    type: {
      type: String,
      enum: {
        values: ["coding", "mcq"],
        message: "{VALUE} is not a valid problem type",
      },
      default: "coding",
    },
    difficulty: {
      type: String,
      enum: {
        values: ["easy", "medium", "hard"],
        message: "{VALUE} is not a valid difficulty",
      },
      default: "easy",
    },
    points: {
      type: Number,
      required: [true, "Points are required"],
      min: [1, "Points must be at least 1"],
    },
    order: {
      type: Number,
      default: 0,
    },
    timeLimit: {
      type: Number,
      default: 2000,
      min: [100, "Time limit must be at least 100ms"],
      max: [30000, "Time limit must be at most 30000ms"],
    },
    memoryLimit: {
      type: Number,
      default: 256,
      min: [16, "Memory limit must be at least 16MB"],
      max: [1024, "Memory limit must be at most 1024MB"],
    },
    languageSupport: {
      type: [String],
      default: ["javascript", "python"],
      validate: {
        // MCQ problems don't run code — they may have an empty language list.
        validator: function (this: IProblem, v: string[]) {
          return this.type === "mcq" ? true : v.length > 0
        },
        message: "At least one language must be supported",
      },
    },
    solutionTemplate: {
      type: Object,
      default: {},
    },
    testCases: {
      type: [testCaseSchema],
      default: [],
    },
    options: {
      type: [String],
      default: [],
    },
    correctAnswer: {
      type: Number,
      default: null,
      validate: {
        validator: (v: number | null) => v === null || (Number.isInteger(v) && v >= 0),
        message: "correctAnswer must be a non-negative integer index or null",
      },
    },
    mcqLayout: {
      type: String,
      enum: {
        values: ["grid", "list"],
        message: "{VALUE} is not a valid MCQ layout",
      },
      default: "list",
    },
    status: {
      type: String,
      enum: {
        values: ["draft", "published"],
        message: "{VALUE} is not a valid problem status",
      },
      default: "draft",
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        // NEVER expose hidden test cases or their expected outputs to clients.
        // Public test cases keep their expected output (needed by the UI to
        // show examples), hidden ones are stripped entirely.
        if (Array.isArray(ret.testCases)) {
          ret.testCases = (ret.testCases as Array<Record<string, unknown>>).filter(
            (tc) => tc.isPublic === true,
          )
        }
        // NEVER expose the MCQ correct answer to clients (AI_rules D).
        delete ret.correctAnswer
        delete ret.__v
        return ret
      },
    },
  },
)

// A problem belongs to one contest; slug unique per contest
problemSchema.index({ contestId: 1, slug: 1 }, { unique: true })
// Display order within a contest
problemSchema.index({ contestId: 1, order: 1 })

export const Problem: Model<IProblem> = model<IProblem>("Problem", problemSchema)
