import { Schema, model, type Document, type Model, type Types } from "mongoose"
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@skillcontest/shared-types"

/**
 * Test result for a PUBLIC test case — stored with the actual output so the
 * user can see what went wrong. Hidden test case results are stored ONLY as
 * counts (hiddenPassed/hiddenTotal) — never with outputs or details.
 */
export interface ITestResult {
  testCaseId: string
  passed: boolean
  executionTime: number // ms
  output: string
  expectedOutput: string
}

export interface ISubmission extends Document {
  userId: Types.ObjectId
  contestId: Types.ObjectId
  problemId: Types.ObjectId
  language: string | null // language key; null for mcq (code holds the option index)
  code: string
  /** "run" = public test cases only, no leaderboard effect. "submit" = full judge. */
  mode: "run" | "submit"
  status: SubmissionStatus
  testResults: ITestResult[]
  publicPassed: number
  publicTotal: number
  hiddenPassed: number
  hiddenTotal: number
  totalScore: number
  executionTime: number // max ms across test cases
  memoryUsed: number // max KB across test cases
  compilerOutput: string | null
  submittedAt: Date
  judgedAt: Date | null
}

const testResultSchema = new Schema<ITestResult>(
  {
    testCaseId: {
      type: String,
      required: [true, "Test case id is required"],
    },
    passed: {
      type: Boolean,
      required: [true, "Pass/fail is required"],
    },
    executionTime: {
      type: Number,
      default: 0,
    },
    output: {
      type: String,
      default: "",
    },
    expectedOutput: {
      type: String,
      default: "",
    },
  },
  { _id: false },
)

const submissionSchema = new Schema<ISubmission>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      index: true,
    },
    contestId: {
      type: Schema.Types.ObjectId,
      ref: "Contest",
      required: [true, "Contest is required"],
      index: true,
    },
    problemId: {
      type: Schema.Types.ObjectId,
      ref: "Problem",
      required: [true, "Problem is required"],
      index: true,
    },
    language: {
      type: String,
      default: null,
      maxlength: [50, "Language key is too long"],
    },
    code: {
      type: String,
      required: [true, "Code is required"],
      maxlength: [200000, "Code is too long"],
    },
    mode: {
      type: String,
      enum: {
        values: ["run", "submit"],
        message: "{VALUE} is not a valid submission mode",
      },
      default: "submit",
    },
    status: {
      type: String,
      enum: {
        values: [...SUBMISSION_STATUSES],
        message: "{VALUE} is not a valid submission status",
      },
      default: "pending",
    },
    testResults: {
      type: [testResultSchema],
      default: [],
    },
    publicPassed: { type: Number, default: 0, min: 0 },
    publicTotal: { type: Number, default: 0, min: 0 },
    hiddenPassed: { type: Number, default: 0, min: 0 },
    hiddenTotal: { type: Number, default: 0, min: 0 },
    totalScore: {
      type: Number,
      default: 0,
      min: [0, "Score cannot be negative"],
    },
    executionTime: { type: Number, default: 0, min: 0 },
    memoryUsed: { type: Number, default: 0, min: 0 },
    compilerOutput: {
      type: String,
      default: null,
      maxlength: [4000, "Compiler output is too long"],
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    judgedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v
        return ret
      },
    },
  },
)

// User's submission history per contest
submissionSchema.index({ userId: 1, contestId: 1, createdAt: -1 })
// Recent submissions per problem (judge queue debugging, admin views)
submissionSchema.index({ problemId: 1, createdAt: -1 })

export const Submission: Model<ISubmission> = model<ISubmission>(
  "Submission",
  submissionSchema,
)
