import { Language } from "../language/language.model.js"

/**
 * Judge-side language resolution. The execution contract (dockerImage,
 * compileCommand, runCommand, extension) is owned by the **Language catalog**
 * (admin-managed). The judge never hardcodes per-language commands — it reads
 * the catalog and only adds judge conventions on top (file base name).
 *
 * The commands use a `{file}` placeholder, e.g.:
 *   javascript — runCommand "node {file}.js"
 *   cpp        — compileCommand "g++ -o {file} {file}.cpp", runCommand "./{file}"
 *   java       — compileCommand "javac {file}.java", runCommand "java {file}"
 */

export interface LanguageExecConfig {
  key: string
  extension: string
  compileCommand: string | null
  runCommand: string
  dockerImage: string
  /** File base name written into the sandbox (e.g. "main" → main.js). */
  fileBase: string
}

/**
 * Fetch an enabled language's execution config from the catalog.
 * Returns null if the key is unknown or the language is disabled.
 */
export async function getLanguageConfig(
  key: string,
): Promise<LanguageExecConfig | null> {
  const lang = await Language.findOne({ key, enabled: true })
  if (!lang) return null

  return {
    key: lang.key,
    extension: lang.extension,
    compileCommand: lang.compileCommand,
    runCommand: lang.runCommand,
    dockerImage: lang.dockerImage,
    // Java requires the source file name to match the (public) class name.
    // LeetCode-style convention: user code must declare `class Main`.
    // ponytail: hardcoded per-key convention — promote to a catalog field
    // ("fileBase") if a language ever needs another base name.
    fileBase: lang.key === "java" ? "Main" : "main",
  }
}

/**
 * Build the container command from the catalog's compile/run templates.
 * Returns ["sh", "-c", "compile && run"] when a compile step exists, otherwise
 * the run command tokenized (e.g. ["node", "main.js"]).
 */
export function buildRunCommand(
  config: LanguageExecConfig,
): string[] {
  const replace = (template: string): string => template.replaceAll("{file}", config.fileBase)
  const run = replace(config.runCommand)

  if (config.compileCommand) {
    return ["sh", "-c", `${replace(config.compileCommand)} && ${run}`]
  }
  return run.split(/\s+/).filter(Boolean)
}
