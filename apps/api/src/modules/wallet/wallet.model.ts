import { Schema, model, type Document, type Model, type Types } from "mongoose"
import { WALLET_STATUSES, type WalletStatus } from "@skillcontest/shared-types"

export interface IWallet extends Document {
  userId: Types.ObjectId
  /** Available balance in paise (2000 = ₹20). */
  balance: number
  /** Amount locked in pending contest entries — always 0 until escrow lands. */
  locked: number
  totalDeposited: number
  totalWithdrawn: number
  totalWon: number
  totalSpentOnFees: number
  /** frozen = no transactions allowed (fraud/suspension hold). */
  status: WalletStatus
}

const walletSchema = new Schema<IWallet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      unique: true, // one wallet per user
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, "Balance cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Balance must be an integer (paise)",
      },
    },
    locked: {
      type: Number,
      default: 0,
      min: [0, "Locked amount cannot be negative"],
    },
    totalDeposited: {
      type: Number,
      default: 0,
      min: [0, "Total deposited cannot be negative"],
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
      min: [0, "Total withdrawn cannot be negative"],
    },
    totalWon: {
      type: Number,
      default: 0,
      min: [0, "Total won cannot be negative"],
    },
    totalSpentOnFees: {
      type: Number,
      default: 0,
      min: [0, "Total spent on fees cannot be negative"],
    },
    status: {
      type: String,
      enum: {
        values: [...WALLET_STATUSES],
        message: "{VALUE} is not a valid wallet status",
      },
      default: "active",
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

// One wallet per user (defensive — unique: true on the field already creates this)
walletSchema.index({ userId: 1 }, { unique: true })

export const Wallet: Model<IWallet> = model<IWallet>("Wallet", walletSchema)
