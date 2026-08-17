import { Contest } from "../contest/contest.model.js"
import { Participation, type IParticipation } from "../contest/participation.model.js"
import type { Types } from "mongoose"
import { logger } from "../../utils/logger.js"

/**
 * Leaderboard — MongoDB-backed. The judge already maintains the single source
 * of truth: `participation.totalScore` (best score wins) + `submittedAt` (time
 * of the best submission, used for tie-breaking).
 *
 * Deviation from the module plan: the plan proposed a Redis sorted set with
 * `ZINCRBY`, but the actual semantics are *best-score-wins*, not cumulative —
 * `ZINCRBY` would double-count, and the correct Redis op (`ZADD`) duplicates
 * state we already persist atomically in MongoDB. At this platform's scale a
 * direct Mongo read is simpler, always consistent, and needs no cache sync.
 * Upgrade path: if a contest grows huge, mirror `participation.totalScore` to
 * a Redis sorted set via ZADD in `judge.service` and read from there.
 */

async function getContestOrThrow(id: string) {
  const contest = await Contest.findById(id)
  if (!contest) {
    throw Object.assign(new Error("Contest not found"), {
      status: 404,
      code: "CONTEST_NOT_FOUND",
    })
  }
  return contest
}

/**
 * Standard competition ranking for entries pre-sorted by
 * (totalScore desc, submittedAt asc). Equal (score, submittedAt) pairs share
 * a rank (1, 1, 3), matching how "same score, same time" behaves.
 */
export function computeRanks(
  entries: Array<{ totalScore: number; submittedAt: Date | null }>,
): number[] {
  const ranks: number[] = []
  for (let i = 0; i < entries.length; i++) {
    if (i === 0) {
      ranks.push(1)
      continue
    }
    const prev = entries[i - 1]
    const curr = entries[i]
    const same = curr.totalScore === prev.totalScore
    const sameTime =
      (curr.submittedAt?.getTime() ?? 0) === (prev.submittedAt?.getTime() ?? 0)
    ranks.push(same && sameTime ? ranks[i - 1] : i + 1)
  }
  return ranks
}

interface PopulatedUser {
  _id: Types.ObjectId
  firstName: string
  lastName: string
  avatarUrl: string | null
}

/** True when `value` is a populated user doc (vs a raw ObjectId for a deleted user). */
function isPopulatedUser(value: Types.ObjectId | PopulatedUser): value is PopulatedUser {
  return typeof value === "object" && value !== null && "_id" in value
}

/**
 * Top-N leaderboard (public). Only participants who submitted are ranked.
 * Draft/cancelled contests are hidden from non-staff viewers (404), matching
 * the contest module's draft-hiding behavior.
 */
async function getLeaderboard(
  contestId: string,
  limit: number,
  viewer?: { role: string } | null,
): Promise<{
  contestId: string
  /** Number of entries returned (capped by limit) — not the total ranked set. */
  returned: number
  entries: Array<{
    rank: number
    userId: string
    totalScore: number
    submittedAt: Date | null
    user: { firstName: string; lastName: string; avatarUrl: string | null } | null
  }>
}> {
  const contest = await getContestOrThrow(contestId)

  const isStaff = viewer?.role === "admin" || viewer?.role === "creator"
  if ((contest.status === "draft" || contest.status === "cancelled") && !isStaff) {
    throw Object.assign(new Error("Contest not found"), {
      status: 404,
      code: "CONTEST_NOT_FOUND",
    })
  }

  const participations = await Participation.find({
    contestId,
    submittedAt: { $ne: null },
  })
    .sort({ totalScore: -1, submittedAt: 1 })
    .limit(limit)
    .populate<{ userId: PopulatedUser }>("userId", "firstName lastName avatarUrl")

  const ranks = computeRanks(
    participations.map((p) => ({ totalScore: p.totalScore, submittedAt: p.submittedAt })),
  )

  const entries = participations.map((p, i) => {
    const userIdValue = p.userId as unknown as Types.ObjectId | PopulatedUser
    const userDoc = isPopulatedUser(userIdValue) ? userIdValue : null
    return {
      rank: ranks[i],
      userId: (userDoc?._id ?? userIdValue).toString(),
      totalScore: p.totalScore,
      submittedAt: p.submittedAt,
      user: userDoc
        ? {
            firstName: userDoc.firstName,
            lastName: userDoc.lastName,
            avatarUrl: userDoc.avatarUrl,
          }
        : null,
    }
  })

  logger.debug({ contestId, returned: entries.length }, "leaderboard_read")
  return { contestId, returned: entries.length, entries }
}

/**
 * The current user's rank and score. `rank` is null until they have a
 * submission. Rank = count of participants strictly ahead of them on
 * (score desc, submittedAt asc) + 1.
 */
async function getMyRank(
  userId: string,
  contestId: string,
): Promise<{
  contestId: string
  participated: boolean
  submitted: boolean
  rank: number | null
  totalScore: number
}> {
  await getContestOrThrow(contestId)

  const me: IParticipation | null = await Participation.findOne({ userId, contestId })
  if (!me) {
    return { contestId, participated: false, submitted: false, rank: null, totalScore: 0 }
  }
  if (me.submittedAt === null) {
    return {
      contestId,
      participated: true,
      submitted: false,
      rank: null,
      totalScore: me.totalScore,
    }
  }

  const ahead = await Participation.countDocuments({
    contestId,
    submittedAt: { $ne: null },
    $or: [
      { totalScore: { $gt: me.totalScore } },
      { totalScore: me.totalScore, submittedAt: { $lt: me.submittedAt } },
    ],
  })

  return {
    contestId,
    participated: true,
    submitted: true,
    rank: ahead + 1,
    totalScore: me.totalScore,
  }
}

export const leaderboardService = {
  getLeaderboard,
  getMyRank,
}
