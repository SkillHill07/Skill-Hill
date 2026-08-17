import { JobQueue } from "../../jobs/queue.js"
import { judgeService } from "./judge.service.js"
import { isDockerAvailable } from "./docker/sandbox.js"
import { logger } from "../../utils/logger.js"

let worker: JobQueue<{ submissionId: string }> | null = null

/**
 * Start the judge worker (polls the Upstash Redis "judge" queue — see
 * jobs/queue.ts).
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
export function startJudgeWorker(): JobQueue<{ submissionId: string }> {
  if (worker) return worker

  worker = new JobQueue<{ submissionId: string }>("judge", {
    pollMs: 1000,
    batchSize: 3,
  })

  worker.start(async (_name, { submissionId }) => {
    await judgeService.evaluateSubmission(submissionId)
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

  logger.info({ batchSize: 3 }, "judge_worker_started")
  return worker
}