import { Schema, model, type Document, type Model, type Types } from "mongoose"
import type { ParticipationStatus } from "@skillcontest/shared-types"

export interface IParticipation extends Document {
  userId: Types.ObjectId
  contestId: Types.ObjectId
  joinedAt: Date
  startedAt: Date | null
  submittedAt: Date | null
  totalScore: number
  rank: number | null
  status: ParticipationStatus
}

const participationSchema = new Schema<IParticipation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    contestId: {
      type: Schema.Types.ObjectId,
      ref: "Contest",
      required: [true, "Contest is required"],
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    totalScore: {
      type: Number,
      default: 0,
      min: [0, "Score cannot be negative"],
    },
    rank: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ["registered", "started", "completed", "timedout"],
        message: "{VALUE} is not a valid participation status",
      },
      default: "registered",
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

// One participation per user per contest
participationSchema.index({ userId: 1, contestId: 1 }, { unique: true })
// Count participants per contest
participationSchema.index({ contestId: 1, status: 1 })
// User's contest history
participationSchema.index({ userId: 1, createdAt: -1 })

export const Participation: Model<IParticipation> = model<IParticipation>(
  "Participation",
  participationSchema,
)
