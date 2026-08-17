import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Prize distribution unit tests — models and the wallet service are mocked
 * (no DB); `computeRanks` is the REAL leaderboard helper so rank/tie logic is
 * tested end-to-end. Covers pool math, share allocation, tie splitting,
 * idempotent re-runs, and per-winner credit failure handling.
 */
const mocks = vi.hoisted(() => ({
  contestFindById: vi.fn(),
  participationFind: vi.fn(),
  participationCount: vi.fn(),
  prizeCreate: vi.fn(),
  prizeFindOne: vi.fn(),
  prizeFind: vi.fn(),
  prizeCount: vi.fn(),
  walletCredit: vi.fn(),
}))

vi.mock("../contest/contest.model.js", () => ({
  Contest: { findById: mocks.contestFindById },
}))
vi.mock("../contest/participation.model.js", () => ({
  Participation: {
    find: mocks.participationFind,
    countDocuments: mocks.participationCount,
  },
}))
vi.mock("./prize.model.js", () => ({
  Prize: {
    create: mocks.prizeCreate,
    findOne: mocks.prizeFindOne,
    find: mocks.prizeFind,
    countDocuments: mocks.prizeCount,
  },
}))
vi.mock("../wallet/wallet.service.js", () => ({
  walletService: { credit: mocks.walletCredit },
}))
vi.mock("../../config/index.js", () => ({
  config: { PLATFORM_FEE_RATE: 0.1 },
}))
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}))

import { prizeService } from "./prize.service.js"

const CONTEST_ID = "64b7f9c5e5b9c1a2b3c4d5e6"
const ENTRY_FEE = 2000 // ₹20

function makeContest(overrides: Partial<Record<string, unknown>> = {}) {
  return { _id: CONTEST_ID, type: "paid", entryFee: ENTRY_FEE, status: "settled", ...overrides }
}

function makePrize(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: "prize-1",
    contestId: CONTEST_ID,
    userId: "u1",
    rank: 1,
    prizeAmount: 72000,
    status: "pending",
    failureReason: null,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

/** N participants with strictly descending scores → distinct ranks 1..N. */
function makeParticipants(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    userId: `u${i + 1}`,
    totalScore: 1000 - i,
    submittedAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
  }))
}

function stubParticipationFind(participants: unknown[]) {
  mocks.participationFind.mockReturnValue({
    sort: vi.fn().mockResolvedValue(participants),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.prizeCreate.mockImplementation((data) => Promise.resolve(makePrize(data)))
  mocks.walletCredit.mockResolvedValue({ _id: "tx-1" })
})

describe("distribute", () => {
  it("credits the top-10 winners with the plan's share table on the net pool", async () => {
    mocks.contestFindById.mockResolvedValue(makeContest())
    mocks.participationCount.mockResolvedValue(100)
    stubParticipationFind(makeParticipants(100))
    // gross 2000 × 100 = 200000, net = 180000
    const amounts = [72000, 45000, 27000, 9000, 9000, 3600, 3600, 3600, 3600, 3600]

    const result = await prizeService.distribute(CONTEST_ID)

    expect(result).toMatchObject({ distributed: 10, failed: 0, netPool: 180000 })
    // One prize per winner with the exact share amounts
    const created = mocks.prizeCreate.mock.calls.map((c) => c[0])
    expect(created).toHaveLength(10)
    expect(created.map((c) => c.prizeAmount)).toEqual(amounts)
    expect(created.map((c) => c.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    // Every winner was credited
    expect(mocks.walletCredit).toHaveBeenCalledTimes(10)
    expect(mocks.walletCredit).toHaveBeenCalledWith("u1", 72000, CONTEST_ID)
    expect(mocks.walletCredit).toHaveBeenCalledWith("u10", 3600, CONTEST_ID)
  })

  it("skips free contests (nothing was collected)", async () => {
    mocks.contestFindById.mockResolvedValue(
      makeContest({ type: "free", entryFee: 0 }),
    )

    const result = await prizeService.distribute(CONTEST_ID)

    expect(result).toMatchObject({ distributed: 0, netPool: 0 })
    expect(mocks.prizeCreate).not.toHaveBeenCalled()
    expect(mocks.walletCredit).not.toHaveBeenCalled()
  })

  it("rejects distribution for a contest that is not settled", async () => {
    mocks.contestFindById.mockResolvedValue(makeContest({ status: "frozen" }))

    await expect(prizeService.distribute(CONTEST_ID)).rejects.toMatchObject({
      status: 400,
      code: "CONTEST_NOT_SETTLED",
    })
  })

  it("pools from ALL paid participants but awards only submitted, scored winners", async () => {
    mocks.contestFindById.mockResolvedValue(makeContest())
    // 100 people paid, but only 2 submitted with a score. The pot is 100 × fee;
    // the winners come only from the submitted subset.
    mocks.participationCount.mockResolvedValue(100)
    stubParticipationFind([
      { userId: "u1", totalScore: 500, submittedAt: new Date() },
      { userId: "u4", totalScore: 250, submittedAt: new Date() },
    ])

    const result = await prizeService.distribute(CONTEST_ID)

    expect(mocks.participationFind).toHaveBeenCalledWith({
      contestId: CONTEST_ID,
      submittedAt: { $ne: null },
      totalScore: { $gt: 0 },
    })
    // netPool = 2000 × 100 × 0.9 → 180000 (non-submitters forfeit the win, not the pot)
    expect(result.netPool).toBe(180000)
    expect(mocks.prizeCreate).toHaveBeenCalledTimes(2)
    expect(mocks.walletCredit).toHaveBeenCalledWith("u1", 72000, CONTEST_ID) // 40% of 180000
    expect(mocks.walletCredit).toHaveBeenCalledWith("u4", 45000, CONTEST_ID) // 25% of 180000
  })

  it("splits a tied rank's share equally between the tied winners", async () => {
    mocks.contestFindById.mockResolvedValue(makeContest())
    mocks.participationCount.mockResolvedValue(3)
    const t = new Date("2026-01-01T00:00:00Z")
    // Two identical entries tie for 1st (same score + same submittedAt)
    stubParticipationFind([
      { userId: "u1", totalScore: 100, submittedAt: t },
      { userId: "u2", totalScore: 100, submittedAt: t },
      { userId: "u3", totalScore: 50, submittedAt: new Date("2026-01-01T01:00:00Z") },
    ])

    const result = await prizeService.distribute(CONTEST_ID)

    // netPool = 6000 × 0.9 = 5400; rank1 share 40% split 2 ways = 1080 each
    expect(result.netPool).toBe(5400)
    expect(mocks.walletCredit).toHaveBeenCalledWith("u1", 1080, CONTEST_ID)
    expect(mocks.walletCredit).toHaveBeenCalledWith("u2", 1080, CONTEST_ID)
    expect(mocks.walletCredit).toHaveBeenCalledWith("u3", 810, CONTEST_ID) // 15% of 5400
  })

  it("awards no more than the 10 prize ranks", async () => {
    mocks.contestFindById.mockResolvedValue(makeContest())
    mocks.participationCount.mockResolvedValue(12)
    stubParticipationFind(makeParticipants(12))

    const result = await prizeService.distribute(CONTEST_ID)

    expect(result.distributed).toBe(10)
    expect(mocks.prizeCreate).toHaveBeenCalledTimes(10)
  })

  it("is idempotent — a re-run skips already-credited winners without double-crediting", async () => {
    mocks.contestFindById.mockResolvedValue(makeContest())
    mocks.participationCount.mockResolvedValue(3)
    stubParticipationFind(makeParticipants(3))
    // First run: all inserts succeed.
    mocks.prizeCreate.mockImplementation((data) => Promise.resolve(makePrize(data)))
    await prizeService.distribute(CONTEST_ID)
    expect(mocks.walletCredit).toHaveBeenCalledTimes(3)

    // Re-run: Prize.create collides (E11000) for every winner; existing are credited.
    mocks.walletCredit.mockClear()
    mocks.prizeCreate.mockRejectedValue({ code: 11000 })
    mocks.prizeFindOne.mockResolvedValue(makePrize({ status: "credited" }))

    await prizeService.distribute(CONTEST_ID)

    expect(mocks.walletCredit).not.toHaveBeenCalled() // no double-credit
    expect(mocks.prizeFindOne).toHaveBeenCalledTimes(3)
  })

  it("retries the wallet credit for stuck pending prizes on re-run", async () => {
    mocks.contestFindById.mockResolvedValue(makeContest())
    mocks.participationCount.mockResolvedValue(2)
    stubParticipationFind(makeParticipants(2))
    mocks.prizeCreate.mockRejectedValue({ code: 11000 })
    // Fresh doc per lookup — the service mutates status to credited after
    // a successful retry, so a shared object would short-circuit the second.
    mocks.prizeFindOne.mockImplementation(() =>
      Promise.resolve(makePrize({ status: "pending" })),
    )

    await prizeService.distribute(CONTEST_ID)

    // Both stuck prizes got their credit retried
    expect(mocks.walletCredit).toHaveBeenCalledTimes(2)
  })

  it("marks the prize failed and keeps distributing when a wallet credit fails", async () => {
    mocks.contestFindById.mockResolvedValue(makeContest())
    mocks.participationCount.mockResolvedValue(3)
    stubParticipationFind(makeParticipants(3))
    const created: Array<ReturnType<typeof makePrize>> = []
    mocks.prizeCreate.mockImplementation((data) => {
      const p = makePrize(data)
      created.push(p)
      return Promise.resolve(p)
    })
    mocks.walletCredit
      .mockRejectedValueOnce(Object.assign(new Error("frozen"), { status: 403 }))
      .mockResolvedValue({ _id: "tx-1" })
      .mockResolvedValue({ _id: "tx-1" })

    const result = await prizeService.distribute(CONTEST_ID)

    expect(result).toMatchObject({ distributed: 2, failed: 1 })
    // The failed winner's prize is marked failed with a reason, others credited
    expect(created[0].status).toBe("failed")
    expect(created[0].failureReason).toBe("frozen")
    expect(created[1].status).toBe("credited")
    expect(created[2].status).toBe("credited")
  })

  it("404s for an unknown contest", async () => {
    mocks.contestFindById.mockResolvedValue(null)

    await expect(prizeService.distribute(CONTEST_ID)).rejects.toMatchObject({
      status: 404,
      code: "CONTEST_NOT_FOUND",
    })
  })
})

describe("getContestPrizes", () => {
  it("returns the share structure and hidden winners for an unsettled contest", async () => {
    mocks.contestFindById.mockResolvedValue(makeContest({ status: "active" }))
    mocks.participationCount.mockResolvedValue(100)

    const result = await prizeService.getContestPrizes(CONTEST_ID, null)

    expect(result.netPool).toBe(180000)
    expect(result.structure).toEqual([
      { rank: 1, share: 0.4, amount: 72000 },
      { rank: 2, share: 0.25, amount: 45000 },
      { rank: 3, share: 0.15, amount: 27000 },
      { rank: 4, share: 0.05, amount: 9000 },
      { rank: 5, share: 0.05, amount: 9000 },
      { rank: 6, share: 0.02, amount: 3600 },
      { rank: 7, share: 0.02, amount: 3600 },
      { rank: 8, share: 0.02, amount: 3600 },
      { rank: 9, share: 0.02, amount: 3600 },
      { rank: 10, share: 0.02, amount: 3600 },
    ])
    expect(result.winners).toEqual([])
  })

  it("returns winners with populated names once settled", async () => {
    mocks.contestFindById.mockResolvedValue(makeContest())
    mocks.participationCount.mockResolvedValue(10)
    const populate = vi.fn().mockResolvedValue([
      { _id: "p1", rank: 1, prizeAmount: 72000, status: "credited", userId: { _id: "u1", firstName: "A", lastName: "B", avatarUrl: null } },
    ])
    mocks.prizeFind.mockReturnValue({ sort: vi.fn().mockReturnThis(), populate })

    const result = await prizeService.getContestPrizes(CONTEST_ID, null)

    expect(result.winners).toEqual([
      expect.objectContaining({ rank: 1, prizeAmount: 72000, status: "credited", user: { firstName: "A", lastName: "B", avatarUrl: null } }),
    ])
    expect(populate).toHaveBeenCalledWith("userId", "firstName lastName avatarUrl")
  })

  it("hides draft contests from the public", async () => {
    mocks.contestFindById.mockResolvedValue(makeContest({ status: "draft" }))

    await expect(prizeService.getContestPrizes(CONTEST_ID, null)).rejects.toMatchObject({
      status: 404,
      code: "CONTEST_NOT_FOUND",
    })
  })
})

describe("listUserPrizes", () => {
  it("returns the user's prizes paginated with contest populated", async () => {
    const populate = vi.fn().mockResolvedValue([makePrize({ status: "credited" })])
    mocks.prizeFind.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      populate,
    })
    mocks.prizeCount.mockResolvedValue(1)

    const result = await prizeService.listUserPrizes("u1", { page: 1, limit: 10 })

    expect(result).toMatchObject({ total: 1, totalPages: 1 })
    expect(populate).toHaveBeenCalledWith("contestId", "title slug")
  })
})
