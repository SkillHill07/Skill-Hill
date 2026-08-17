import { Queue } from "bullmq"
import { redis } from "../../config/redis.js"

/**
 * Judge queue. Submissions are enqueued here by the submission service; the
 * judge worker (separate BullMQ worker) picks them up and runs the sandbox.
 */
export const judgeQueue = new Queue("judge", {
  connection: redis,
  defaultJobOptions: {
    // Retry on infrastructure failures only (the service is idempotent — a
    // finished submission is never re-judged). Wrong answers are not retried.
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
})

/**
 * Enqueue a submission for judging. Deterministic jobId prevents duplicates
 * if the submit handler is somehow called twice for the same submission.
 */
export async function enqueueSubmission(submissionId: string): Promise<void> {
  await judgeQueue.add(
    "evaluate",
    { submissionId },
    { jobId: `sub:${submissionId}` },
  )
}
