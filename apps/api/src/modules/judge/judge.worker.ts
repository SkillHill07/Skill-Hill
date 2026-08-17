import { Worker } from "bullmq"
import { redis } from "../../config/redis.js"
import { judgeService } from "./judge.service.js"
import { isDockerAvailable } from "./docker/sandbox.js"
import { logger } from "../../utils/logger.js"

let worker: Worker | null = null

/**
 * Start the judge worker (BullMQ consumer for the "judge" queue).
 *
 * Runs in-process with the API for now, matching the contest worker pattern —
 * submissions are only ever *enqueued* from request handlers, so untrusted
 * code never executes on the request path (it runs in Docker containers from
 * this worker). When job volume grows, extract this to a standalone process
 * (a tiny tsx entry that just calls startJudgeWorker()).
 *
 * Note: requires Docker on the host (DOCKER_HOST env on Windows,
 * e.g. npipe:////./pipe/docker_engine).
 */
export function startJudgeWorker(): Worker {
  if (worker) return worker

  worker = new Worker(
    "judge",
    async (job) => {
      const { submissionId } = job.data as { submissionId: string }
      await judgeService.evaluateSubmission(submissionId)
    },
    {
      connection: redis,
      // Bounded by host Docker capacity — keep low so a contest flood can't
      // exhaust memory on the host.
      concurrency: 3,
    },
  )

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, submissionId: job?.data?.submissionId, err: err.message },
      "judge_job_failed",
    )
  })

  worker.on("completed", (job) => {
    logger.debug({ jobId: job.id }, "judge_job_completed")
  })

  // Warn early if Docker is unreachable so misconfig surfaces at startup.
  void isDockerAvailable().then((ok) => {
    if (!ok) {
      logger.warn(
        {},
        "docker_unavailable — judge jobs will fail with SANDBOX_FAILED. " +
          "Check that Docker is running (DOCKER_HOST on Windows).",
      )
    }
  })

  logger.info({ concurrency: 3 }, "judge_worker_started")
  return worker
}
