import { Contest, type IContest } from "./contest.model.js"
import { Participation } from "./participation.model.js"
import { walletService } from "../wallet/wallet.service.js"
import { prizeService } from "../prize/prize.service.js"
import type { CreateContestBody, UpdateContestBody, ListContestsQuery } from "./contest.validation.js"
import { makeSlug } from "../../utils/slugify.js"
import { logger } from "../../utils/logger.js"
import { scheduleContestFreeze } from "../../jobs/contest.queue.js"

// --- State machine ---
// draft → active → frozen → settled
//   │        │
//   └────────┴──→ cancelled
//
// Transitions are enforced in the service layer (single source of truth).

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["active", "cancelled"],
  active: ["frozen", "cancelled"],
  frozen: ["settled"],
  settled: [],
  cancelled: [],
}

function assertTransition(from: string, to: string): void {
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw Object.assign(new Error(`Cannot transition contest from ${from} to ${to}`), {
      status: 400,
      code: "INVALID_STATE_TRANSITION",
    })
  }
}

async function getContestOrThrow(id: string): Promise<IContest> {
  const contest = await Contest.findById(id)
  if (!contest) {
    throw Object.assign(new Error("Contest not found"), {
      status: 404,
      code: "CONTEST_NOT_FOUND",
    })
  }
  return contest
}

async function ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
  const existing = await Contest.findOne({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
  if (existing) {
    throw Object.assign(new Error("A contest with this slug already exists"), {
      status: 409,
      code: "SLUG_EXISTS",
    })
  }
  return slug
}

// --- Public queries ---

interface ContestListItem {
  contest: IContest
  participantCount: number
}

async function listContests(
  filters: ListContestsQuery,
  viewer?: { role: string } | null,
): Promise<{ contests: ContestListItem[]; total: number; page: number; limit: number; totalPages: number }> {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  const now = new Date()

  const isStaff = viewer?.role === "admin" || viewer?.role === "creator"
  const requestedStatus = filters.status ?? "active"

  // Draft/cancelled are staff-only views — the public list must never leak them.
  if (!isStaff && (requestedStatus === "draft" || requestedStatus === "cancelled")) {
    throw Object.assign(new Error("Invalid status filter"), {
      status: 403,
      code: "FORBIDDEN_STATUS",
    })
  }

  const query: Record<string, unknown> = {}
  if (requestedStatus === "active") {
    query.status = "active"
    query.startTime = { $lte: now }
    query.endTime = { $gte: now }
  } else if (requestedStatus === "upcoming") {
    query.status = "active"
    query.startTime = { $gt: now }
  } else if (requestedStatus === "settled") {
    query.status = "settled"
  } else if (requestedStatus === "frozen") {
    query.status = "frozen"
  } else if (requestedStatus === "cancelled") {
    query.status = "cancelled"
  } else if (requestedStatus === "draft") {
    query.status = "draft"
  } else {
    // Default: active + upcoming (public-facing)
    query.status = "active"
  }

  const [contests, total] = await Promise.all([
    Contest.find(query).sort({ startTime: 1 }).skip((page - 1) * limit).limit(limit),
    Contest.countDocuments(query),
  ])

  const contestsWithCounts = await attachParticipantCounts(contests)

  return {
    contests: contestsWithCounts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

/** Batch-attach live participant counts (single aggregation, no N+1). */
async function attachParticipantCounts(
  contests: IContest[],
): Promise<ContestListItem[]> {
  if (contests.length === 0) return []

  const ids = contests.map((c) => c._id)
  const counts = await Participation.aggregate([
    { $match: { contestId: { $in: ids } } },
    { $group: { _id: "$contestId", count: { $sum: 1 } } },
  ])
  const countMap = new Map(counts.map((r) => [String(r._id), r.count]))

  return contests.map((contest) => ({
    contest,
    participantCount: countMap.get(String(contest._id)) ?? 0,
  }))
}

/**
 * Get a single contest with its problems populated (hidden test cases stripped
 * by the Problem schema toJSON transform). Draft contests are hidden from
 * non-admin viewers (pretend they don't exist).
 */
async function getContestById(
  id: string,
  viewer?: { role: string } | null,
): Promise<IContest> {
  const contest = await getContestOrThrow(id)

  const isStaff = viewer?.role === "admin" || viewer?.role === "creator"
  if (contest.status === "draft" && !isStaff) {
    throw Object.assign(new Error("Contest not found"), {
      status: 404,
      code: "CONTEST_NOT_FOUND",
    })
  }

  await contest.populate({
    path: "problemIds",
    model: "Problem",
    options: { sort: { order: 1 } },
  })

  return contest
}

// --- Admin mutations ---

async function createContest(input: CreateContestBody, createdBy: string): Promise<IContest> {
  const slug = input.slug ?? makeSlug(input.title)
  await ensureUniqueSlug(slug)

  const contest = await Contest.create({
    ...input,
    slug,
    status: "draft",
    createdBy,
    // Free contests never store a fee. Paid contests are guaranteed to have a
    // positive entryFee by the create validation (superRefine).
    entryFee: input.type === "free" ? 0 : (input.entryFee as number),
  })

  logger.info({ contestId: contest._id.toString(), createdBy }, "contest_created")
  return contest
}

async function updateContest(id: string, input: UpdateContestBody): Promise<IContest> {
  const contest = await getContestOrThrow(id)

  if (contest.status !== "draft") {
    throw Object.assign(new Error("Only draft contests can be edited"), {
      status: 400,
      code: "CONTEST_NOT_DRAFT",
    })
  }

  if (input.slug) {
    await ensureUniqueSlug(input.slug, id)
  }

  Object.assign(contest, input)

  // A free contest always has entryFee = 0, even if a fee was sent in this
  // PATCH without switching type (the update validation only rejects fees on
  // an explicit switch to paid).
  if (contest.type === "free") {
    contest.entryFee = 0
  }

  await contest.save()

  logger.info({ contestId: id }, "contest_updated")
  return contest
}

/**
 * Publish: draft → active.
 * Schedules the Upstash delayed freeze job at the contest endTime
 * (server-authoritative timing — never client-reported).
 */
async function publishContest(id: string): Promise<IContest> {
  const contest = await getContestOrThrow(id)
  assertTransition(contest.status, "active")

  if (!contest.problemIds || contest.problemIds.length === 0) {
    throw Object.assign(new Error("A contest must have at least one problem before publishing"), {
      status: 400,
      code: "NO_PROBLEMS",
    })
  }

  contest.status = "active"
  await contest.save()

  // Schedule the auto-freeze job. If Redis is down, log it and continue —
  // an admin can still freeze the contest manually via POST /contests/:id/freeze.
  try {
    await scheduleContestFreeze(contest._id.toString(), contest.endTime)
  } catch (err) {
    logger.error(
      { contestId: id, err: (err as Error).message },
      "freeze_job_schedule_failed",
    )
  }

  logger.info({ contestId: id, endTime: contest.endTime }, "contest_published")
  return contest
}

/**
 * Cancel: draft/active → cancelled.
 * Refunds every paid participant's entry fee back to their wallet.
 * walletService.refund is idempotent (only fires when a contest_fee exists,
 * one refund per contest per user) so the fan-out is safe to replay.
 *
 * Refund failures are logged, not thrown — the contest is already cancelled
 * and a stuck refund must not 500 the cancel call. ponytail: an admin
 * "reprocess refunds" endpoint can replay failed refunds later if needed.
 */
async function cancelContest(id: string, reason?: string): Promise<IContest> {
  const contest = await getContestOrThrow(id)
  assertTransition(contest.status, "cancelled")

  contest.status = "cancelled"
  await contest.save()

  if (contest.type === "paid" && contest.entryFee > 0) {
    const participants = await Participation.find({ contestId: id })
    await Promise.all(
      participants.map((p) =>
        walletService.refund(p.userId.toString(), contest.entryFee, id).catch((err) => {
          logger.error(
            { contestId: id, userId: p.userId.toString(), err: (err as Error).message },
            "contest_cancel_refund_failed",
          )
        }),
      ),
    )
  }

  logger.info({ contestId: id, reason }, "contest_cancelled")
  return contest
}

/**
 * Freeze: active → frozen. Called by the Upstash job worker at endTime
 * (server-authoritative) or by an admin.
 */
async function freezeContest(id: string): Promise<IContest> {
  const contest = await getContestOrThrow(id)
  if (contest.status !== "active") {
    // Idempotent — already frozen/settled/cancelled
    return contest
  }
  assertTransition(contest.status, "frozen")

  contest.status = "frozen"
  await contest.save()

  logger.info({ contestId: id }, "contest_frozen")
  return contest
}

/**
 * Settle: frozen → settled.
 * Triggers prize distribution (paid contests credit winners' wallets via the
 * prize module). Distribution is best-effort: a failure must not 500 the
 * settle — the contest is already settled and the admin can re-run it via
 * POST /admin/contests/:id/prizes/redistribute (distribution is idempotent).
 *
 * Idempotent for worker robustness: already-settled or cancelled contests
 * are returned as-is (a delayed settle job must not dead-letter on an
 * expected condition). Draft/active contests are still rejected.
 */
async function settleContest(id: string): Promise<IContest> {
  const contest = await getContestOrThrow(id)
  if (contest.status === "settled" || contest.status === "cancelled") {
    return contest
  }
  if (contest.status !== "frozen") {
    throw Object.assign(new Error("Only frozen contests can be settled"), {
      status: 400,
      code: "CONTEST_NOT_FROZEN",
    })
  }
  assertTransition(contest.status, "settled")

  contest.status = "settled"
  await contest.save()

  try {
    await prizeService.distribute(id)
  } catch (err) {
    logger.error(
      { contestId: id, err: (err as Error).message },
      "prize_distribution_failed",
    )
  }

  logger.info({ contestId: id }, "contest_settled")
  return contest
}

export const contestService = {
  listContests,
  getContestById,
  createContest,
  updateContest,
  publishContest,
  cancelContest,
  freezeContest,
  settleContest,
}
