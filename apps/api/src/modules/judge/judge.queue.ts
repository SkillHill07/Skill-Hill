import { JobQueue } from "../../jobs/queue.js"

/**
 * Judge queue (Upstash Redis — see jobs/queue.ts). Submissions are enqueued
 * here by the submission service; the judge worker (separate poller) picks
 * them up and runs the sandbox.
 */
export const judgeQueue = new JobQueue<{ submissionId: string }>("judge")

/**
 * Enqueue a submission for judging. Deterministic jobId prevents duplicates
 * if the submit handler is somehow called twice for the same submission.
 */
export async function enqueueSubmission(submissionId: string): Promise<void> {
  await judgeQueue.add(
    "evaluate",
    { submissionId },
    { jobId: `sub:${submissionId}`, attempts: 2, backoffMs: 3000 },
  )
}