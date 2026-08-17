import { JobQueue } from "./queue.js"
import { contestService } from "../modules/contest/contest.service.js"
import { scheduleContestSettle } from "./contest.queue.js"
import { logger } from "../utils/logger.js"

let worker: JobQueue<{ contestId: string }> | null = null

/**
 * Start the contest job worker (polls the Upstash Redis queue — see
 * jobs/queue.ts). Runs in-process with the API; when job volume grows,
 * extract to a standalone process like the judge worker.
 */
export function startContestWorker(): JobQueue<{ contestId: string }> {
  if (worker) return worker

  worker = new JobQueue<{ contestId: string }>("contest", {
    pollMs: 2000,
    batchSize: 2,
  })

  worker.start(async (name, { contestId }) => {
    if (name === "freeze-contest") {
      const contest = await contestService.freezeContest(contestId)
      if (contest.status === "frozen") {
        await scheduleContestSettle(contestId)
      }
      return
    }

    if (name === "settle-contest") {
      await contestService.settleContest(contestId)
      return
    }

    logger.warn({ jobId: contestId, name }, "unknown_contest_job")
  })

  logger.info({ pollMs: 2000 }, "contest_worker_started")
  return worker
}