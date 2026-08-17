import { User } from "../auth/auth.schema.js"
import { razorpayX, isPayoutsConfigured } from "../../config/razorpay.js"
import { config } from "../../config/index.js"
import { logger } from "../../utils/logger.js"
import type { PayoutFn } from "../wallet/wallet.service.js"

/**
 * RazorpayX payout gateway for wallet withdrawals.
 *
 * Injected into `walletService.withdraw()` by the wallet route — the ledger
 * (deduct, pending transaction, balance restore on failure) is owned by the
 * wallet service; this function only talks to RazorpayX.
 *
 * Flow per user: find-or-create the RazorpayX contact and UPI fund account
 * (ids + the UPI they were created with are cached on the User doc so
 * repeated withdrawals reuse them; a UPI change creates a fresh fund
 * account). Payouts are async — `created`/`queued` means accepted, final
 * settlement is confirmed later. ponytail: a payout-status webhook
 * (`payout.processed` / `payout.failed`) to reconcile final settlement is
 * deferred.
 */

function payoutError(message: string, status: number, code: string): Error {
  return Object.assign(new Error(message), { status, code })
}

/** Signature matches `PayoutFn` from the wallet service. */
export const initiatePayout: PayoutFn = async ({
  userId,
  amount,
  upiId,
  transactionId,
}) => {
  if (!isPayoutsConfigured()) {
    throw payoutError(
      "Withdrawals are not available yet — payment processing is not configured",
      503,
      "PAYMENTS_NOT_CONFIGURED",
    )
  }
  if (!upiId) {
    throw payoutError(
      "A verified UPI id is required to withdraw funds",
      400,
      "UPI_REQUIRED",
    )
  }

  const user = await User.findById(userId)
  if (!user) {
    throw payoutError("User not found", 404, "USER_NOT_FOUND")
  }

  // Find-or-create the contact (the entity payouts are made to).
  let contactId = user.razorpayContactId
  if (!contactId) {
    const contact = await razorpayX.createContact({
      name: user.fullName || `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      contact: user.phone ?? undefined,
      type: "customer",
      reference_id: `user:${user._id.toString()}`,
    })
    contactId = contact.id
    user.razorpayContactId = contactId
    await user.save()
  }

  // Find-or-create the UPI fund account. Reuse only if the cached UPI still
  // matches — a KYC change must not payout to a stale address.
  let fundAccountId = user.razorpayFundAccountId
  if (!fundAccountId || user.razorpayFundAccountUpi !== upiId) {
    const fundAccount = await razorpayX.createFundAccount({
      contact_id: contactId,
      account_type: "vpa",
      vpa: { address: upiId },
      reference_id: `fa:${user._id.toString()}`,
    })
    fundAccountId = fundAccount.id
    user.razorpayFundAccountId = fundAccountId
    user.razorpayFundAccountUpi = upiId
    await user.save()
  }

  const payout = await razorpayX.createPayout({
    account_number: config.RAZORPAYX_ACCOUNT_NUMBER,
    fund_account_id: fundAccountId,
    amount,
    currency: "INR",
    mode: "UPI",
    purpose: "payout",
    reference_id: transactionId, // wallet transaction id — idempotency at Razorpay
    narration: "SkillHill withdrawal",
  })

  logger.info(
    { userId, amount, payoutId: payout.id, status: payout.status, transactionId },
    "payout_created",
  )
}
