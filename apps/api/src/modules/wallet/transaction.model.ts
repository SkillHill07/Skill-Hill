import { Schema, model, type Document, type Model, type Types } from "mongoose"
import {
  TRANSACTION_REFERENCE_TYPES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  type TransactionReferenceType,
  type TransactionStatus,
  type TransactionType,
} from "@skillcontest/shared-types"

export interface IWalletTransaction extends Document {
  userId: Types.ObjectId
  /** Amount in paise — always positive; `type` indicates the direction. */
  type: TransactionType
  amount: number
  balanceBefore: number
  balanceAfter: number
  referenceType: TransactionReferenceType
  /**
   * Id of the reference record as a string: Razorpay payment id for deposits,
   * contest id for contest_fee/refund/prize, null for withdrawals (a pending
   * withdrawal has no external reference yet).
   */
  referenceId: string | null
  description: string
  status: TransactionStatus
}

/**
 * Append-only ledger. Records are never updated or deleted except for the
 * `status` transition on withdrawals (pending → completed/failed) — amounts
 * and balances are immutable once written.
 */
const walletTransactionSchema = new Schema<IWalletTransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    type: {
      type: String,
      enum: {
        values: [...TRANSACTION_TYPES],
        message: "{VALUE} is not a valid transaction type",
      },
      required: [true, "Transaction type is required"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [1, "Amount must be at least 1 paise"],
      validate: {
        validator: Number.isInteger,
        message: "Amount must be an integer (paise)",
      },
    },
    balanceBefore: {
      type: Number,
      required: [true, "Balance before is required"],
    },
    balanceAfter: {
      type: Number,
      required: [true, "Balance after is required"],
    },
    referenceType: {
      type: String,
      enum: {
        values: [...TRANSACTION_REFERENCE_TYPES],
        message: "{VALUE} is not a valid reference type",
      },
      required: [true, "Reference type is required"],
    },
    referenceId: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      default: "",
      maxlength: [500, "Description must be at most 500 characters"],
    },
    status: {
      type: String,
      enum: {
        values: [...TRANSACTION_STATUSES],
        message: "{VALUE} is not a valid transaction status",
      },
      default: "completed",
    },
  },
  {
    // Append-only: no updatedAt (records are never edited)
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v
        return ret
      },
    },
  },
)

// History queries (paginated, newest first)
walletTransactionSchema.index({ userId: 1, createdAt: -1 })
// Idempotency: one transaction per (user, type, reference). Partial so
// withdrawals (referenceId: null) never collide with each other — a pending
// withdrawal has no external reference id yet. String-reference lookups
// (refund fan-out: "did this user pay a contest_fee for contest X?") are
// covered by this same index.
walletTransactionSchema.index(
  { userId: 1, type: 1, referenceId: 1 },
  { unique: true, partialFilterExpression: { referenceId: { $type: "string" } } },
)

export const WalletTransaction: Model<IWalletTransaction> = model<IWalletTransaction>(
  "WalletTransaction",
  walletTransactionSchema,
)
