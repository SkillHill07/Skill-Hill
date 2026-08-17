import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  evaluateSubmission,
  compareOutput,
  calculateScore,
} from "./judge.service.js"

const mocks = vi.hoisted(() => {
  const submissionSave = vi.fn()
  const participationSave = vi.fn()
  return {
    findSubmission: vi.fn(),
    submissionSave,
    findProblem: vi.fn(),
    getTestCases: vi.fn(),
    runCodeInDocker: vi.fn(),
    getLanguageConfig: vi.fn(),
    findParticipation: vi.fn(),
    participationSave,
  }
})

vi.mock("../submission/submission.model.js", () => ({
  Submission: { findById: mocks.findSubmission },
}))
vi.mock("../problem/problem.model.js", () => ({
  Problem: { findById: mocks.findProblem },
}))
vi.mock("../problem/problem.service.js", () => ({
  problemService: { getTestCases: mocks.getTestCases },
}))
vi.mock("./docker/sandbox.js", () => ({
  runCodeInDocker: mocks.runCodeInDocker,
}))
vi.mock("./languages.js", () => ({
  getLanguageConfig: mocks.getLanguageConfig,
  buildRunCommand: (cfg: { compileCommand: string | null }) =>
    cfg.compileCommand ? ["sh", "-c", "compile && run"] : ["node", "main.js"],
}))
vi.mock("../contest/participation.model.js", () => ({
  Participation: { findOne: mocks.findParticipation },
}))
vi.mock("../../utils/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}))

function makeSubmission(overrides: Record<string, unknown> = {}) {
  return {
    _id: "sub1",
    userId: "u1",
    contestId: "c1",
    problemId: "p1",
    language: "javascript",
    code: "console.log('hi')",
    status: "pending",
    testResults: [],
    publicPassed: 0,
    publicTotal: 0,
    hiddenPassed: 0,
    hiddenTotal: 0,
    totalScore: 0,
    executionTime: 0,
    memoryUsed: 0,
    compilerOutput: null,
    submittedAt: new Date(),
    judgedAt: null,
    save: mocks.submissionSave,
    ...overrides,
  }
}

function makeProblem(overrides: Record<string, unknown> = {}) {
  return {
    _id: "p1",
    contestId: "c1",
    title: "Sum",
    type: "coding",
    difficulty: "easy",
    points: 100,
    timeLimit: 2000,
    memoryLimit: 256,
    options: [],
    correctAnswer: null,
    ...overrides,
  }
}

function makeTestCase(i: number, overrides: Record<string, unknown> = {}) {
  return {
    _id: `tc${i}`,
    input: `${i}`,
    expectedOutput: `${i * 2}`,
    isPublic: i % 2 === 0,
    order: i,
    description: "",
    ...overrides,
  }
}

const JS_CONFIG = {
  key: "javascript",
  extension: "js",
  compileCommand: null,
  runCommand: "node {file}.js",
  dockerImage: "node:20-alpine",
  fileBase: "main",
}

describe("compareOutput", () => {
  it("matches identical output", () => {
    expect(compareOutput("42\n", "42\n")).toBe(true)
  })

  it("ignores trailing whitespace per line and trailing blank lines", () => {
    expect(compareOutput("42  \n\n\n", "42")).toBe(true)
  })

  it("normalizes CRLF to LF", () => {
    expect(compareOutput("a\r\nb\r\n", "a\nb")).toBe(true)
  })

  it("rejects different output", () => {
    expect(compareOutput("42", "43")).toBe(false)
  })

  it("is case-sensitive", () => {
    expect(compareOutput("Hello", "hello")).toBe(false)
  })
})

describe("calculateScore", () => {
  it("gives full points when everything passes", () => {
    expect(calculateScore(100, 3, 3, 7, 7)).toBe(100)
  })

  it("weights public 30% / hidden 70%", () => {
    // public 2/4 (0.5), hidden 5/5 (1.0) → 0.3*0.5 + 0.7*1.0 = 0.85 → 85
    expect(calculateScore(100, 2, 4, 5, 5)).toBe(85)
  })

  it("counts public-only problems fully", () => {
    expect(calculateScore(100, 2, 4, 0, 0)).toBe(50)
  })

  it("counts hidden-only problems fully", () => {
    expect(calculateScore(100, 0, 0, 5, 10)).toBe(50)
  })

  it("returns 0 when there are no test cases", () => {
    expect(calculateScore(100, 0, 0, 0, 0)).toBe(0)
  })
})

describe("evaluateSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getLanguageConfig.mockResolvedValue(JS_CONFIG)
  })

  function makeParticipation() {
    return { totalScore: 0, submittedAt: null, save: mocks.participationSave }
  }

  describe("mcq", () => {
    it("accepts a correct answer and awards full points without Docker", async () => {
      mocks.findSubmission.mockResolvedValue(
        makeSubmission({ code: "2", language: null }),
      )
      mocks.findProblem.mockResolvedValue(
        makeProblem({ type: "mcq", options: ["a", "b", "c"], correctAnswer: 2 }),
      )
      const participation = makeParticipation()
      mocks.findParticipation.mockResolvedValue(participation)

      const result = await evaluateSubmission("sub1")

      expect(result.status).toBe("accepted")
      expect(result.totalScore).toBe(100)
      expect(result.publicPassed).toBe(1)
      expect(result.publicTotal).toBe(1)
      expect(mocks.runCodeInDocker).not.toHaveBeenCalled()
      expect(mocks.participationSave).toHaveBeenCalled()
      expect(participation.totalScore).toBe(100)
    })

    it("rejects a wrong answer with zero score", async () => {
      mocks.findSubmission.mockResolvedValue(
        makeSubmission({ code: "1", language: null }),
      )
      mocks.findProblem.mockResolvedValue(
        makeProblem({ type: "mcq", options: ["a", "b", "c"], correctAnswer: 2 }),
      )
      const participation = makeParticipation()
      mocks.findParticipation.mockResolvedValue(participation)

      const result = await evaluateSubmission("sub1")

      expect(result.status).toBe("rejected")
      expect(result.totalScore).toBe(0)
      // 0 is not > participation.totalScore (0) → no save
      expect(mocks.participationSave).not.toHaveBeenCalled()
    })
  })

  describe("coding", () => {
    it("accepts when every test case passes (public + hidden)", async () => {
      mocks.findSubmission.mockResolvedValue(makeSubmission())
      mocks.findProblem.mockResolvedValue(makeProblem())
      const testCases = [makeTestCase(0), makeTestCase(1), makeTestCase(2), makeTestCase(3)]
      mocks.getTestCases.mockResolvedValue(testCases)
      mocks.runCodeInDocker.mockImplementation(
        async ({ input }: { input?: string }) => ({
          // makeTestCase(i) expects output `${i * 2}` for input `${i}`
          stdout: String(Number(input ?? 0) * 2),
          stderr: "",
          exitCode: 0,
          timedOut: false,
          infraError: false,
          durationMs: 10,
          memoryBytes: 2048 * 1024,
        }),
      )
      const participation = makeParticipation()
      mocks.findParticipation.mockResolvedValue(participation)

      const result = await evaluateSubmission("sub1")

      expect(result.status).toBe("accepted")
      expect(result.totalScore).toBe(100)
      expect(result.publicPassed).toBe(2)
      expect(result.publicTotal).toBe(2)
      expect(result.hiddenPassed).toBe(2)
      expect(result.hiddenTotal).toBe(2)
      expect(result.executionTime).toBe(10)
      expect(result.memoryUsed).toBe(2048)
      // Only public test case results are stored
      expect(result.testResults).toHaveLength(2)
      expect(mocks.runCodeInDocker).toHaveBeenCalledTimes(4)
      expect(participation.totalScore).toBe(100)
    })

    it("gives partial credit and rejects when only some pass", async () => {
      mocks.findSubmission.mockResolvedValue(makeSubmission())
      mocks.findProblem.mockResolvedValue(makeProblem())
      const testCases = [makeTestCase(0), makeTestCase(1), makeTestCase(2), makeTestCase(3)]
      mocks.getTestCases.mockResolvedValue(testCases)
      // Cases 1,2 pass; cases 3,4 fail with a runtime error (exit 1)
      mocks.runCodeInDocker.mockImplementation(
        async ({ input }: { input?: string }) => {
          // makeTestCase(i): expected output is `${i * 2}` — passing runs emit
          // exactly that, failing runs emit nothing with a non-zero exit.
          const passed = input === "1" || input === "2"
          return {
            stdout: passed ? String(Number(input ?? 0) * 2) : "",
            stderr: passed ? "" : "Runtime error",
            exitCode: passed ? 0 : 1,
            timedOut: false,
            infraError: false,
            durationMs: 10,
            memoryBytes: 0,
          }
        },
      )
      mocks.findParticipation.mockResolvedValue(makeParticipation())

      const result = await evaluateSubmission("sub1")

      expect(result.status).toBe("rejected")
      // 2/4 total → 0.5 ratio (both categories present, equal) → 50
      expect(result.totalScore).toBe(50)
      expect(result.testResults).toHaveLength(2)
    })

    it("marks the submission timeout when a run exceeds the time limit", async () => {
      mocks.findSubmission.mockResolvedValue(makeSubmission())
      mocks.findProblem.mockResolvedValue(makeProblem())
      mocks.getTestCases.mockResolvedValue([makeTestCase(0), makeTestCase(1)])
      mocks.runCodeInDocker.mockResolvedValue({
        stdout: "",
        stderr: "",
        exitCode: 0,
        timedOut: true,
        infraError: false,
        durationMs: 2000,
        memoryBytes: 0,
      })
      mocks.findParticipation.mockResolvedValue(makeParticipation())

      const result = await evaluateSubmission("sub1")

      expect(result.status).toBe("timeout")
      expect(result.totalScore).toBe(0)
    })

    it("captures compile errors from the first failing run", async () => {
      mocks.findSubmission.mockResolvedValue(
        makeSubmission({ language: "cpp" }),
      )
      mocks.findProblem.mockResolvedValue(makeProblem())
      mocks.getLanguageConfig.mockResolvedValue({
        ...JS_CONFIG,
        key: "cpp",
        extension: "cpp",
        compileCommand: "g++ -o {file} {file}.cpp",
        runCommand: "./{file}",
        dockerImage: "gcc:13-alpine",
      })
      mocks.getTestCases.mockResolvedValue([makeTestCase(0)])
      mocks.runCodeInDocker.mockResolvedValue({
        stdout: "",
        stderr: "main.cpp:3:5: error: 'x' was not declared",
        exitCode: 1,
        timedOut: false,
        infraError: false,
        durationMs: 5,
        memoryBytes: 0,
      })
      mocks.findParticipation.mockResolvedValue(makeParticipation())

      const result = await evaluateSubmission("sub1")

      expect(result.status).toBe("error")
      expect(result.compilerOutput).toContain("error: 'x' was not declared")
    })

    it("marks error when the sandbox itself fails (docker down)", async () => {
      mocks.findSubmission.mockResolvedValue(makeSubmission())
      mocks.findProblem.mockResolvedValue(makeProblem())
      mocks.getTestCases.mockResolvedValue([makeTestCase(0)])
      mocks.runCodeInDocker.mockRejectedValue(
        Object.assign(new Error("Sandbox failed: Cannot connect to the Docker daemon"), {
          status: 500,
          code: "SANDBOX_FAILED",
        }),
      )
      mocks.findParticipation.mockResolvedValue(makeParticipation())

      const result = await evaluateSubmission("sub1")

      expect(result.status).toBe("error")
      expect(result.compilerOutput).toContain("Sandbox failed")
      expect(result.totalScore).toBe(0)
    })

    it("errors on an unsupported or disabled language", async () => {
      mocks.findSubmission.mockResolvedValue(
        makeSubmission({ language: "cobol" }),
      )
      mocks.findProblem.mockResolvedValue(makeProblem())
      mocks.getLanguageConfig.mockResolvedValue(null)
      mocks.findParticipation.mockResolvedValue(makeParticipation())

      const result = await evaluateSubmission("sub1")

      expect(result.status).toBe("error")
      expect(result.compilerOutput).toContain("cobol")
    })
  })

  it("does not re-judge an already-final submission (worker retry safety)", async () => {
    mocks.findSubmission.mockResolvedValue(
      makeSubmission({ status: "accepted", totalScore: 100 }),
    )

    const result = await evaluateSubmission("sub1")

    expect(result.status).toBe("accepted")
    expect(mocks.findProblem).not.toHaveBeenCalled()
    expect(mocks.submissionSave).not.toHaveBeenCalled()
  })
})
