import { Queue } from "bullmq"
import { redis } from "../config/redis.js"

/**
 * Contest lifecycle queue.
 * - `freeze-contest` — delayed job at contest endTime (server-authoritative)
 * - `settle-contest` — runs after freeze, triggers prize distribution
 */
export const contestQueue = new Queue("contest", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
})

/**
 * Schedule the auto-freeze for a contest at its endTime.
 * Uses a deterministic jobId so re-publishing doesn't create duplicates.
 */
export async function scheduleContestFreeze(
  contestId: string,
  endTime: Date,
): Promise<void> {
  const delay = Math.max(0, endTime.getTime() - Date.now())
  await contestQueue.add(
    "freeze-contest",
    { contestId },
    { delay, jobId: `freeze:${contestId}` },
  )
}

/**
 * Schedule the settle job after a freeze completes.
 */
export async function scheduleContestSettle(contestId: string): Promise<void> {
  await contestQueue.add(
    "settle-contest",
    { contestId },
    { jobId: `settle:${contestId}` },
  )
}
