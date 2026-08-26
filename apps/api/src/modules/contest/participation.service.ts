import { Participation, type IParticipation } from "./participation.model.js"
import { Contest } from "./contest.model.js"
import { walletService } from "../wallet/wallet.service.js"
import { verifyTurnstile } from "../../utils/turnstile.js"
import { logger } from "../../utils/logger.js"

/**
 * Join a contest.
 *
 * Server-side checks (server-authoritative only, no client timestamps):
 *  1. Turnstile verification (AI_rules D — required on contest-join)
 *  2. Contest must be active
 *  3. Not full (maxParticipants)
 *  4. User not already registered
 *  5. Paid contests: atomically deduct the entry fee from the user's wallet
 *     (free contests never touch the wallet). If participation creation fails
 *     afterwards the deduction is refunded — a user never pays without a seat.
 */
async function joinContest(
  userId: string,
  contestId: string,
  turnstileToken: string,
): Promise<IParticipation> {
  const turnstileValid = await verifyTurnstile(turnstileToken)
  if (!turnstileValid) {
    throw Object.assign(new Error("Turnstile verification failed"), {
      status: 400,
      code: "TURNSTILE_FAILED",
    })
  }

  const contest = await Contest.findById(contestId)
  if (!contest) {
    throw Object.assign(new Error("Contest not found"), {
      status: 404,
      code: "CONTEST_NOT_FOUND",
    })
  }

  if (contest.status !== "active") {
    throw Object.assign(new Error("This contest is not accepting participants"), {
      status: 400,
      code: "CONTEST_NOT_ACTIVE",
    })
  }

  if (!contest.problemIds || contest.problemIds.length === 0) {
    throw Object.assign(new Error("This contest has no published problems yet"), {
      status: 400,
      code: "NO_PROBLEMS",
    })
  }

  const existing = await Participation.findOne({ userId, contestId })
  if (existing) {
    throw Object.assign(new Error("You have already joined this contest"), {
      status: 409,
      code: "ALREADY_JOINED",
    })
  }

  if (contest.maxParticipants) {
    const participantCount = await Participation.countDocuments({ contestId })
    if (participantCount >= contest.maxParticipants) {
      throw Object.assign(new Error("This contest is full"), {
        status: 400,
        code: "CONTEST_FULL",
      })
    }
    // ponytail: count-then-create is TOCTOU — two concurrent joins can both
    // pass the count check and oversubscribe a contest. The plan calls for a
    // Redis distributed lock here (payment-lock, Phase 3). Until then the
    // unique {userId, contestId} index prevents duplicate joins per user, and
    // the participation count race only matters at exactly maxParticipants.
  }

  // Paid contests deduct the entry fee atomically (balance >= fee guard in
  // the wallet service). Free contests never touch the wallet.
  let feeDeducted = false
  if (contest.type === "paid" && contest.entryFee > 0) {
    await walletService.deduct(userId, contest.entryFee, contestId)
    feeDeducted = true
  }

  let participation: IParticipation
  try {
    participation = await Participation.create({
      userId,
      contestId,
      status: "registered",
    })
  } catch (err) {
    // No seat was created — roll the fee back (idempotent, only fires when a
    // contest_fee deduction exists).
    if (feeDeducted) {
      await walletService.refund(userId, contest.entryFee, contestId).catch((refundErr) => {
        logger.error(
          { userId, contestId, err: (refundErr as Error).message },
          "join_rollback_refund_failed",
        )
      })
    }
    // Concurrent duplicate join → unique index E11000 → clean 409
    if ((err as { code?: number }).code === 11000) {
      throw Object.assign(new Error("You have already joined this contest"), {
        status: 409,
        code: "ALREADY_JOINED",
      })
    }
    throw err
  }

  logger.info({ userId, contestId }, "contest_joined")
  return participation
}

/**
 * Start a contest for a user. One-time transition: registered → started.
 * Only allowed while the contest is active.
 */
async function startContest(userId: string, contestId: string): Promise<IParticipation> {
  const contest = await Contest.findById(contestId)
  if (!contest) {
    throw Object.assign(new Error("Contest not found"), {
      status: 404,
      code: "CONTEST_NOT_FOUND",
    })
  }

  if (contest.status !== "active") {
    throw Object.assign(new Error("This contest is not running"), {
      status: 400,
      code: "CONTEST_NOT_ACTIVE",
    })
  }

  const participation = await Participation.findOne({ userId, contestId })
  if (!participation) {
    throw Object.assign(new Error("Join the contest before starting it"), {
      status: 403,
      code: "NOT_JOINED",
    })
  }

  if (participation.status !== "registered") {
    throw Object.assign(new Error("Contest already started"), {
      status: 400,
      code: "ALREADY_STARTED",
    })
  }

  participation.status = "started"
  participation.startedAt = new Date()
  await participation.save()

  logger.info({ userId, contestId }, "contest_started")
  return participation
}

/** Get a user's participation in a contest (or null). */
async function getParticipation(
  userId: string,
  contestId: string,
): Promise<IParticipation | null> {
  return Participation.findOne({ userId, contestId })
}

/** List participants of a contest, ordered by score desc (for admin/leaderboard). */
async function listParticipants(contestId: string): Promise<IParticipation[]> {
  return Participation.find({ contestId }).sort({ totalScore: -1, joinedAt: 1 })
}

export const participationService = {
  joinContest,
  startContest,
  getParticipation,
  listParticipants,
}
