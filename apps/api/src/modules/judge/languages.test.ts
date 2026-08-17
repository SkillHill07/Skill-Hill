import { describe, it, expect, vi, beforeEach } from "vitest"
import { getLanguageConfig, buildRunCommand } from "./languages.js"

const mocks = vi.hoisted(() => ({ findOne: vi.fn() }))

vi.mock("../language/language.model.js", () => ({
  Language: { findOne: mocks.findOne },
}))

describe("getLanguageConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the catalog execution config for an enabled language", async () => {
    mocks.findOne.mockResolvedValue({
      key: "javascript",
      extension: "js",
      compileCommand: null,
      runCommand: "node {file}.js",
      dockerImage: "node:20-alpine",
    })

    const config = await getLanguageConfig("javascript")

    expect(config).toEqual({
      key: "javascript",
      extension: "js",
      compileCommand: null,
      runCommand: "node {file}.js",
      dockerImage: "node:20-alpine",
      fileBase: "main",
    })
    // Only enabled languages are eligible
    expect(mocks.findOne).toHaveBeenCalledWith({ key: "javascript", enabled: true })
  })

  it("uses the Main file base convention for java", async () => {
    mocks.findOne.mockResolvedValue({
      key: "java",
      extension: "java",
      compileCommand: "javac {file}.java",
      runCommand: "java {file}",
      dockerImage: "openjdk:21-alpine",
    })

    const config = await getLanguageConfig("java")
    expect(config?.fileBase).toBe("Main")
  })

  it("returns null when the language is unknown or disabled", async () => {
    mocks.findOne.mockResolvedValue(null)
    await expect(getLanguageConfig("cobol")).resolves.toBeNull()
  })
})

describe("buildRunCommand", () => {
  const base = {
    key: "x",
    extension: "js",
    dockerImage: "img",
    fileBase: "main",
  }

  it("tokenizes a plain run command", () => {
    expect(
      buildRunCommand({ ...base, compileCommand: null, runCommand: "node {file}.js" }),
    ).toEqual(["node", "main.js"])
  })

  it("chains compile and run through a shell when a compile step exists", () => {
    expect(
      buildRunCommand({
        ...base,
        compileCommand: "g++ -o {file} {file}.cpp",
        runCommand: "./{file}",
      }),
    ).toEqual(["sh", "-c", "g++ -o main main.cpp && ./main"])
  })

  it("replaces the {file} placeholder everywhere", () => {
    expect(
      buildRunCommand({
        ...base,
        fileBase: "Main",
        compileCommand: "javac {file}.java",
        runCommand: "java {file}",
      }),
    ).toEqual(["sh", "-c", "javac Main.java && java Main"])
  })
})
