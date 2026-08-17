import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Join-flow wallet integration tests: paid contests deduct the entry fee
 * from the user's wallet atomically, free contests never touch the wallet,
 * and a failed participation creation rolls the fee back.
 */
const mocks = vi.hoisted(() => ({
  verifyTurnstile: vi.fn(),
  contestFindById: vi.fn(),
  participationFindOne: vi.fn(),
  participationCount: vi.fn(),
  participationCreate: vi.fn(),
  walletDeduct: vi.fn(),
  walletRefund: vi.fn(),
}))

vi.mock("../../utils/turnstile.js", () => ({
  verifyTurnstile: mocks.verifyTurnstile,
}))
vi.mock("./contest.model.js", () => ({
  Contest: { findById: mocks.contestFindById },
}))
vi.mock("./participation.model.js", () => ({
  Participation: {
    findOne: mocks.participationFindOne,
    countDocuments: mocks.participationCount,
    create: mocks.participationCreate,
  },
}))
vi.mock("../wallet/wallet.service.js", () => ({
  walletService: { deduct: mocks.walletDeduct, refund: mocks.walletRefund },
}))
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}))

import { participationService } from "./participation.service.js"

const USER_ID = "64b7f9c5e5b9c1a2b3c4d5e5"
const CONTEST_ID = "64b7f9c5e5b9c1a2b3c4d5e6"

function makeContest(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: CONTEST_ID,
    type: "paid",
    entryFee: 2000,
    status: "active",
    maxParticipants: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.verifyTurnstile.mockResolvedValue(true)
  mocks.participationFindOne.mockResolvedValue(null)
})

describe("joinContest — wallet integration", () => {
  it("deducts the entry fee for paid contests before creating participation", async () => {
    mocks.contestFindById.mockResolvedValue(makeContest())
    mocks.walletDeduct.mockResolvedValue({ type: "contest_fee", amount: 2000 })
    mocks.participationCreate.mockResolvedValue({
      _id: "p1",
      userId: USER_ID,
      contestId: CONTEST_ID,
      status: "registered",
    })

    const participation = await participationService.joinContest(USER_ID, CONTEST_ID, "tok")

    expect(mocks.walletDeduct).toHaveBeenCalledWith(USER_ID, 2000, CONTEST_ID)
    expect(mocks.participationCreate).toHaveBeenCalledWith({
      userId: USER_ID,
      contestId: CONTEST_ID,
      status: "registered",
    })
    expect(mocks.walletRefund).not.toHaveBeenCalled()
    expect(participation.status).toBe("registered")
  })

  it("never touches the wallet for free contests", async () => {
    mocks.contestFindById.mockResolvedValue(makeContest({ type: "free", entryFee: 0 }))
    mocks.participationCreate.mockResolvedValue({
      _id: "p1",
      userId: USER_ID,
      contestId: CONTEST_ID,
      status: "registered",
    })

    await participationService.joinContest(USER_ID, CONTEST_ID, "tok")

    expect(mocks.walletDeduct).not.toHaveBeenCalled()
    expect(mocks.walletRefund).not.toHaveBeenCalled()
  })

  it("propagates insufficient balance without creating participation", async () => {
    mocks.contestFindById.mockResolvedValue(makeContest())
    mocks.walletDeduct.mockRejectedValueOnce(
      Object.assign(new Error("Insufficient wallet balance"), {
        status: 400,
        code: "INSUFFICIENT_BALANCE",
      }),
    )

    await expect(
      participationService.joinContest(USER_ID, CONTEST_ID, "tok"),
    ).rejects.toMatchObject({ status: 400, code: "INSUFFICIENT_BALANCE" })
    expect(mocks.participationCreate).not.toHaveBeenCalled()
  })

  it("refunds the fee when participation creation fails (concurrent duplicate join)", async () => {
    mocks.contestFindById.mockResolvedValue(makeContest())
    mocks.walletDeduct.mockResolvedValue({ type: "contest_fee", amount: 2000 })
    mocks.participationCreate.mockRejectedValueOnce({ code: 11000 })
    mocks.walletRefund.mockResolvedValue({ type: "refund", amount: 2000 })

    await expect(
      participationService.joinContest(USER_ID, CONTEST_ID, "tok"),
    ).rejects.toMatchObject({ status: 409, code: "ALREADY_JOINED" })

    expect(mocks.walletRefund).toHaveBeenCalledWith(USER_ID, 2000, CONTEST_ID)
  })

  it("rejects on failed Turnstile verification before any wallet interaction", async () => {
    mocks.verifyTurnstile.mockResolvedValue(false)

    await expect(
      participationService.joinContest(USER_ID, CONTEST_ID, "bad-tok"),
    ).rejects.toMatchObject({ status: 400, code: "TURNSTILE_FAILED" })
    expect(mocks.contestFindById).not.toHaveBeenCalled()
    expect(mocks.walletDeduct).not.toHaveBeenCalled()
  })
})
