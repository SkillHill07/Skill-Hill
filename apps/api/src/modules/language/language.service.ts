import { Language, type ILanguage } from "./language.model.js"
import { Problem } from "../problem/problem.model.js"
import { logger } from "../../utils/logger.js"
import type {
  CreateLanguageBody,
  UpdateLanguageBody,
} from "./language.validation.js"

async function getLanguageOrThrow(key: string): Promise<ILanguage> {
  const language = await Language.findOne({ key })
  if (!language) {
    throw Object.assign(new Error("Language not found"), {
      status: 404,
      code: "LANGUAGE_NOT_FOUND",
    })
  }
  return language
}

/**
 * List languages. Public callers only see enabled ones; staff may pass
 * includeDisabled=true to manage the full catalog.
 */
async function listLanguages(includeDisabled = false): Promise<ILanguage[]> {
  const query = includeDisabled ? {} : { enabled: true }
  return Language.find(query).sort({ order: 1, name: 1 })
}

/** Get a single language. Disabled languages are hidden from non-staff callers. */
async function getLanguageByKey(
  key: string,
  viewer?: { role: string } | null,
): Promise<ILanguage> {
  const language = await getLanguageOrThrow(key)

  const isStaff = viewer?.role === "admin" || viewer?.role === "creator"
  if (!language.enabled && !isStaff) {
    throw Object.assign(new Error("Language not found"), {
      status: 404,
      code: "LANGUAGE_NOT_FOUND",
    })
  }

  return language
}

async function createLanguage(input: CreateLanguageBody): Promise<ILanguage> {
  const existing = await Language.findOne({ key: input.key })
  if (existing) {
    throw Object.assign(new Error("A language with this key already exists"), {
      status: 409,
      code: "LANGUAGE_KEY_EXISTS",
    })
  }

  const language = await Language.create({
    ...input,
    enabled: input.enabled ?? true,
    order: input.order ?? 0,
  })

  logger.info({ key: language.key }, "language_created")
  return language
}

async function updateLanguage(
  key: string,
  input: UpdateLanguageBody,
): Promise<ILanguage> {
  const language = await getLanguageOrThrow(key)
  Object.assign(language, input)
  await language.save()

  logger.info({ key }, "language_updated")
  return language
}

/**
 * Delete a language. Referential integrity: blocked while any problem
 * references the key. To stop new usage without breaking existing problems,
 * PATCH enabled=false instead.
 */
async function deleteLanguage(key: string): Promise<void> {
  await getLanguageOrThrow(key)

  const referenced = await Problem.exists({ languageSupport: key })
  if (referenced) {
    throw Object.assign(
      new Error("This language is used by problems and cannot be deleted. Disable it instead."),
      { status: 409, code: "LANGUAGE_IN_USE" },
    )
  }

  await Language.deleteOne({ key })
  logger.info({ key }, "language_deleted")
}

/**
 * Validate that all given keys exist and are enabled.
 * Called by the problem service before create/update — problems can only use
 * languages the judge can actually run.
 */
async function validateLanguageKeys(keys: string[]): Promise<void> {
  if (!keys || keys.length === 0) return

  const unique = [...new Set(keys)]
  const found = await Language.find({ key: { $in: unique }, enabled: true }).select("key")
  const foundKeys = new Set(found.map((l) => l.key))

  const missing = unique.filter((k) => !foundKeys.has(k))
  if (missing.length > 0) {
    throw Object.assign(
      new Error(`Unsupported or disabled language(s): ${missing.join(", ")}`),
      { status: 400, code: "UNSUPPORTED_LANGUAGE" },
    )
  }
}

// --- Default seed ---

export const DEFAULT_LANGUAGES: Array<{
  key: string
  name: string
  version: string
  extension: string
  compileCommand: string | null
  runCommand: string
  dockerImage: string
  order: number
}> = [
  {
    key: "javascript",
    name: "JavaScript",
    version: "20-alpine",
    extension: "js",
    compileCommand: null,
    runCommand: "node {file}.js",
    dockerImage: "node:20-alpine",
    order: 1,
  },
  {
    key: "typescript",
    name: "TypeScript",
    version: "20-alpine",
    extension: "ts",
    compileCommand: null,
    runCommand: "npx tsx {file}.ts",
    dockerImage: "node:20-alpine",
    order: 2,
  },
  {
    key: "python",
    name: "Python",
    version: "3.12-alpine",
    extension: "py",
    compileCommand: null,
    runCommand: "python3 {file}.py",
    dockerImage: "python:3.12-alpine",
    order: 3,
  },
  {
    key: "cpp",
    name: "C++",
    version: "13-alpine",
    extension: "cpp",
    compileCommand: "g++ -o {file} {file}.cpp",
    runCommand: "./{file}",
    dockerImage: "gcc:13-alpine",
    order: 4,
  },
  {
    key: "java",
    name: "Java",
    version: "21-alpine",
    extension: "java",
    compileCommand: "javac {file}.java",
    runCommand: "java {file}",
    dockerImage: "openjdk:21-alpine",
    order: 5,
  },
]

/**
 * Idempotent upsert of the default language catalog. Called on server boot —
 * missing defaults are inserted, existing ones are left untouched (admins may
 * have customized versions/commands).
 */
export async function seedDefaultLanguages(): Promise<void> {
  for (const lang of DEFAULT_LANGUAGES) {
    const existing = await Language.findOne({ key: lang.key })
    if (existing) continue
    await Language.create(lang)
  }
  logger.info({ count: DEFAULT_LANGUAGES.length }, "default_languages_seeded")
}

export const languageService = {
  listLanguages,
  getLanguageByKey,
  createLanguage,
  updateLanguage,
  deleteLanguage,
  validateLanguageKeys,
}
