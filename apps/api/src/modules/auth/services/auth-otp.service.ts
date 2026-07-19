import crypto from "crypto"
import { redis } from "../../../config/redis.js"
import { sendEmail } from "../../../utils/email.js"
import { logger } from "../../../utils/logger.js"
import { User } from "../auth.schema.js"

const OTP_LENGTH = 6
const OTP_TTL_SECONDS = 10 * 60 // 10 minutes
const OTP_RESEND_COOLDOWN_SECONDS = 60 // 1 minute

// OTP key patterns
function getOtpKey(userId: string, email: string): string {
  return `otp:${userId}:${email}`
}

function getOtpCooldownKey(userId: string, email: string): string {
  return `otp:cooldown:${userId}:${email}`
}

function getOtpAttemptsKey(userId: string, email: string): string {
  return `otp:attempts:${userId}:${email}`
}

const MAX_VERIFY_ATTEMPTS = 5

/**
 * Generate a cryptographically secure random OTP.
 */
function generateOtp(): string {
  // Generate random bytes and convert to numeric string
  const bytes = crypto.randomBytes(4)
  const num = bytes.readUInt32BE(0)
  // Ensure it's exactly OTP_LENGTH digits (pad with leading zeros if needed)
  return String(num % 10 ** OTP_LENGTH).padStart(OTP_LENGTH, "0")
}

/**
 * Send an OTP to the user's email address.
 * Throws if:
 * - User not found
 * - User is banned/flagged
 * - Email already verified
 * - OTP was sent within the cooldown period
 */
export async function sendEmailOtp(
  userId: string,
): Promise<{ expiresInSeconds: number }> {
  const user = await User.findById(userId).lean()
  if (!user) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
      code: "USER_NOT_FOUND",
    })
  }

  if (user.accountStatus === "banned") {
    logger.warn({ userId, email: user.email }, "otp_send_failed: banned")
    throw Object.assign(
      new Error("Your account has been banned."),
      { status: 403, code: "ACCOUNT_BANNED" },
    )
  }

  if (user.isEmailVerified) {
    logger.warn({ userId, email: user.email }, "otp_send_failed: already_verified")
    throw Object.assign(
      new Error("Email is already verified."),
      { status: 400, code: "EMAIL_ALREADY_VERIFIED" },
    )
  }

  // Check cooldown
  const cooldownKey = getOtpCooldownKey(userId, user.email)
  const cooldownRemaining = await redis.ttl(cooldownKey)
  if (cooldownRemaining > 0) {
    logger.warn({ userId, email: user.email, cooldownRemaining }, "otp_send_failed: cooldown")
    throw Object.assign(
      new Error(
        `Please wait ${cooldownRemaining} seconds before requesting a new OTP.`,
      ),
      { status: 429, code: "OTP_COOLDOWN", cooldown: cooldownRemaining },
    )
  }

  // Generate and store OTP
  const otp = generateOtp()
  const otpKey = getOtpKey(userId, user.email)

  await redis.setex(otpKey, OTP_TTL_SECONDS, otp)
  // Set cooldown
  await redis.setex(cooldownKey, OTP_RESEND_COOLDOWN_SECONDS, "1")

  // Send email
  await sendEmail({
    to: user.email,
    subject: "Your SkillsArena Email Verification Code",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Verify Your Email</h2>
        <p>Hi ${user.firstName},</p>
        <p>Use the following code to verify your email address:</p>
        <div style="
          background: #f0f0ff;
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          font-size: 32px;
          letter-spacing: 8px;
          font-weight: 700;
          color: #1a1a2e;
          margin: 24px 0;
        ">${otp}</div>
        <p style="color: #666;">
          This code expires in <strong>10 minutes</strong>.
          If you didn't request this, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">
          SkillsArena — Skill-based coding contest platform
        </p>
      </div>
    `,
    text: `Your SkillsArena verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, please ignore this email.`,
  })

  logger.info({ userId, email: user.email }, "otp_sent")

  return { expiresInSeconds: OTP_TTL_SECONDS }
}

/**
 * Verify an OTP submitted by the user.
 * On success, marks the user's email as verified.
 * On failure, increments attempt counter and blocks after MAX_VERIFY_ATTEMPTS.
 */
export async function verifyEmailOtp(
  userId: string,
  otp: string,
): Promise<void> {
  const user = await User.findById(userId)
  if (!user) {
    throw Object.assign(new Error("User not found"), {
      status: 404,
      code: "USER_NOT_FOUND",
    })
  }

  if (user.isEmailVerified) {
    throw Object.assign(
      new Error("Email is already verified."),
      { status: 400, code: "EMAIL_ALREADY_VERIFIED" },
    )
  }

  const otpKey = getOtpKey(userId, user.email)
  const storedOtp = await redis.get(otpKey)

  if (!storedOtp) {
    logger.warn({ userId, email: user.email }, "otp_verify_failed: expired")
    throw Object.assign(
      new Error("OTP has expired. Please request a new one."),
      { status: 410, code: "OTP_EXPIRED" },
    )
  }

  // Check verify attempts
  const attemptsKey = getOtpAttemptsKey(userId, user.email)
  const attempts = await redis.incr(attemptsKey)
  if (attempts === 1) {
    // Set expiry on the attempts counter (same as OTP expiry)
    await redis.expire(attemptsKey, OTP_TTL_SECONDS)
  }

  if (attempts > MAX_VERIFY_ATTEMPTS) {
    logger.warn({ userId, email: user.email, attempts }, "otp_verify_failed: too_many_attempts")
    // Delete the OTP so it can't be used
    await redis.del(otpKey)
    throw Object.assign(
      new Error("Too many incorrect attempts. Please request a new OTP."),
      { status: 429, code: "OTP_TOO_MANY_ATTEMPTS" },
    )
  }

  // Verify OTP
  if (storedOtp !== otp) {
    const remaining = MAX_VERIFY_ATTEMPTS - attempts
    logger.warn({ userId, email: user.email, remainingAttempts: remaining }, "otp_verify_failed: invalid_otp")
    throw Object.assign(
      new Error(
        `Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      ),
      { status: 400, code: "INVALID_OTP", remainingAttempts: remaining },
    )
  }

  logger.info({ userId, email: user.email }, "otp_verified")

  // Success — mark email as verified
  user.isEmailVerified = true
  await user.save({ validateBeforeSave: false })

  // Clean up OTP data
  await redis.del(otpKey)
  await redis.del(attemptsKey)
  await redis.del(getOtpCooldownKey(userId, user.email))
}
