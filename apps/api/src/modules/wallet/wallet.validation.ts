import { z } from "zod"
import {
  TRANSACTION_TYPES,
  WALLET_STATUSES,
} from "@skillcontest/shared-types"
import { config } from "../../config/index.js"

const OBJECT_ID = /^[a-f0-9]{24}$/

export const balanceSchema = z.object({})

export const transactionsSchema = z.object({
  query: z.object({
    type: z.enum(TRANSACTION_TYPES).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
})

export const depositSchema = z.object({
  body: z.object({
    amount: z
      .number()
      .int("Amount must be an integer (paise)")
      .min(config.DEPOSIT_MIN_PAISE, `Minimum deposit is ₹${config.DEPOSIT_MIN_PAISE / 100}`)
      .max(config.DEPOSIT_MAX_PAISE, `Maximum deposit is ₹${config.DEPOSIT_MAX_PAISE / 100}`),
  }),
})

export const withdrawSchema = z.object({
  body: z.object({
    amount: z
      .number()
      .int("Amount must be an integer (paise)")
      .min(
        config.WITHDRAWAL_MIN_PAISE,
        `Minimum withdrawal is ₹${config.WITHDRAWAL_MIN_PAISE / 100}`,
      ),
    upiId: z.string().min(3, "UPI id must be at least 3 characters").max(100).optional(),
  }),
})

export const adminWalletStatusSchema = z.object({
  params: z.object({
    userId: z.string().regex(OBJECT_ID, "Invalid user id"),
  }),
  body: z.object({
    status: z.enum(WALLET_STATUSES),
  }),
})
