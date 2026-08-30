"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Clock3,
  Code2,
  HardDrive,
  ListChecks,
  Play,
  RotateCcw,
  Send,
  TriangleAlert,
  ChevronRight,
  FileText,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { api } from "@/lib/api"
import { Badge, Button, Card, CardContent, ErrorBanner, Skeleton } from "./ui"
import { CodeEditor } from "./workspace/code-editor"
import { ResultsPanel, type WorkspaceSubmission } from "./workspace/results-panel"
import { inr } from "@/lib/format"
import { ProblemDescription } from "./problem-description"

interface PublicTestCase {
  input: string
  expectedOutput: string
  description?: string
}

interface PracticeProblemDetail {
  _id: string
  title: string
  slug: string
  description: string
  difficulty: "easy" | "medium" | "hard"
  type: "coding" | "mcq"
  points: number
  timeLimit: number
  memoryLimit: number
  languageSupport: string[]
  solutionTemplate: Record<string, string>
  testCases: PublicTestCase[]
  options: string[]
  mcqLayout: "grid" | "list"
  contestId: {
    _id: string
    title: string
    slug: string
    status: string
    type: string
    entryFee: number
  } | null
}

interface Language {
  key: string
  name: string
  version: string
}

const difficultyTone: Record<string, "green" | "amber" | "red"> = {
  easy: "green",
  medium: "amber",
  hard: "red",
}

const difficultyLabel: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
}

const STARTERS: Record<string, string> = {
  javascript: `function solve(input) {\n  // read from stdin via require('fs')\n  console.log(input);\n}\n`,
  python: `def solve():\n    # read stdin lines\n    print("hello")\n\nsolve()\n`,
  golang: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("hello")\n}\n`,
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    return 0;\n}\n`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("hello");\n    }\n}\n`,
}

type Tab = "description" | "submissions"

export function ProblemViewer({ problemSlug }: { problemSlug: string }) {
  const {
    data: problem,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["problem", "slug", problemSlug],
    queryFn: () => api.get<PracticeProblemDetail>(`/problems/slug/${problemSlug}`),
    retry: false,
  })

  const { data: languages } = useQuery({
    queryKey: ["languages"],
    queryFn: () => api.get<Language[]>("/languages"),
    retry: false,
    staleTime: 5 * 60_000,
  })

  const [language, setLanguage] = useState("")
  const [code, setCode] = useState("")
  const [mcqChoice, setMcqChoice] = useState<number | null>(null)
  const [busy, setBusy] = useState<"run" | "submit" | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [submission, setSubmission] = useState<WorkspaceSubmission | null>(null)
  const [liveStatus, setLiveStatus] = useState<string | null>(null)
  const [history, setHistory] = useState<Array<{ id: string; mode: string; status: string; score: number; at: Date }>>([])
  const [activeTab, setActiveTab] = useState<Tab>("description")
  const [resultTab, setResultTab] = useState<"testcase" | "result">("testcase")

  const problemLanguages = useMemo(() => {
    if (!problem || problem.type === "mcq") return []
    const supported = new Set(problem.languageSupport ?? [])
    return (languages ?? []).filter((l) => supported.has(l.key) || supported.size === 0)
  }, [problem, languages])

  useEffect(() => {
    if (problemLanguages.length > 0 && !language) {
      setLanguage(problemLanguages[0].key)
    }
  }, [problemLanguages, language])

  useEffect(() => {
    if (!problem || problem.type !== "coding" || !language) return
    const template = problem.solutionTemplate?.[language] ?? STARTERS[language] ?? STARTERS.javascript
    if (!code) setCode(template)
  }, [problem, language])

  function resetCode() {
    if (!problem || !language) return
    setCode(problem.solutionTemplate?.[language] ?? STARTERS[language] ?? STARTERS.javascript)
  }

  async function send(mode: "run" | "submit") {
    if (!problem) return
    setBusy(mode)
    setRunError(null)
    setSubmission(null)
    setLiveStatus("queued")
    try {
      const payload =
        problem.type === "mcq"
          ? { problemId: problem._id, code: mcqChoice?.toString() ?? "", mode: "submit" }
          : { problemId: problem._id, language, code, mode }
      const result = await api.post<{ _id: string; status: string; totalScore: number }>(
        `/contests/${problem.contestId?._id}/submissions`,
        payload,
      )
      const newEntry = {
        id: result._id,
        mode: "submit",
        status: "pending",
        score: result.totalScore,
        at: new Date(),
      }
      setHistory((prev) => [newEntry, ...prev].slice(0, 10))
      setLiveStatus("running")
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        try {
          const sub = await api.get<WorkspaceSubmission>(`/contests/${problem.contestId?._id}/submissions/${result._id}`)
          if (sub && ["accepted", "rejected", "error", "timeout"].includes(sub.status)) {
            clearInterval(poll)
            setSubmission(sub)
            setLiveStatus(null)
            setHistory((prev) =>
              prev.map((h) => (h.id === result._id ? { ...h, status: sub.status, score: sub.totalScore } : h)),
            )
          }
        } catch {
          // ignore poll errors
        }
        if (attempts > 30) clearInterval(poll)
      }, 1000)
    } catch (err) {
      setRunError((err as Error).message)
      setLiveStatus(null)
    } finally {
      setBusy(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Skeleton className="mx-auto h-6 w-48" />
          <Skeleton className="mx-auto mt-3 h-4 w-32" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <TriangleAlert className="mx-auto h-8 w-8 text-amber-500" />
          <p className="mt-2 text-sm text-muted-foreground">This problem isn&apos;t available for practice right now.</p>
          <Link
            href="/problems"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline dark:text-orange-400"
          >
            <ArrowLeft className="h-4 w-4" /> Back to library
          </Link>
        </div>
      </div>
    )
  }

  if (!problem) return null

  const isMcq = problem.type === "mcq"
  const isGrid = isMcq && problem.mcqLayout === "grid"

  // ═══════════════════════════════════════════════════════════════
  // MCQ LAYOUT — single column, no code editor, no test cases
  // ═══════════════════════════════════════════════════════════════
  if (isMcq) {
    return (
      <div className="flex h-screen flex-col">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/80 backdrop-blur-sm px-4 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/problems" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0">
              <ArrowLeft className="h-3.5 w-3.5" /> Library
            </Link>
            <span className="text-muted-foreground/30 shrink-0">/</span>
            <h1 className="text-sm font-semibold truncate min-w-0">{problem.title}</h1>
            <Badge tone={difficultyTone[problem.difficulty] ?? "neutral"} className="text-[10px] px-1.5 py-0 shrink-0">
              {difficultyLabel[problem.difficulty] ?? problem.difficulty}
            </Badge>
            <Badge tone="teal" className="text-[10px] px-1.5 py-0 shrink-0">MCQ</Badge>
          </div>
          <Badge tone="slate" className="text-[10px] px-1.5 py-0 shrink-0">{problem.points} pts</Badge>
        </div>

        {/* Content — scrollable single column */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
            {/* Tabs */}
            <div className="mb-6 flex items-center border-b border-border">
              <button
                onClick={() => setActiveTab("description")}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === "description"
                    ? "border-orange-500 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-3.5 w-3.5" /> Description
              </button>
              {problem.contestId && (
                <Link
                  href={`/contests/${problem.contestId._id}`}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
                >
                  Contest <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </div>

            {/* Question */}
            <div className="mb-6">
              <ProblemDescription content={problem.description} />
            </div>

            {/* Options */}
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-bold">Choose one answer</h3>
              <div className={isGrid ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2"}>
                {problem.options.map((opt, i) => (
                  <label
                    key={i}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3.5 text-left text-sm transition-all ${
                      mcqChoice === i
                        ? "border-orange-500 bg-orange-500/10 font-medium shadow-sm"
                        : "border-border hover:border-orange-300 hover:bg-accent/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`mcq-${problem._id}`}
                      checked={mcqChoice === i}
                      onChange={() => setMcqChoice(i)}
                      className="sr-only"
                    />
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                      mcqChoice === i
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-border text-muted-foreground"
                    }`}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="pt-0.5 font-mono text-sm">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Submit */}
            {runError && <ErrorBanner message={runError} />}

            <Button
              className="w-full h-12 text-base"
              size="lg"
              loading={busy === "submit"}
              disabled={mcqChoice === null || busy !== null}
              onClick={() => send("submit")}
            >
              <Send className="h-4 w-4" /> Submit answer
            </Button>

            {/* Result */}
            {(submission || liveStatus) && (
              <div className="mt-6">
                <ResultsPanel submission={submission} liveStatus={liveStatus} history={history} />
              </div>
            )}

            {/* CTA */}
            {problem.contestId && (
              <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Want to compete for real prizes?{" "}
                  <Link href={`/contests/${problem.contestId._id}`} className="font-medium text-orange-600 hover:underline dark:text-orange-400">
                    Join the contest
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // CODING LAYOUT — split view with code editor
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/80 backdrop-blur-sm px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/problems" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0">
            <ArrowLeft className="h-3.5 w-3.5" /> Library
          </Link>
          <span className="text-muted-foreground/30 shrink-0">/</span>
          <h1 className="text-sm font-semibold truncate min-w-0">{problem.title}</h1>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge tone={difficultyTone[problem.difficulty] ?? "neutral"} className="text-[10px] px-1.5 py-0">
              {difficultyLabel[problem.difficulty] ?? problem.difficulty}
            </Badge>
            <Badge tone="teal" className="text-[10px] px-1.5 py-0">Coding</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <Badge tone="slate" className="text-[10px] px-1.5 py-0">{problem.points} pts</Badge>
          <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {problem.timeLimit / 1000}s</span>
          <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" /> {problem.memoryLimit}MB</span>
        </div>
      </div>

      {/* Split view */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {/* Left — Description */}
        <div className="flex flex-col min-w-0 border-b md:border-b-0 md:border-r border-border md:w-1/2 max-h-[50vh] md:max-h-none">
          <div className="flex items-center border-b border-border bg-muted/30">
            <button
              onClick={() => setActiveTab("description")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === "description" ? "border-orange-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" /> Description
            </button>
            {problem.contestId && (
              <Link href={`/contests/${problem.contestId._id}`} className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors">
                Contest <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <ProblemDescription content={problem.description} />
            {problem.testCases.length > 0 && (
              <div className="mt-6 space-y-4">
                {problem.testCases.map((tc, i) => (
                  <div key={i}>
                    <h3 className="mb-2 text-sm font-bold">Example {i + 1}{tc.description ? <span className="ml-2 font-normal text-muted-foreground">{tc.description}</span> : null}</h3>
                    <div className="rounded-lg bg-slate-950 dark:bg-black/40 border border-border p-4 font-mono text-xs">
                      <div className="mb-2"><span className="font-bold text-slate-300">Input:</span> <span className="text-slate-100">{tc.input}</span></div>
                      <div><span className="font-bold text-slate-300">Output:</span> <span className="text-slate-100">{tc.expectedOutput}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — Editor */}
        <div className="flex flex-col min-w-0 md:w-1/2 flex-1 min-h-0">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
            <div className="flex items-center gap-2">
              <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="h-7 rounded-md border border-input bg-background px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 cursor-pointer">
                {problemLanguages.map((l) => (<option key={l.key} value={l.key}>{l.name}</option>))}
                {problemLanguages.length === 0 && <option value="javascript">JavaScript</option>}
              </select>
              <button onClick={resetCode} disabled={!code} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" loading={busy === "run"} disabled={!code.trim() || busy !== null} onClick={() => send("run")} className="h-7 text-xs">
                <Play className="h-3 w-3" /> Run
              </Button>
              <Button size="sm" loading={busy === "submit"} disabled={!code.trim() || busy !== null} onClick={() => send("submit")} className="h-7 text-xs">
                <Send className="h-3 w-3" /> Submit
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <CodeEditor value={code} onChange={setCode} language={language} />
          </div>
          {runError && <div className="px-4 pb-2"><ErrorBanner message={runError} /></div>}
          <div className="flex flex-col border-t border-border" style={{ height: '35%', minHeight: 140 }}>
            <div className="flex shrink-0 items-center border-b border-border bg-muted/30">
              <button onClick={() => setResultTab("testcase")} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${resultTab === "testcase" ? "border-orange-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <ListChecks className="h-3 w-3" /> Testcase
              </button>
              <button onClick={() => setResultTab("result")} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${resultTab === "result" ? "border-orange-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <Code2 className="h-3 w-3" /> Test Result
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {resultTab === "result" ? (
                <ResultsPanel submission={submission} liveStatus={liveStatus} history={history} />
              ) : (
                <div className="p-4">
                  {problem.testCases.length > 0 ? (
                    <div className="space-y-3">
                      {problem.testCases.map((tc, i) => (
                        <div key={i} className="rounded-md border border-border p-3">
                          <div className="text-xs font-medium text-muted-foreground mb-1">Case {i + 1}</div>
                          <div className="font-mono text-xs space-y-1">
                            <div><span className="text-muted-foreground">Input: </span><span className="text-foreground">{tc.input}</span></div>
                            <div><span className="text-muted-foreground">Expected: </span><span className="text-foreground">{tc.expectedOutput}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="p-4 text-xs text-muted-foreground text-center">No test cases available</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      {problem.contestId && (
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2">
          <p className="text-xs text-muted-foreground">Want to compete for real prizes? Join the full contest for leaderboard rankings.</p>
          <Button size="sm" className="h-7 text-xs" onClick={() => (window.location.href = `/contests/${problem.contestId?._id}`)}>Join contest</Button>
        </div>
      )}
    </div>
  )
}
