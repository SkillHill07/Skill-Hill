import { Problem, type IProblem } from "./problem.model.js"
import { Contest } from "../contest/contest.model.js"
import { languageService } from "../language/language.service.js"
import { makeSlug } from "../../utils/slugify.js"
import { logger } from "../../utils/logger.js"
import type {
  CreateProblemBody,
  UpdateProblemBody,
  TestCaseInput,
} from "./problem.validation.js"

async function getContestOrThrow(contestId: string) {
  const contest = await Contest.findById(contestId)
  if (!contest) {
    throw Object.assign(new Error("Contest not found"), {
      status: 404,
      code: "CONTEST_NOT_FOUND",
    })
  }
  return contest
}

/** Problems can only be modified while the contest is in draft. */
async function assertContestDraft(contestId: string): Promise<void> {
  const contest = await getContestOrThrow(contestId)
  if (contest.status !== "draft") {
    throw Object.assign(
      new Error("Problems can only be edited while the contest is a draft"),
      { status: 400, code: "CONTEST_NOT_DRAFT" },
    )
  }
}

async function getProblemOrThrow(contestId: string, problemId: string): Promise<IProblem> {
  const problem = await Problem.findOne({ _id: problemId, contestId })
  if (!problem) {
    throw Object.assign(new Error("Problem not found in this contest"), {
      status: 404,
      code: "PROBLEM_NOT_FOUND",
    })
  }
  return problem
}

async function ensureUniqueSlug(
  contestId: string,
  slug: string,
  excludeId?: string,
): Promise<string> {
  const existing = await Problem.findOne({
    contestId,
    slug,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
  if (existing) {
    throw Object.assign(new Error("A problem with this slug already exists in the contest"), {
      status: 409,
      code: "SLUG_EXISTS",
    })
  }
  return slug
}

/**
 * List problems for a contest.
 * Public-safe by default: hidden test cases are stripped by the schema toJSON
 * transform. `includeHidden` is only for admin/creator routes and returns
 * plain objects (toObject) so the transform doesn't strip hidden cases.
 */
async function listProblems(
  contestId: string,
  includeHidden = false,
): Promise<Array<IProblem | ReturnType<IProblem["toObject"]>>> {
  await getContestOrThrow(contestId)
  const problems = await Problem.find({ contestId }).sort({ order: 1, createdAt: 1 })
  if (includeHidden) return problems.map((p) => p.toObject())
  return problems
}

async function getProblem(
  contestId: string,
  problemId: string,
  includeHidden = false,
): Promise<IProblem | ReturnType<IProblem["toObject"]>> {
  const problem = await getProblemOrThrow(contestId, problemId)
  if (includeHidden) return problem.toObject()
  return problem
}

/**
 * Practice library — problems from public contests (active / frozen /
 * settled). Draft and cancelled contests stay hidden. Hidden test cases are
 * stripped by the schema toJSON transform; correctAnswer too.
 */
const PRACTICE_CONTEST_STATUSES = ["active", "frozen", "settled"]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function listPracticeProblems(filters: {
  difficulty?: string
  type?: string
  search?: string
  language?: string
  page?: number
  limit?: number
}): Promise<{
  problems: Array<IProblem & { contestId: unknown }>
  total: number
  page: number
  limit: number
  totalPages: number
}> {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20

  const practiceContests = await Contest.find({
    status: { $in: PRACTICE_CONTEST_STATUSES },
  }).select("_id")
  if (practiceContests.length === 0) {
    return { problems: [], total: 0, page, limit, totalPages: 0 }
  }

  const query: Record<string, unknown> = {
    contestId: { $in: practiceContests.map((c) => c._id) },
  }
  if (filters.difficulty) query.difficulty = filters.difficulty
  if (filters.type) query.type = filters.type
  if (filters.language) query.languageSupport = filters.language
  if (filters.search) {
    query.title = { $regex: escapeRegExp(filters.search), $options: "i" }
  }

  const [problems, total] = await Promise.all([
    Problem.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("contestId", "title slug status type entryFee"),
    Problem.countDocuments(query),
  ])

  return { problems, total, page, limit, totalPages: Math.ceil(total / limit) }
}

/**
 * A single problem for the practice page. Only reachable when its contest is
 * public (active/frozen/settled) — otherwise 404 like it never existed.
 */
async function getPracticeProblem(problemId: string): Promise<IProblem> {
  const problem = await Problem.findById(problemId).populate(
    "contestId",
    "title slug status type entryFee",
  )
  const contest = problem?.contestId as unknown as { status?: string } | null
  if (!problem || !contest || !PRACTICE_CONTEST_STATUSES.includes(contest.status ?? "")) {
    throw Object.assign(new Error("Problem not found"), {
      status: 404,
      code: "PROBLEM_NOT_FOUND",
    })
  }
  return problem
}

async function createProblem(
  contestId: string,
  input: CreateProblemBody,
): Promise<IProblem> {
  await assertContestDraft(contestId)

  const type = input.type // always defined — Zod defaults to "coding"

  // Coding problems can only use languages the judge supports (catalog check).
  // MCQ problems don't run code, so the language list is irrelevant.
  if (type === "coding") {
    await languageService.validateLanguageKeys(input.languageSupport ?? [])
  }

  const slug = input.slug ?? makeSlug(input.title)
  await ensureUniqueSlug(contestId, slug)

  const problem = await Problem.create({
    ...input,
    contestId,
    slug,
    status: "draft",
    // Type-specific normalization (the Zod superRefine already enforced the
    // required fields at the boundary; this keeps the doc shape clean).
    languageSupport: type === "coding" ? (input.languageSupport ?? []) : [],
    options: type === "mcq" ? (input.options ?? []) : [],
    correctAnswer: type === "mcq" ? (input.correctAnswer ?? null) : null,
  })

  // Track the problem in the contest (problemIds[] is the contest's reference list)
  await Contest.findByIdAndUpdate(contestId, { $push: { problemIds: problem._id } })

  logger.info({ contestId, problemId: problem._id.toString() }, "problem_created")
  return problem
}

async function updateProblem(
  contestId: string,
  problemId: string,
  input: UpdateProblemBody,
): Promise<IProblem> {
  await assertContestDraft(contestId)

  const problem = await getProblemOrThrow(contestId, problemId)
  const finalType = input.type ?? problem.type

  // Only validate languages that are NEW to this problem, and only for coding
  // problems — MCQ problems don't run code. A language disabled after problems
  // referenced it stays valid for those existing problems, so admins can still
  // edit unrelated fields without breaking them.
  if (finalType === "coding" && input.languageSupport) {
    const existingKeys = new Set(problem.languageSupport)
    const addedKeys = input.languageSupport.filter((k) => !existingKeys.has(k))
    if (addedKeys.length > 0) {
      await languageService.validateLanguageKeys(addedKeys)
    }
  }

  if (input.slug) {
    await ensureUniqueSlug(contestId, input.slug, problemId)
  }

  Object.assign(problem, input)

  // Keep type-specific fields clean (safety net for mixed PATCHes, e.g.
  // switching type without clearing the other type's fields).
  if (finalType === "mcq") {
    problem.languageSupport = []
    // An options-only PATCH (no correctAnswer in the body) bypasses the Zod
    // in-range check, so re-validate the stored answer against the new list.
    if (problem.correctAnswer !== null && problem.correctAnswer >= (problem.options ?? []).length) {
      throw Object.assign(new Error("correctAnswer must be a valid option index"), {
        status: 400,
        code: "MCQ_INVALID_ANSWER",
      })
    }
    // Stale coding fields are irrelevant for mcq — keep the doc clean.
    problem.solutionTemplate = {}
    problem.testCases = []
  } else {
    problem.options = []
    problem.correctAnswer = null
    if ((problem.languageSupport ?? []).length === 0) {
      throw Object.assign(
        new Error("Coding problems require at least one supported language"),
        { status: 400, code: "LANGUAGE_REQUIRED" },
      )
    }
  }

  await problem.save()

  logger.info({ contestId, problemId }, "problem_updated")
  return problem
}

async function deleteProblem(contestId: string, problemId: string): Promise<void> {
  await assertContestDraft(contestId)
  await getProblemOrThrow(contestId, problemId)

  await Problem.deleteOne({ _id: problemId, contestId })
  await Contest.findByIdAndUpdate(contestId, { $pull: { problemIds: problemId } })

  logger.info({ contestId, problemId }, "problem_deleted")
}

async function addTestCase(
  contestId: string,
  problemId: string,
  input: TestCaseInput,
): Promise<IProblem> {
  await assertContestDraft(contestId)
  const problem = await getProblemOrThrow(contestId, problemId)

  if (problem.type === "mcq") {
    throw Object.assign(new Error("MCQ problems do not have test cases"), {
      status: 400,
      code: "MCQ_NO_TEST_CASES",
    })
  }

  problem.testCases.push({
    input: input.input,
    expectedOutput: input.expectedOutput,
    isPublic: input.isPublic,
    order: input.order ?? problem.testCases.length,
    description: input.description,
  })
  await problem.save()

  logger.info({ contestId, problemId }, "test_case_added")
  return problem
}

async function removeTestCase(
  contestId: string,
  problemId: string,
  testCaseId: string,
): Promise<IProblem> {
  await assertContestDraft(contestId)
  const problem = await getProblemOrThrow(contestId, problemId)

  problem.testCases = problem.testCases.filter(
    (tc) => tc._id?.toString() !== testCaseId,
  )
  await problem.save()

  logger.info({ contestId, problemId, testCaseId }, "test_case_removed")
  return problem
}

/**
 * Verify a problem exists and its contest is still a draft. Used by routes
 * BEFORE side-effecting operations (e.g. image uploads) so an unknown or
 * locked problem can't orphan an R2 object or a partial write.
 */
async function assertProblemEditable(contestId: string, problemId: string): Promise<void> {
  await assertContestDraft(contestId)
  await getProblemOrThrow(contestId, problemId)
}

/** Append a statement image URL to a problem (draft contests only). */
async function addProblemImage(
  contestId: string,
  problemId: string,
  imageUrl: string,
): Promise<IProblem> {
  await assertContestDraft(contestId)
  const problem = await getProblemOrThrow(contestId, problemId)

  problem.imageUrls.push(imageUrl)
  await problem.save()

  logger.info({ contestId, problemId, imageUrl }, "problem_image_added")
  return problem
}

/** Remove a statement image by its index in imageUrls (draft contests only). */
async function removeProblemImage(
  contestId: string,
  problemId: string,
  index: number,
): Promise<IProblem> {
  await assertContestDraft(contestId)
  const problem = await getProblemOrThrow(contestId, problemId)

  if (!Number.isInteger(index) || index < 0 || index >= problem.imageUrls.length) {
    throw Object.assign(new Error("Image index is out of range"), {
      status: 400,
      code: "INVALID_IMAGE_INDEX",
    })
  }

  problem.imageUrls.splice(index, 1)
  await problem.save()

  logger.info({ contestId, problemId, index }, "problem_image_removed")
  return problem
}

/**
 * Test cases for the judge worker. `includeHidden` is ONLY true when called
 * from the judge module (separate worker process) — never from routes.
 */
async function getTestCases(
  problemId: string,
  includeHidden = false,
): Promise<IProblem["testCases"]> {
  const problem = await Problem.findById(problemId).select("testCases")
  if (!problem) {
    throw Object.assign(new Error("Problem not found"), {
      status: 404,
      code: "PROBLEM_NOT_FOUND",
    })
  }

  if (includeHidden) return problem.testCases
  return problem.testCases.filter((tc) => tc.isPublic)
}

export const problemService = {
  listProblems,
  getProblem,
  listPracticeProblems,
  getPracticeProblem,
  createProblem,
  updateProblem,
  deleteProblem,
  assertProblemEditable,
  addProblemImage,
  removeProblemImage,
  addTestCase,
  removeTestCase,
  getTestCases,
}
