import { User, type IUser } from "../auth.schema.js"
import type { KycStatus, Role } from "@skillcontest/shared-types"
import { logger } from "../../../utils/logger.js"
import { cacheGet, cacheSet, cacheDel, cacheKeys } from "../../../utils/cache.js"

/**
 * Update the authenticated user's KYC details.
 * Encrypts bank account, IFSC, and UPI fields at rest.
 * Resets kycStatus to "pending" when any field changes (re-verification needed).
 */
export async function updateKycDetails(
  userId: string,
  input: {
    panNumber?: string
    bankAccountNumber?: string
    ifscCode?: string
    upiId?: string
  },
): Promise<IUser> {
  const user = await User.findById(userId)
  if (!user) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
      code: "USER_NOT_FOUND",
    })
  }

  if (user.accountStatus === "banned") {
    throw Object.assign(
      new Error("Your account has been banned."),
      { status: 403, code: "ACCOUNT_BANNED" },
    )
  }

  let kycChanged = false

  if (input.panNumber !== undefined) {
    const pan = input.panNumber.toUpperCase()
    // PAN format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)
    if (!/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(pan)) {
      throw Object.assign(
        new Error("Invalid PAN number format. Expected format: ABCDE1234F"),
        { status: 400, code: "INVALID_PAN" },
      )
    }
    user.setPanNumber(pan)
    kycChanged = true
  }

  if (input.bankAccountNumber !== undefined) {
    // Bank account: 9-18 digits
    const account = input.bankAccountNumber.replace(/\s/g, "")
    if (!/^\d{9,18}$/.test(account)) {
      throw Object.assign(
        new Error("Invalid bank account number. Must be 9-18 digits."),
        { status: 400, code: "INVALID_BANK_ACCOUNT" },
      )
    }
    user.setBankAccountNumber(account)
    kycChanged = true
  }

  if (input.ifscCode !== undefined) {
    const ifsc = input.ifscCode.toUpperCase()
    // IFSC format: 4 letters + 0 + 6 alphanumeric (e.g., HDFC0001234)
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      throw Object.assign(
        new Error(
          "Invalid IFSC code format. Expected format: HDFC0001234",
        ),
        { status: 400, code: "INVALID_IFSC" },
      )
    }
    user.setIfscCode(ifsc)
    kycChanged = true
  }

  if (input.upiId !== undefined) {
    const upi = input.upiId.toLowerCase()
    // UPI format: username@handle (e.g., user@paytm, user@upi)
    if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(upi)) {
      throw Object.assign(
        new Error(
          "Invalid UPI ID format. Expected format: username@handle",
        ),
        { status: 400, code: "INVALID_UPI" },
      )
    }
    user.setUpiId(upi)
    kycChanged = true
  }

  // If KYC fields changed, reset status to pending for re-verification
  if (kycChanged) {
    user.kycStatus = "pending"
  }

  await user.save({ validateBeforeSave: false })

  // Invalidate KYC status cache
  await cacheDel(cacheKeys.kycStatus(userId))

  logger.info({ userId, kycChanged }, "kyc_details_updated")

  return user
}

/**
 * Get the authenticated user's KYC status (without exposing encrypted values).
 * Returns only verification statuses, not the actual encrypted data.
 */
export async function getKycStatus(userId: string): Promise<{
  panVerified: boolean
  kycStatus: KycStatus
  hasPan: boolean
  hasBankAccount: boolean
  hasIfsc: boolean
  hasUpiId: boolean
}> {
  // Try cache first
  const cached = await cacheGet<{
    panVerified: boolean
    kycStatus: KycStatus
    hasPan: boolean
    hasBankAccount: boolean
    hasIfsc: boolean
    hasUpiId: boolean
  }>(cacheKeys.kycStatus(userId))
  if (cached) return cached

  const user = await User.findById(userId)
    .select("+panNumberEncrypted +bankAccountNumberEncrypted +ifscCodeEncrypted +upiIdEncrypted")
    .lean()
  if (!user) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
      code: "USER_NOT_FOUND",
    })
  }

  const result = {
    panVerified: user.panVerified,
    kycStatus: user.kycStatus as KycStatus,
    hasPan: !!user.panNumberEncrypted,
    hasBankAccount: !!user.bankAccountNumberEncrypted,
    hasIfsc: !!user.ifscCodeEncrypted,
    hasUpiId: !!user.upiIdEncrypted,
  }

  await cacheSet(cacheKeys.kycStatus(userId), result)
  return result
}

/**
 * Get decrypted KYC details (only for the user themselves or admins).
 * Returns the actual PAN, bank account, IFSC, and UPI values.
 */
export async function getKycDetails(
  userId: string,
): Promise<{
  panNumber: string | null
  bankAccountNumber: string | null
  ifscCode: string | null
  upiId: string | null
  panVerified: boolean
  kycStatus: KycStatus
}> {
  const user = await User.findById(userId).select(
    "+panNumberEncrypted +bankAccountNumberEncrypted +ifscCodeEncrypted +upiIdEncrypted",
  )
  if (!user) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
      code: "USER_NOT_FOUND",
    })
  }

  return {
    panNumber: user.getPanNumber(),
    bankAccountNumber: user.getBankAccountNumber(),
    ifscCode: user.getIfscCode(),
    upiId: user.getUpiId(),
    panVerified: user.panVerified,
    kycStatus: user.kycStatus,
  }
}

// --- Admin KYC functions ---

interface PendingKycUser {
  _id: string
  firstName: string
  lastName: string
  email: string
  createdAt: Date
  updatedAt: Date
  accountStatus: string
  panVerified: boolean
  kycStatus: KycStatus
}

/**
 * List all users with kycStatus = "pending" (awaiting review).
 * Returns basic user info plus KYC status fields.
 * Admin/creator only.
 */
export async function listPendingKyc(): Promise<{
  users: PendingKycUser[]
  total: number
}> {
  const users = await User.find({ kycStatus: "pending" })
    .select("firstName lastName email createdAt updatedAt accountStatus panVerified kycStatus")
    .sort({ updatedAt: -1 })
    .lean()

  logger.info({ total: users.length }, "list_pending_kyc")

  return {
    users: users as unknown as PendingKycUser[],
    total: users.length,
  }
}

/**
 * Review a user's KYC submission — approve or reject.
 * When rejecting, a reason can be provided.
 * When approving, also sets panVerified = true.
 * Logs the admin action (who, what, when) to console for now.
 * Admin/creator only.
 */
export async function reviewKyc(
  userId: string,
  action: "approved" | "rejected",
  reviewedBy: string,
  reviewedByRole: Role,
  rejectionReason?: string,
): Promise<{ user: IUser }> {
  const user = await User.findById(userId)
  if (!user) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
      code: "USER_NOT_FOUND",
    })
  }

  if (action === "approved") {
    user.kycStatus = "verified"
    user.panVerified = true
  } else {
    user.kycStatus = "rejected"
  }

  await user.save({ validateBeforeSave: false })

  // Invalidate KYC status cache
  await cacheDel(cacheKeys.kycStatus(userId))

  logger.info({
    targetUserId: userId,
    targetEmail: user.email,
    action,
    reviewedBy,
    reviewedByRole,
    rejectionReason: rejectionReason ?? null,
  }, `kyc_${action}`)

  return { user }
}

/**
 * Get full KYC details for a specific user (admin/creator only).
 * Returns decrypted values.
 */
export async function getAdminKycDetails(
  userId: string,
): Promise<{
  user: {
    _id: string
    firstName: string
    lastName: string
    email: string
    accountStatus: string
    panVerified: boolean
    kycStatus: KycStatus
  }
  kyc: {
    panNumber: string | null
    bankAccountNumber: string | null
    ifscCode: string | null
    upiId: string | null
  }
}> {
  const user = await User.findById(userId).select(
    "+panNumberEncrypted +bankAccountNumberEncrypted +ifscCodeEncrypted +upiIdEncrypted firstName lastName email accountStatus panVerified kycStatus",
  )
  if (!user) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
      code: "USER_NOT_FOUND",
    })
  }

  return {
    user: {
      _id: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      accountStatus: user.accountStatus,
      panVerified: user.panVerified,
      kycStatus: user.kycStatus,
    },
    kyc: {
      panNumber: user.getPanNumber(),
      bankAccountNumber: user.getBankAccountNumber(),
      ifscCode: user.getIfscCode(),
      upiId: user.getUpiId(),
    },
  }
}
