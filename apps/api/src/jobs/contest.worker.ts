import { Worker } from "bullmq"
import { redis } from "../config/redis.js"
import { contestService } from "../modules/contest/contest.service.js"
import { scheduleContestSettle } from "./contest.queue.js"
import { logger } from "../utils/logger.js"

let worker: Worker | null = null

/**
 * Start the contest job worker.
 * In Phase 2 this runs in-process with the API (jobs are light); when job
 * volume grows, extract to a standalone process like the judge worker.
 */
export function startContestWorker(): Worker {
  if (worker) return worker

  worker = new Worker(
    "contest",
    async (job) => {
      const { contestId } = job.data as { contestId: string }

      if (job.name === "freeze-contest") {
        const contest = await contestService.freezeContest(contestId)
        if (contest.status === "frozen") {
          await scheduleContestSettle(contestId)
        }
        return
      }

      if (job.name === "settle-contest") {
        await contestService.settleContest(contestId)
        return
      }

      logger.warn({ jobId: job.id, name: job.name }, "unknown_contest_job")
    },
    {
      connection: redis,
      concurrency: 2,
    },
  )

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, name: job?.name, err: err.message },
      "contest_job_failed",
    )
  })

  logger.info({}, "contest_worker_started")
  return worker
}
