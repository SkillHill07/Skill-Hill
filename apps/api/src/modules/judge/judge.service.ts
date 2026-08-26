import { Submission, type ISubmission } from "../submission/submission.model.js"
import { Problem, type IProblem, type ITestCase } from "../problem/problem.model.js"
import { Participation } from "../contest/participation.model.js"
import { problemService } from "../problem/problem.service.js"
import { getLanguageConfig, buildRunCommand } from "./languages.js"
import { runCodeInDocker, type RunResult } from "./docker/sandbox.js"
import { emitSubmissionRunning, emitSubmissionCompleted } from "../../sockets/index.js"
import { logger } from "../../utils/logger.js"

/**
 * Judge service — runs a submission's code against the problem's test cases
 * (hidden included; the judge worker is the only caller allowed to fetch
 * hidden cases) and persists the result. Never called from request handlers.
 */

/** Strip trailing whitespace per line + trailing blank lines, normalize CRLF. */
export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n+$/, "")
}

/** Whitespace-tolerant output comparison (trailing whitespace ignored). */
export function compareOutput(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected)
}

/**
 * Score = points × weighted pass ratio. Public cases carry 30%, hidden 70%.
 * When only one category exists, it counts fully.
 */
export function calculateScore(
  points: number,
  publicPassed: number,
  publicTotal: number,
  hiddenPassed: number,
  hiddenTotal: number,
): number {
  const publicRatio = publicTotal > 0 ? publicPassed / publicTotal : 0
  const hiddenRatio = hiddenTotal > 0 ? hiddenPassed / hiddenTotal : 0

  let ratio: number
  if (publicTotal > 0 && hiddenTotal > 0) {
    ratio = 0.3 * publicRatio + 0.7 * hiddenRatio
  } else if (publicTotal > 0) {
    ratio = publicRatio
  } else if (hiddenTotal > 0) {
    ratio = hiddenRatio
  } else {
    ratio = 0
  }
  return Math.round(points * ratio)
}

async function persistResult(
  submission: ISubmission,
  patch: Partial<ISubmission>,
): Promise<ISubmission> {
  Object.assign(submission, patch, { judgedAt: new Date() })
  await submission.save()
  // Run-mode submissions are practice checks — they never affect the
  // participant's leaderboard score.
  if (submission.mode !== "run") {
    await updateParticipationScore(submission)
  }
  // Single choke point — every final path (mcq, coding, error, no-problem)
  // funnels through here, so the client gets exactly one "completed" event.
  emitSubmissionCompleted(submission)
  return submission
}

/** Keep the participant's best score for the contest (leaderboard feed). */
async function updateParticipationScore(submission: ISubmission): Promise<void> {
  if (submission.status !== "accepted" && submission.status !== "rejected") return

  const participation = await Participation.findOne({
    userId: submission.userId,
    contestId: submission.contestId,
  })
  if (!participation) return

  if (submission.totalScore > participation.totalScore) {
    participation.totalScore = submission.totalScore
    participation.submittedAt = new Date()
    await participation.save()
  }
}

function zeroedScore(): {
  testResults: ISubmission["testResults"]
  publicPassed: number
  publicTotal: number
  hiddenPassed: number
  hiddenTotal: number
  totalScore: number
  executionTime: number
  memoryUsed: number
} {
  return {
    testResults: [],
    publicPassed: 0,
    publicTotal: 0,
    hiddenPassed: 0,
    hiddenTotal: 0,
    totalScore: 0,
    executionTime: 0,
    memoryUsed: 0,
  }
}

async function evaluateMcq(
  submission: ISubmission,
  problem: IProblem,
): Promise<ISubmission> {
  // For MCQ problems, submission.code holds the chosen option index (string).
  const selected = Number(submission.code)
  const passed =
    Number.isInteger(selected) &&
    selected >= 0 &&
    problem.correctAnswer !== null &&
    selected === problem.correctAnswer

  return persistResult(submission, {
    status: passed ? "accepted" : "rejected",
    testResults: [],
    publicPassed: passed ? 1 : 0,
    publicTotal: 1,
    hiddenPassed: 0,
    hiddenTotal: 0,
    totalScore: passed ? problem.points : 0,
    executionTime: 0,
    memoryUsed: 0,
    compilerOutput: null,
  })
}

async function evaluateCoding(
  submission: ISubmission,
  problem: IProblem,
): Promise<ISubmission> {
  const langConfig = await getLanguageConfig(submission.language ?? "")
  if (!langConfig) {
    return persistResult(submission, {
      status: "error",
      compilerOutput: `Unsupported or disabled language: ${submission.language}`,
      ...zeroedScore(),
    })
  }

  // Run mode: judge public test cases only — hidden cases stay unseen and
  // unscored. Submit mode: the full public + hidden suite.
  const isRun = submission.mode === "run"
  const testCases = await problemService.getTestCases(problem._id.toString(), !isRun)
  if (testCases.length === 0) {
    return persistResult(submission, {
      status: "error",
      compilerOutput: "Problem has no test cases",
      ...zeroedScore(),
    })
  }

  const command = buildRunCommand(langConfig)
  const results: Array<{ testCase: ITestCase; run: RunResult; passed: boolean }> = []

  for (const testCase of testCases) {
    let run: RunResult
    try {
      run = await runCodeInDocker({
        image: langConfig.dockerImage,
        command,
        fileBase: langConfig.fileBase,
        extension: langConfig.extension,
        code: submission.code,
        input: testCase.input,
        timeLimitMs: problem.timeLimit,
        memoryMb: problem.memoryLimit,
      })
    } catch (err) {
      run = {
        stdout: "",
        stderr: (err as Error).message,
        exitCode: -1,
        timedOut: false,
        infraError: true,
        durationMs: 0,
        memoryBytes: 0,
      }
    }

    const passed =
      !run.infraError &&
      !run.timedOut &&
      run.exitCode === 0 &&
      compareOutput(run.stdout, testCase.expectedOutput)
    results.push({ testCase, run, passed })
  }

  const publicCases = results.filter((r) => r.testCase.isPublic)
  const hiddenCases = results.filter((r) => !r.testCase.isPublic)
  const publicPassed = publicCases.filter((r) => r.passed).length
  const hiddenPassed = hiddenCases.filter((r) => r.passed).length

  const anyTimeout = results.some((r) => r.run.timedOut)
  const infraError = results.find((r) => r.run.infraError)?.run.stderr

  // Compile errors surface identically on every run when a compile step exists.
  // Use the first run's stderr as the compilerOutput (only when it actually
  // failed with stderr — a wrong-answer run with exit 0 has empty stderr).
  let compilerOutput: string | null = null
  if (langConfig.compileCommand) {
    const firstRun = results[0]?.run
    if (firstRun && !firstRun.infraError && firstRun.exitCode !== 0 && firstRun.stderr) {
      compilerOutput = firstRun.stderr.slice(0, 4000)
    }
  }
  if (infraError) compilerOutput = infraError.slice(0, 4000)

  const allPassed = results.length > 0 && results.every((r) => r.passed)
  const status = anyTimeout
    ? "timeout"
    : infraError
      ? "error"
      : compilerOutput
        ? "error"
        : allPassed
          ? "accepted"
          : "rejected"

  const maxDuration = Math.max(0, ...results.map((r) => r.run.durationMs))
  const maxMemoryBytes = Math.max(0, ...results.map((r) => r.run.memoryBytes))

  // Run-mode results are informational — zero score, hidden counts stay 0.
  const score =
    isRun || status === "error" || status === "timeout"
      ? 0
      : calculateScore(problem.points, publicPassed, publicCases.length, hiddenPassed, hiddenCases.length)

  return persistResult(submission, {
    status,
    testResults: publicCases.map((r) => ({
      testCaseId: r.testCase._id?.toString() ?? "",
      passed: r.passed,
      executionTime: r.run.durationMs,
      output: r.run.stdout.slice(0, 4000),
      expectedOutput: r.testCase.expectedOutput,
    })),
    publicPassed,
    publicTotal: publicCases.length,
    hiddenPassed: isRun ? 0 : hiddenPassed,
    hiddenTotal: isRun ? 0 : hiddenCases.length,
    totalScore: score,
    executionTime: maxDuration,
    memoryUsed: Math.round(maxMemoryBytes / 1024), // KB
    compilerOutput,
  })
}

/**
 * Main entry point — called by the judge worker for every submission job.
 * Idempotent: already-final submissions are returned untouched (worker retries
 * must not double-judge).
 */
export async function evaluateSubmission(submissionId: string): Promise<ISubmission> {
  const submission = await Submission.findById(submissionId)
  if (!submission) {
    throw Object.assign(new Error("Submission not found"), {
      status: 404,
      code: "SUBMISSION_NOT_FOUND",
    })
  }
  if (submission.status !== "pending" && submission.status !== "running") {
    return submission
  }

  submission.status = "running"
  await submission.save()
  emitSubmissionRunning(submission)

  const problem = await Problem.findById(submission.problemId)
  if (!problem) {
    return persistResult(submission, {
      status: "error",
      compilerOutput: "Problem no longer exists",
      ...zeroedScore(),
    })
  }

  try {
    if (problem.type === "mcq") {
      await evaluateMcq(submission, problem)
    } else {
      await evaluateCoding(submission, problem)
    }
  } catch (err) {
    logger.error({ submissionId, err: (err as Error).message }, "judge_crash")
    await persistResult(submission, {
      status: "error",
      compilerOutput: `Judging failed: ${(err as Error).message}`,
      ...zeroedScore(),
    })
  }

  logger.info(
    { submissionId, status: submission.status, totalScore: submission.totalScore },
    "submission_judged",
  )
  return submission
}

export const judgeService = { evaluateSubmission }
