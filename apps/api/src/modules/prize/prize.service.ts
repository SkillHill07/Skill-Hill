import { Contest } from "../contest/contest.model.js"
import { Participation } from "../contest/participation.model.js"
import { Prize, type IPrize } from "./prize.model.js"
import { walletService } from "../wallet/wallet.service.js"
import { computeRanks } from "../leaderboard/leaderboard.service.js"
import { config } from "../../config/index.js"
import { logger } from "../../utils/logger.js"
import type { Types } from "mongoose"

/**
 * Prize distribution — credits winners' wallets once a contest settles.
 *
 * Money model (wallet-based, per the wallet module plan): the paid contest
 * pool is `entryFee × submitted participants`. The platform keeps
 * `PLATFORM_FEE_RATE`, and the net pool is split per the share table below.
 * Winnings credit wallets via `walletService.credit` (idempotent on
 * `(prize, contestId)`) — payouts to UPI are the wallet withdrawal flow.
 *
 * Idempotency: the (contestId, userId) unique index means re-running
 * distribution never duplicates a winner, and already-credited winners are
 * skipped while stuck pending/failed winners are retried. `distribute` is
 * safe to call from the settle flow, the Upstash job worker, or the admin
 * redistribute endpoint.
 */

/**
 * Default share table (from the module plan): 1st 40%, 2nd 25%, 3rd 15%,
 * 4th-5th 5% each, 6th-10th 2% each — sums to 100% of the net pool when all
 * ranks are awarded. ponytail: per-contest custom tables are deferred; a
 * contest would need a `prizeTable` field + validation to support them.
 */
const PRIZE_SHARES: Record<number, number> = {
  1: 0.4,
  2: 0.25,
  3: 0.15,
  4: 0.05,
  5: 0.05,
  6: 0.02,
  7: 0.02,
  8: 0.02,
  9: 0.02,
  10: 0.02,
}
const MAX_PRIZE_RANKS = 10

function prizeError(message: string, status: number, code: string): Error {
  return Object.assign(new Error(message), { status, code })
}

function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number }).code === 11000
}

async function getContestOrThrow(id: string) {
  const contest = await Contest.findById(id)
  if (!contest) {
    throw prizeError("Contest not found", 404, "CONTEST_NOT_FOUND")
  }
  return contest
}

/** Gross pool (entryFee × participants) minus the platform fee, floored. */
function computeNetPool(entryFee: number, participantCount: number): number {
  const gross = entryFee * participantCount
  return Math.floor(gross * (1 - config.PLATFORM_FEE_RATE))
}

/** The share table rendered for a given net pool (rank → share → amount). */
function sharesForPool(netPool: number) {
  return Object.entries(PRIZE_SHARES)
    .map(([rank, share]) => ({
      rank: Number(rank),
      share,
      amount: Math.floor(netPool * share),
    }))
    .sort((a, b) => a.rank - b.rank)
}

interface WinnerInput {
  contestId: string
  userId: string
  rank: number
  amount: number
}

/**
 * Record + credit a single winner. Order is deliberate: insert the Prize doc
 * (pending) first, then credit the wallet; on credit failure the prize is
 * marked failed (logged, never thrown) so distribution continues and the
 * admin redistribute endpoint retries just the failed ones. On a duplicate
 * insert (re-run) the existing prize is checked — a stuck pending/failed
 * prize gets its credit retried; a credited one is skipped.
 */
async function creditWinner(input: WinnerInput): Promise<IPrize> {
  try {
    const prize = await Prize.create({
      contestId: input.contestId,
      userId: input.userId,
      rank: input.rank,
      prizeAmount: input.amount,
      status: "pending",
    })
    try {
      await walletService.credit(input.userId, input.amount, input.contestId)
    } catch (creditErr) {
      prize.status = "failed"
      prize.failureReason = (creditErr as Error).message
      await prize.save()
      logger.error(
        { contestId: input.contestId, userId: input.userId, err: (creditErr as Error).message },
        "prize_credit_failed",
      )
      return prize
    }
    prize.status = "credited"
    prize.creditedAt = new Date()
    await prize.save()
    return prize
  } catch (err) {
    if (!isDuplicateKey(err)) throw err
    // Already distributed on a previous run — finish the credit if needed.
    const existing = await Prize.findOne({
      contestId: input.contestId,
      userId: input.userId,
    })
    if (!existing) throw err
    if (existing.status === "credited") return existing
    try {
      await walletService.credit(input.userId, input.amount, input.contestId)
    } catch (creditErr) {
      existing.status = "failed"
      existing.failureReason = (creditErr as Error).message
      await existing.save()
      return existing
    }
    existing.status = "credited"
    existing.creditedAt = new Date()
    await existing.save()
    return existing
  }
}

/**
 * Distribute prizes for a settled paid contest. Idempotent.
 *
 * Winners = submitted participants with score > 0, top-10 by
 * (totalScore desc, submittedAt asc). Tied ranks SPLIT that rank's share
 * (two people tying for 1st each get half of 40%) so the total awarded never
 * exceeds the net pool; any remainder stays with the platform.
 */
async function distribute(
  contestId: string,
): Promise<{ distributed: number; failed: number; netPool: number }> {
  const contest = await getContestOrThrow(contestId)

  // Free contests collect no fees — nothing to distribute (the declared
  // prizePool on free contests is metadata only; crediting it would create
  // money from nothing).
  if (contest.type !== "paid" || contest.entryFee <= 0) {
    logger.info({ contestId }, "prize_distribution_skipped_free")
    return { distributed: 0, failed: 0, netPool: 0 }
  }
  if (contest.status !== "settled") {
    throw prizeError(
      "Only settled contests can distribute prizes",
      400,
      "CONTEST_NOT_SETTLED",
    )
  }

  // The pot is funded by EVERYONE who paid to join — non-submitters forfeit
  // their chance to win, not their money. Winners are only the submitted +
  // scored subset, ranked from the frozen standings.
  const [participantCount, participations] = await Promise.all([
    Participation.countDocuments({ contestId }),
    Participation.find({
      contestId,
      submittedAt: { $ne: null },
      totalScore: { $gt: 0 },
    }).sort({ totalScore: -1, submittedAt: 1 }),
  ])

  if (participantCount === 0 || participations.length === 0) {
    logger.info({ contestId }, "prize_distribution_no_submissions")
    return { distributed: 0, failed: 0, netPool: 0 }
  }

  const ranks = computeRanks(
    participations.map((p) => ({ totalScore: p.totalScore, submittedAt: p.submittedAt })),
  )
  const netPool = computeNetPool(contest.entryFee, participantCount)

  // Group winners by rank so ties split their share.
  const byRank = new Map<number, Array<{ userId: Types.ObjectId }>>()
  for (let i = 0; i < participations.length; i++) {
    const rank = ranks[i]
    if (rank > MAX_PRIZE_RANKS) break // beyond the prize table
    if (!PRIZE_SHARES[rank]) continue
    const list = byRank.get(rank) ?? []
    list.push({ userId: participations[i].userId })
    byRank.set(rank, list)
  }

  let distributed = 0
  let failed = 0
  for (const [rank, entries] of [...byRank.entries()].sort((a, b) => a[0] - b[0])) {
    const amount = Math.floor((netPool * PRIZE_SHARES[rank]) / entries.length)
    if (amount <= 0) continue
    for (const { userId } of entries) {
      const winner = await creditWinner({
        contestId,
        userId: userId.toString(),
        rank,
        amount,
      })
      if (winner.status === "credited") distributed++
      else failed++
    }
  }

  logger.info(
    { contestId, distributed, failed, netPool },
    "prize_distribution_complete",
  )
  return { distributed, failed, netPool }
}

interface PopulatedUser {
  _id: Types.ObjectId
  firstName: string
  lastName: string
  avatarUrl: string | null
}

interface PopulatedContest {
  _id: Types.ObjectId
  title: string
  slug: string
}

function isPopulatedUser(value: unknown): value is PopulatedUser {
  return typeof value === "object" && value !== null && "_id" in value
}

function isPopulatedContest(value: unknown): value is PopulatedContest {
  return typeof value === "object" && value !== null && "_id" in value
}

/**
 * Public wall-of-winners feed: most recent credited prizes with the winner's
 * name/avatar and the contest title. Powers the homepage "recent winners"
 * section.
 */
async function listRecentWinners(limit = 10): Promise<
  Array<{
    rank: number
    prizeAmount: number
    creditedAt: Date | null
    user: { firstName: string; lastName: string; avatarUrl: string | null } | null
    contest: { title: string; slug: string } | null
  }>
> {
  const prizes = await Prize.find({ status: "credited" })
    .sort({ creditedAt: -1 })
    .limit(limit)
    .populate<{ userId: PopulatedUser }>("userId", "firstName lastName avatarUrl")
    .populate<{ contestId: PopulatedContest }>("contestId", "title slug")

  return prizes.map((p) => {
    const populatedUser = p.userId as unknown
    const populatedContest = p.contestId as unknown
    const user = isPopulatedUser(populatedUser) ? populatedUser : null
    const contest = isPopulatedContest(populatedContest) ? populatedContest : null
    return {
      rank: p.rank,
      prizeAmount: p.prizeAmount,
      creditedAt: p.creditedAt,
      user: user
        ? { firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl }
        : null,
      contest: contest ? { title: contest.title, slug: contest.slug } : null,
    }
  })
}

interface ContestPrizeWinner {
  rank: number
  prizeAmount: number
  status: string
  userId: string | null
  user: { firstName: string; lastName: string; avatarUrl: string | null } | null
}

/**
 * Prize breakdown for a contest (public, matches the leaderboard visibility
 * rules). `structure` is the share table rendered against the current pool
 * (indicative pre-settle); `winners` are authoritative and only exist once
 * the contest is settled.
 */
async function getContestPrizes(
  contestId: string,
  viewer?: { role: string } | null,
): Promise<{
  contestId: string
  type: string
  participantCount: number
  pool: number
  netPool: number
  platformFeeRate: number
  structure: Array<{ rank: number; share: number; amount: number }>
  winners: ContestPrizeWinner[]
}> {
  const contest = await getContestOrThrow(contestId)

  const isStaff = viewer?.role === "admin" || viewer?.role === "creator"
  if ((contest.status === "draft" || contest.status === "cancelled") && !isStaff) {
    throw prizeError("Contest not found", 404, "CONTEST_NOT_FOUND")
  }

  const participantCount = await Participation.countDocuments({ contestId })
  const gross = contest.type === "paid" ? contest.entryFee * participantCount : 0
  const netPool = Math.floor(gross * (1 - config.PLATFORM_FEE_RATE))
  const structure = sharesForPool(netPool)

  let winners: ContestPrizeWinner[] = []
  if (contest.status === "settled") {
    const prizes = await Prize.find({ contestId })
      .sort({ rank: 1 })
      .populate<{ userId: PopulatedUser }>("userId", "firstName lastName avatarUrl")
    winners = prizes.map((p) => {
      const populated = p.userId as unknown
      const userDoc = isPopulatedUser(populated) ? populated : null
      return {
        rank: p.rank,
        prizeAmount: p.prizeAmount,
        status: p.status,
        userId: (userDoc?._id ?? p.userId).toString(),
        user: userDoc
          ? {
              firstName: userDoc.firstName,
              lastName: userDoc.lastName,
              avatarUrl: userDoc.avatarUrl,
            }
          : null,
      }
    })
  }

  return {
    contestId,
    type: contest.type,
    participantCount,
    pool: gross,
    netPool,
    platformFeeRate: config.PLATFORM_FEE_RATE,
    structure,
    winners,
  }
}

/** A user's prize history, newest first, with contest title/slug populated. */
async function listUserPrizes(
  userId: string,
  filters: { page?: number; limit?: number } = {},
): Promise<{
  prizes: IPrize[]
  total: number
  page: number
  limit: number
  totalPages: number
}> {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  const [prizes, total] = await Promise.all([
    Prize.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("contestId", "title slug"),
    Prize.countDocuments({ userId }),
  ])

  return { prizes, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export const prizeService = {
  distribute,
  getContestPrizes,
  listUserPrizes,
  listRecentWinners,
}
