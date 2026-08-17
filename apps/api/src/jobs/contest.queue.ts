import { JobQueue } from "./queue.js"

export interface ContestJobData {
  contestId: string
}

/**
 * Contest lifecycle queue (Upstash Redis — see jobs/queue.ts).
 * - `freeze-contest` — delayed job at contest endTime (server-authoritative)
 * - `settle-contest` — runs after freeze, triggers prize distribution
 */
export const contestQueue = new JobQueue<ContestJobData>("contest")

/**
 * Schedule the auto-freeze for a contest at its endTime.
 * Uses a deterministic jobId so re-publishing doesn't create duplicates.
 */
export async function scheduleContestFreeze(
  contestId: string,
  endTime: Date,
): Promise<void> {
  const delayMs = Math.max(0, endTime.getTime() - Date.now())
  await contestQueue.add(
    "freeze-contest",
    { contestId },
    { jobId: `freeze:${contestId}`, delayMs, attempts: 3, backoffMs: 5000 },
  )
}

/**
 * Schedule the settle job after a freeze completes.
 */
export async function scheduleContestSettle(contestId: string): Promise<void> {
  await contestQueue.add(
    "settle-contest",
    { contestId },
    { jobId: `settle:${contestId}`, attempts: 3, backoffMs: 5000 },
  )
}