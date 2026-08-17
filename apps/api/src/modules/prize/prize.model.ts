import { Schema, model, type Document, type Model, type Types } from "mongoose"
import { PRIZE_STATUSES, type PrizeStatus } from "@skillcontest/shared-types"

export interface IPrize extends Document {
  contestId: Types.ObjectId
  userId: Types.ObjectId
  /** Final rank in the frozen standings (competition ranking — may skip numbers). */
  rank: number
  /** Amount in paise. */
  prizeAmount: number
  /** pending → credited (wallet) | failed (credit error, retried by redistribute). */
  status: PrizeStatus
  failureReason: string | null
  creditedAt: Date | null
}

const prizeSchema = new Schema<IPrize>(
  {
    contestId: {
      type: Schema.Types.ObjectId,
      ref: "Contest",
      required: [true, "Contest is required"],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    rank: {
      type: Number,
      required: [true, "Rank is required"],
      min: [1, "Rank must be at least 1"],
    },
    prizeAmount: {
      type: Number,
      required: [true, "Prize amount is required"],
      min: [1, "Prize amount must be at least 1 paise"],
      validate: {
        validator: Number.isInteger,
        message: "Prize amount must be an integer (paise)",
      },
    },
    status: {
      type: String,
      enum: {
        values: [...PRIZE_STATUSES],
        message: "{VALUE} is not a valid prize status",
      },
      default: "pending",
    },
    failureReason: {
      type: String,
      default: null,
    },
    creditedAt: {
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

// Idempotency: one prize per (contest, user) — re-running distribution can
// never duplicate a winner.
prizeSchema.index({ contestId: 1, userId: 1 }, { unique: true })
// Winner lists per contest + user prize history
prizeSchema.index({ contestId: 1, rank: 1 })
prizeSchema.index({ userId: 1, createdAt: -1 })

export const Prize: Model<IPrize> = model<IPrize>("Prize", prizeSchema)
