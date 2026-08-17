import { Wallet, type IWallet } from "./wallet.model.js"
import { WalletTransaction, type IWalletTransaction } from "./transaction.model.js"
import { User } from "../auth/auth.schema.js"
import { config } from "../../config/index.js"
import { logger } from "../../utils/logger.js"
import type {
  TransactionReferenceType,
  TransactionType,
  WalletStatus,
} from "@skillcontest/shared-types"

/**
 * Wallet — the central ledger for all money movement on the platform.
 *
 * Design notes:
 * - All amounts are paise integers. Never floats.
 * - Balance mutations are single atomic `findOneAndUpdate` ops with
 *   preconditions in the filter (status active, balance >= amount) — no
 *   read-modify-write races, no distributed locks needed at this scale.
 * - Idempotency: the partial unique index (userId, type, referenceId)
 *   guarantees one transaction per external reference. On a duplicate the
 *   balance mutation is compensated and the existing record returned, so a
 *   replayed webhook can never double-credit.
 * - Wallets are created lazily (atomic upsert) on first access.
 */

function walletError(message: string, status: number, code: string): Error {
  return Object.assign(new Error(message), { status, code })
}

function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number }).code === 11000
}

/** Negate an increment map ({ totalDeposited: 5 } → { totalDeposited: -5 }). */
function negate(totals: Partial<Record<string, number>>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [key, -(value ?? 0)]),
  )
}

/**
 * Get (or lazily create) the user's wallet. Atomic upsert — two concurrent
 * first-touches can't race into an E11000 on the unique userId index.
 */
async function getWallet(userId: string): Promise<IWallet> {
  return Wallet.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
}

/** Balance summary. `available = balance - locked` (locked is 0 until escrow). */
async function getBalance(userId: string) {
  const wallet = await getWallet(userId)
  return {
    userId: wallet.userId.toString(),
    balance: wallet.balance,
    locked: wallet.locked,
    available: wallet.balance - wallet.locked,
    status: wallet.status,
    totalDeposited: wallet.totalDeposited,
    totalWithdrawn: wallet.totalWithdrawn,
    totalWon: wallet.totalWon,
    totalSpentOnFees: wallet.totalSpentOnFees,
  }
}

/**
 * Shared "money in" core (deposit / prize credit / refund): atomic increment
 * with a frozen guard, then an append-only ledger row. If the ledger row
 * collides with an existing one (concurrent duplicate of the same reference),
 * the balance increment is compensated and the existing record returned.
 */
async function applyCredit(
  userId: string,
  amount: number,
  totals: Partial<Record<"totalDeposited" | "totalWon", number>>,
  ledger: {
    type: TransactionType
    referenceType: TransactionReferenceType
    referenceId: string
    description: string
    status?: IWalletTransaction["status"]
  },
): Promise<IWalletTransaction> {
  const wallet = await getWallet(userId)
  const balanceBefore = wallet.balance

  const updated = await Wallet.findOneAndUpdate(
    { userId, status: "active" },
    { $inc: { balance: amount, ...totals } },
    { new: true },
  )
  if (!updated) {
    throw walletError("Wallet is frozen", 403, "WALLET_FROZEN")
  }

  try {
    return await WalletTransaction.create({
      userId,
      amount,
      balanceBefore,
      balanceAfter: updated.balance,
      status: "completed",
      ...ledger,
    })
  } catch (err) {
    if (!isDuplicateKey(err)) throw err
    // Concurrent duplicate of the same reference — compensate the increment.
    await Wallet.updateOne(
      { userId },
      { $inc: { balance: -amount, ...negate(totals) } },
    )
    const existing = await WalletTransaction.findOne({
      userId,
      type: ledger.type,
      referenceId: ledger.referenceId,
    })
    if (!existing) {
      throw walletError("Ledger inconsistency", 500, "WALLET_UPDATE_FAILED")
    }
    logger.warn({ userId, type: ledger.type, referenceId: ledger.referenceId }, "wallet_duplicate_compensated")
    return existing
  }
}

/**
 * Shared "money out" core (contest fee / withdrawal): atomic decrement with
 * `balance >= amount` + frozen preconditions, then an append-only ledger row.
 */
async function applyDebit(
  userId: string,
  amount: number,
  totals: Partial<
    Record<"totalWithdrawn" | "totalSpentOnFees" | "totalDeposited", number>
  >,
  ledger: {
    type: TransactionType
    referenceType: TransactionReferenceType
    referenceId: string | null
    description: string
    status?: IWalletTransaction["status"]
  },
): Promise<IWalletTransaction> {
  const wallet = await getWallet(userId)
  const balanceBefore = wallet.balance

  const updated = await Wallet.findOneAndUpdate(
    { userId, status: "active", balance: { $gte: amount } },
    { $inc: { balance: -amount, ...totals } },
    { new: true },
  )
  if (!updated) {
    const current = await Wallet.findOne({ userId })
    if (!current || current.status !== "active") {
      throw walletError("Wallet is frozen", 403, "WALLET_FROZEN")
    }
    throw walletError("Insufficient wallet balance", 400, "INSUFFICIENT_BALANCE")
  }

  try {
    return await WalletTransaction.create({
      userId,
      amount,
      balanceBefore,
      balanceAfter: updated.balance,
      status: "completed",
      ...ledger,
    })
  } catch (err) {
    if (!isDuplicateKey(err)) throw err
    // Concurrent duplicate of the same reference — compensate the decrement.
    await Wallet.updateOne(
      { userId },
      { $inc: { balance: amount, ...negate(totals) } },
    )
    const existing = await WalletTransaction.findOne({
      userId,
      type: ledger.type,
      referenceId: ledger.referenceId,
    })
    if (!existing) {
      throw walletError("Ledger inconsistency", 500, "WALLET_UPDATE_FAILED")
    }
    logger.warn({ userId, type: ledger.type, referenceId: ledger.referenceId }, "wallet_duplicate_compensated")
    return existing
  }
}

/**
 * Credit a deposit once a Razorpay payment is captured (called by the payment
 * module's webhook handler, Phase 3). Idempotent on `paymentId`.
 */
async function deposit(userId: string, amount: number, paymentId: string): Promise<IWalletTransaction> {
  if (amount <= 0) {
    throw walletError("Invalid amount", 400, "INVALID_AMOUNT")
  }
  return applyCredit(
    userId,
    amount,
    { totalDeposited: amount },
    {
      type: "deposit",
      referenceType: "payment",
      referenceId: paymentId,
      description: `Wallet deposit of ₹${amount / 100}`,
    },
  )
}

/**
 * Deduct a contest entry fee (called by the contest join flow). Atomic
 * `balance >= amount` guard — no lock needed.
 */
async function deduct(userId: string, amount: number, contestId: string): Promise<IWalletTransaction> {
  if (amount <= 0) {
    throw walletError("Invalid amount", 400, "INVALID_AMOUNT")
  }
  return applyDebit(
    userId,
    amount,
    { totalSpentOnFees: amount },
    {
      type: "contest_fee",
      referenceType: "contest",
      referenceId: contestId,
      description: `Contest entry fee`,
    },
  )
}

/**
 * Credit a prize payout (called by the prize distribution module). Idempotent
 * on `contestId` — one prize credit per contest per user.
 */
async function credit(userId: string, amount: number, contestId: string): Promise<IWalletTransaction> {
  if (amount <= 0) {
    throw walletError("Invalid amount", 400, "INVALID_AMOUNT")
  }
  return applyCredit(
    userId,
    amount,
    { totalWon: amount },
    {
      type: "prize",
      referenceType: "contest",
      referenceId: contestId,
      description: `Prize winnings`,
    },
  )
}

/**
 * Reverse a wallet deposit when its Razorpay payment is refunded back to the
 * user's card (admin refund, payment module). Atomic debit with a
 * `balance >= amount` guard — if the user already spent the deposit the
 * reversal fails and the refund must not proceed (no double-pay). Idempotent:
 * the refund ledger row (type refund, referenceType payment) is unique per
 * payment id, so a retried admin refund can never double-reverse. Returns
 * null when no matching deposit exists.
 */
async function reverseDeposit(
  userId: string,
  amount: number,
  paymentId: string,
): Promise<IWalletTransaction | null> {
  if (amount <= 0) {
    throw walletError("Invalid amount", 400, "INVALID_AMOUNT")
  }
  const deposit = await WalletTransaction.findOne({
    userId,
    type: "deposit",
    referenceId: paymentId,
  })
  if (!deposit) return null

  return applyDebit(
    userId,
    amount,
    // Negative magnitude: the debit core adds `totals` to the $inc, and a
    // deposit reversal must DECREASE lifetime deposits (money left the user
    // back to the card). negate() flips the sign for compensation rollback.
    { totalDeposited: -amount },
    {
      type: "refund",
      referenceType: "payment",
      referenceId: paymentId,
      description: `Refund of payment to card`,
    },
  )
}

/**
 * Refund a contest entry fee (called by the contest cancel flow). Only fires
 * when a matching contest_fee deduction exists, and only once per contest per
 * user — re-running is safe. Returns null when nothing was ever paid.
 */
async function refund(
  userId: string,
  amount: number,
  contestId: string,
): Promise<IWalletTransaction | null> {
  if (amount <= 0) return null
  const paid = await WalletTransaction.findOne({
    userId,
    type: "contest_fee",
    referenceId: contestId,
  })
  if (!paid) return null

  return applyCredit(
    userId,
    amount,
    {},
    {
      type: "refund",
      referenceType: "contest",
      referenceId: contestId,
      description: `Refund of contest entry fee`,
    },
  )
}

/** Withdrawal payout gateway — injected so the ledger logic is testable. */
export type PayoutFn = (args: {
  userId: string
  amount: number
  upiId: string | null
  transactionId: string
}) => Promise<void>

const defaultPayout: PayoutFn = async () => {
  // ponytail: real Razorpay Payouts integration lands with the payment module
  // (Phase 3). Until then withdrawals can only complete when a payout gateway
  // is wired — the service restores the balance and marks the request failed.
  throw walletError(
    "Withdrawals are not available yet — payment processing is not configured",
    503,
    "PAYMENTS_NOT_CONFIGURED",
  )
}

/**
 * Request a withdrawal. Gates: KYC verified, wallet not frozen, balance >=
 * amount. The balance is deducted atomically and a `pending` withdrawal
 * transaction is recorded; the injected payout gateway then completes or
 * fails the request (on failure the balance is restored).
 */
async function withdraw(
  userId: string,
  amount: number,
  opts: { upiId?: string; payout?: PayoutFn } = {},
): Promise<IWalletTransaction> {
  if (amount <= 0) {
    throw walletError("Invalid amount", 400, "INVALID_AMOUNT")
  }
  if (amount < config.WITHDRAWAL_MIN_PAISE) {
    throw walletError(
      `Minimum withdrawal is ₹${config.WITHDRAWAL_MIN_PAISE / 100}`,
      400,
      "WITHDRAWAL_MIN_NOT_MET",
    )
  }

  const user = await User.findById(userId)
  if (!user || user.kycStatus !== "verified" || !user.panVerified) {
    throw walletError(
      "KYC verification is required to withdraw funds",
      403,
      "KYC_REQUIRED",
    )
  }

  const payout = opts.payout ?? defaultPayout
  const wallet = await getWallet(userId)
  if (wallet.status !== "active") {
    throw walletError("Wallet is frozen", 403, "WALLET_FROZEN")
  }

  const updated = await Wallet.findOneAndUpdate(
    { userId, status: "active", balance: { $gte: amount } },
    { $inc: { balance: -amount, totalWithdrawn: amount } },
    { new: true },
  )
  if (!updated) {
    throw walletError("Insufficient wallet balance", 400, "INSUFFICIENT_BALANCE")
  }

  const tx = await WalletTransaction.create({
    userId,
    type: "withdrawal",
    amount,
    balanceBefore: wallet.balance,
    balanceAfter: updated.balance,
    referenceType: "withdrawal",
    referenceId: null,
    description: `Withdrawal request`,
    status: "pending",
  })

  try {
    await payout({
      userId,
      amount,
      upiId: opts.upiId ?? (user.getUpiId() ?? null),
      transactionId: tx._id.toString(),
    })
  } catch (err) {
    // Payout failed — restore the balance, mark the request failed.
    await Wallet.updateOne(
      { userId },
      { $inc: { balance: amount, totalWithdrawn: -amount } },
    )
    tx.status = "failed"
    await tx.save()
    throw err
  }

  tx.status = "completed"
  await tx.save()
  logger.info({ userId, amount, transactionId: tx._id.toString() }, "withdrawal_completed")
  return tx
}

/** Paginated transaction history, newest first. Filters: type. */
async function getTransactions(
  userId: string,
  filters: { type?: TransactionType; page?: number; limit?: number } = {},
): Promise<{
  transactions: IWalletTransaction[]
  total: number
  page: number
  limit: number
  totalPages: number
}> {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  const query: Record<string, unknown> = { userId }
  if (filters.type) query.type = filters.type

  const [transactions, total] = await Promise.all([
    WalletTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    WalletTransaction.countDocuments(query),
  ])

  return { transactions, total, page, limit, totalPages: Math.ceil(total / limit) }
}

/** Admin: freeze/unfreeze a wallet (fraud/suspension hold). */
async function setStatus(userId: string, status: WalletStatus): Promise<IWallet> {
  const updated = await Wallet.findOneAndUpdate(
    { userId },
    { status },
    { new: true },
  )
  if (!updated) {
    throw walletError("Wallet not found", 404, "WALLET_NOT_FOUND")
  }
  logger.info({ userId, status }, "wallet_status_changed")
  return updated
}

export const walletService = {
  getWallet,
  getBalance,
  deposit,
  deduct,
  credit,
  refund,
  reverseDeposit,
  withdraw,
  getTransactions,
  setStatus,
}
