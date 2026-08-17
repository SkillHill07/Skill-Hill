import { Schema, model, type Document, type Model, type Types } from "mongoose"
import {
  PAYMENT_PURPOSES,
  PAYMENT_STATUSES,
  type PaymentPurpose,
  type PaymentStatus,
} from "@skillcontest/shared-types"

export interface IPayment extends Document {
  userId: Types.ObjectId
  /** Optional contest the deposit is for — metadata only (join deducts from wallet). */
  contestId: Types.ObjectId | null
  purpose: PaymentPurpose
  /** Amount in paise (2000 = ₹20). */
  amount: number
  currency: string // INR
  /** created → (attempted) → paid | failed; paid → refunded. */
  status: PaymentStatus
  idempotencyKey: string
  razorpayOrderId: string | null
  razorpayPaymentId: string | null
  receipt: string
  refundId: string | null
  failureReason: string | null
  paidAt: Date | null
  refundedAt: Date | null
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    contestId: {
      type: Schema.Types.ObjectId,
      ref: "Contest",
      default: null,
    },
    purpose: {
      type: String,
      enum: {
        values: [...PAYMENT_PURPOSES],
        message: "{VALUE} is not a valid payment purpose",
      },
      default: "deposit",
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
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },
    status: {
      type: String,
      enum: {
        values: [...PAYMENT_STATUSES],
        message: "{VALUE} is not a valid payment status",
      },
      default: "created",
    },
    idempotencyKey: {
      type: String,
      required: [true, "Idempotency key is required"],
      unique: true,
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    receipt: {
      type: String,
      default: "",
    },
    refundId: {
      type: String,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    refundedAt: {
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

// User's payment history
paymentSchema.index({ userId: 1, createdAt: -1 })
// Webhook lookups by order id (sparse — null until the order is created)
paymentSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true })
// Admin audit queries
paymentSchema.index({ status: 1, createdAt: -1 })

export const Payment: Model<IPayment> = model<IPayment>("Payment", paymentSchema)
