import { z } from "zod"
import { PAYMENT_PURPOSES, PAYMENT_STATUSES } from "@skillcontest/shared-types"
import { config } from "../../config/index.js"

const OBJECT_ID = /^[a-f0-9]{24}$/

export const createOrderSchema = z.object({
  body: z.object({
    amount: z
      .number()
      .int("Amount must be an integer (paise)")
      .min(config.DEPOSIT_MIN_PAISE, `Minimum deposit is ₹${config.DEPOSIT_MIN_PAISE / 100}`)
      .max(config.DEPOSIT_MAX_PAISE, `Maximum deposit is ₹${config.DEPOSIT_MAX_PAISE / 100}`),
    purpose: z.enum(PAYMENT_PURPOSES).default("deposit"),
    contestId: z.string().regex(OBJECT_ID, "Invalid contest id").optional(),
  }),
})

export const listPaymentsSchema = z.object({
  query: z.object({
    status: z.enum(PAYMENT_STATUSES).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
})

export const adminListPaymentsSchema = z.object({
  query: z.object({
    status: z.enum(PAYMENT_STATUSES).optional(),
    userId: z.string().regex(OBJECT_ID, "Invalid user id").optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
})

export const adminRefundSchema = z.object({
  body: z.object({
    paymentId: z.string().regex(OBJECT_ID, "Invalid payment id"),
  }),
})

export type CreateOrderBody = z.infer<typeof createOrderSchema>["body"]
