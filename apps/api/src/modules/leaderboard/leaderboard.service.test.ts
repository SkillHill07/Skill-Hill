import { describe, it, expect } from "vitest"
import { computeRanks } from "./leaderboard.service.js"

describe("computeRanks", () => {
  it("ranks by score descending", () => {
    const ranks = computeRanks([
      { totalScore: 300, submittedAt: new Date("2026-01-01T10:00:00Z") },
      { totalScore: 200, submittedAt: new Date("2026-01-01T10:00:01Z") },
      { totalScore: 100, submittedAt: new Date("2026-01-01T10:00:02Z") },
    ])
    expect(ranks).toEqual([1, 2, 3])
  })

  it("breaks equal scores by earlier submission time", () => {
    const ranks = computeRanks([
      { totalScore: 200, submittedAt: new Date("2026-01-01T09:00:00Z") },
      { totalScore: 200, submittedAt: new Date("2026-01-01T10:00:00Z") },
    ])
    expect(ranks).toEqual([1, 2])
  })

  it("shares ranks for exact (score, time) ties (competition ranking)", () => {
    const t = new Date("2026-01-01T10:00:00Z")
    const ranks = computeRanks([
      { totalScore: 200, submittedAt: t },
      { totalScore: 200, submittedAt: t },
      { totalScore: 100, submittedAt: new Date("2026-01-01T11:00:00Z") },
    ])
    expect(ranks).toEqual([1, 1, 3])
  })

  it("handles empty and single-entry lists", () => {
    expect(computeRanks([])).toEqual([])
    expect(computeRanks([{ totalScore: 50, submittedAt: null }])).toEqual([1])
  })

  it("treats null submittedAt entries as equal (zero-score edge)", () => {
    const ranks = computeRanks([
      { totalScore: 0, submittedAt: null },
      { totalScore: 0, submittedAt: null },
    ])
    expect(ranks).toEqual([1, 1])
  })
})
