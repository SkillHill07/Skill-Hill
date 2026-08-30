import { Schema, model, type Document, type Model, type Types } from "mongoose"
import type { ContestStatus, ContestType } from "@skillcontest/shared-types"

export interface IContest extends Document {
  title: string
  slug: string
  description: string
  problemIds: Types.ObjectId[]
  startTime: Date
  endTime: Date
  type: ContestType // "free" forces entryFee = 0
  problemType: "coding" | "mcq" | "mixed"
  entryFee: number // paise (2000 = ₹20)
  prizePool: number // paise
  maxParticipants: number | null
  status: ContestStatus
  rules: string
  createdBy: Types.ObjectId
}

const contestSchema = new Schema<IContest>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [200, "Title must be at most 200 characters"],
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug can only contain lowercase letters, numbers, and hyphens"],
    },
    description: {
      type: String,
      default: "",
      maxlength: [10000, "Description must be at most 10000 characters"],
    },
    problemIds: {
      type: [Schema.Types.ObjectId],
      ref: "Problem",
      default: [],
    },
    startTime: {
      type: Date,
      required: [true, "Start time is required"],
    },
    endTime: {
      type: Date,
      required: [true, "End time is required"],
    },
    type: {
      type: String,
      enum: {
        values: ["free", "paid"],
        message: "{VALUE} is not a valid contest type",
      },
      default: "free",
    },
    problemType: {
      type: String,
      enum: {
        values: ["coding", "mcq", "mixed"],
        message: "{VALUE} is not a valid problem type",
      },
      default: "coding",
    },
    entryFee: {
      type: Number,
      required: [true, "Entry fee is required"],
      min: [0, "Entry fee cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Entry fee must be an integer (paise)",
      },
    },
    prizePool: {
      type: Number,
      required: [true, "Prize pool is required"],
      min: [0, "Prize pool cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Prize pool must be an integer (paise)",
      },
    },
    maxParticipants: {
      type: Number,
      default: null,
      min: [1, "Max participants must be at least 1"],
    },
    status: {
      type: String,
      enum: {
        values: ["draft", "active", "frozen", "settled", "cancelled"],
        message: "{VALUE} is not a valid contest status",
      },
      default: "draft",
    },
    rules: {
      type: String,
      default: "",
      maxlength: [20000, "Rules must be at most 20000 characters"],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is required"],
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

// Listing queries: filter by status + sort by startTime
contestSchema.index({ status: 1, startTime: 1 })
// Leaderboard/prize reads by contest
contestSchema.index({ endTime: 1 })

export const Contest: Model<IContest> = model<IContest>("Contest", contestSchema)
