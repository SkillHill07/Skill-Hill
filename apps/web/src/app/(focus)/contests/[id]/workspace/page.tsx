"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, Play, RotateCcw, Send } from "lucide-react"
import { api } from "@/lib/api"
import { getSocket, disconnectSocket, type SubmissionStatusEvent } from "@/lib/socket"
import { Badge, Button, EmptyState, ErrorBanner, Skeleton } from "@/components/ui"
import { SubmissionStatusBadge } from "@/components/status-badge"
import { CodeEditor } from "@/components/workspace/code-editor"
import { ResultsPanel, type WorkspaceSubmission } from "@/components/workspace/results-panel"
import { cn } from "@skillcontest/ui"

interface Contest {
  _id: string
  title: string
  status: string
}

interface Problem {
  _id: string
  title: string
  type: string
  difficulty: string
  points: number
  description: string
  imageUrls: string[]
  languageSupport: string[]
  solutionTemplate: Record<string, string>
  options: string[]
  testCases: Array<{ input: string; expectedOutput: string; description?: string }>
}

interface Language {
  key: string
  name: string
  version: string
  extension: string
}

type SubmissionRow = WorkspaceSubmission & { problemId: string; submittedAt: string }

const STARTERS: Record<string, string> = {
  javascript: `function solve(input) {\n  // read from stdin via require('fs')\n  console.log(input);\n}\n`,
  python: `def solve():\n    # read stdin lines\n    print("hello")\n\nsolve()\n`,
  golang: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("hello")\n}\n`,
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // fast IO\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    return 0;\n}\n`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("hello");\n    }\n}\n`,
}

const TERMINAL_STATUSES = ["accepted", "rejected", "error", "timeout"]

function codeKey(contestId: string, problemId: string, language: string): string {
  return `skillhill:code:${contestId}:${problemId}:${language}`
}

export default function WorkspacePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const contestId = params.id

  const [activeProblem, setActiveProblem] = useState<string | null>(null)
  const [languageByProblem, setLanguageByProblem] = useState<Record<string, string>>({})
  const [codeByProblem, setCodeByProblem] = useState<Record<string, string>>({})
  const [mcqChoice, setMcqChoice] = useState<number | null>(null)
  const [busy, setBusy] = useState<"run" | "submit" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState<Record<string, SubmissionStatusEvent>>({})

  const { data: contest, isLoading: contestLoading } = useQuery({
    queryKey: ["contest", contestId],
    queryFn: () => api.get<Contest>(`/contests/${contestId}`),
    retry: false,
  })

  const { data: problems, isLoading: problemsLoading } = useQuery({
    queryKey: ["problems", contestId],
    queryFn: () => api.get<Problem[]>(`/contests/${contestId}/problems`),
    retry: false,
  })

  const { data: languages } = useQuery({
    queryKey: ["languages"],
    queryFn: () => api.get<Language[]>("/languages"),
    retry: false,
    staleTime: 5 * 60_000,
  })

  const { data: submissions, refetch: refetchSubmissions } = useQuery({
    queryKey: ["submissions", contestId],
    queryFn: () => api.get<SubmissionRow[]>(`/contests/${contestId}/submissions`),
  })

  const pb = useMemo(
    () => problems?.find((p) => p._id === activeProblem) ?? problems?.[0],
    [problems, activeProblem],
  )

  const problemLanguages = useMemo(() => {
    if (!pb || pb.type === "mcq") return []
    const supported = new Set(pb.languageSupport ?? [])
    return (languages ?? []).filter((l) => supported.has(l.key) || supported.size === 0)
  }, [pb, languages])

  const language =
    (pb && languageByProblem[pb._id]) ||
    problemLanguages[0]?.key ||
    languages?.[0]?.key ||
    "javascript"

  // Seed code once per problem/language: saved draft → template → starter.
  useEffect(() => {
    if (!pb || pb.type !== "coding") return
    const key = codeKey(contestId, pb._id, language)
    const saved = window.localStorage.getItem(key)
    if (saved !== null && !codeByProblem[`${pb._id}:${language}`]) {
      setCodeByProblem((prev) => ({ ...prev, [`${pb._id}:${language}`]: saved }))
      return
    }
    if (codeByProblem[`${pb._id}:${language}`] === undefined) {
      setCodeByProblem((prev) => ({
        ...prev,
        [`${pb._id}:${language}`]:
          pb.solutionTemplate?.[language] ?? STARTERS[language] ?? STARTERS.javascript,
      }))
    }
  }, [pb?._id, language])

  const code = pb ? (codeByProblem[`${pb._id}:${language}`] ?? "") : ""

  const setCode = useCallback(
    (value: string) => {
      if (!pb) return
      setCodeByProblem((prev) => ({ ...prev, [`${pb._id}:${language}`]: value }))
      try {
        window.localStorage.setItem(codeKey(contestId, pb._id, language), value)
      } catch {
        // storage unavailable (private mode) — in-memory state still works
      }
    },
    [pb, language, contestId],
  )

  function resetCode() {
    if (!pb || pb.type !== "coding") return
    const fresh = pb.solutionTemplate?.[language] ?? STARTERS[language] ?? STARTERS.javascript
    setCode(fresh)
  }

  // Socket — live submission status + history refresh. Fully torn down when
  // leaving the workspace so connections don't leak across pages.
  useEffect(() => {
    const socket = getSocket()
    const handler = (event: SubmissionStatusEvent) => {
      if (event.contestId !== contestId) return
      setLive((prev) => ({ ...prev, [event.problemId]: event }))
      if (TERMINAL_STATUSES.includes(event.status)) {
        void refetchSubmissions()
      }
    }
    socket.on("submission:queued", handler)
    socket.on("submission:running", handler)
    socket.on("submission:completed", handler)
    return () => {
      socket.off("submission:queued", handler)
      socket.off("submission:running", handler)
      socket.off("submission:completed", handler)
      disconnectSocket()
    }
  }, [contestId, refetchSubmissions])

  async function send(mode: "run" | "submit") {
    if (!pb) return
    setBusy(mode)
    setError(null)
    try {
      const payload =
        pb.type === "mcq"
          ? { problemId: pb._id, code: mcqChoice?.toString() ?? "", mode }
          : { problemId: pb._id, language, code, mode }
      await api.post(`/contests/${contestId}/submissions`, payload)
      void refetchSubmissions()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (contestLoading || problemsLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <Skeleton className="h-96" />
      </main>
    )
  }

  if (!contest || !problems || problems.length === 0) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <EmptyState
          title="No problems available"
          hint="Problems are published when the contest goes live."
        />
      </main>
    )
  }

  if (contest.status !== "active") {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <EmptyState
          title="Contest is not live"
          hint={contest.status === "frozen" ? "Submissions are frozen while results are being finalized." : "The workspace opens when the contest is active."}
        />
      </main>
    )
  }

  if (!pb) return null

  const latestForProblem = submissions?.find((s) => s.problemId === pb._id) ?? null
  const liveForPb = live[pb._id]
  const mergedLatest: WorkspaceSubmission | null = latestForProblem
    ? {
        ...latestForProblem,
        status: liveForPb && liveForPb.submissionId === latestForProblem._id ? liveForPb.status : latestForProblem.status,
      }
    : null

  const history = (submissions ?? [])
    .filter((s) => s.problemId === pb._id)
    .slice(0, 10)
    .map((s) => ({
      id: s._id,
      mode: s.mode ?? "submit",
      status:
        liveForPb && liveForPb.submissionId === s._id ? liveForPb.status : s.status,
      score: s.totalScore,
      at: new Date(s.submittedAt),
    }))

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => router.push(`/contests/${contestId}`)}
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> {contest.title}
        </button>
        <span className="text-xs text-muted-foreground">
          Drafts save automatically in this browser
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Problem list */}
        <nav aria-label="Contest problems" className="order-1 lg:order-none">
          <ul className="flex snap-x gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:rounded-xl lg:border lg:border-border lg:p-2">
            {problems.map((p, i) => (
              <li key={p._id} className="shrink-0 lg:w-full">
                <button
                  type="button"
                  onClick={() => setActiveProblem(p._id)}
                  aria-current={p._id === pb._id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    p._id === pb._id
                      ? "bg-orange-600/10 font-medium text-orange-600 dark:text-orange-400"
                      : "hover:bg-accent",
                  )}
                >
                  <span className="truncate">
                    <span className="mr-1 text-xs text-muted-foreground">{i + 1}.</span>
                    {p.title}
                  </span>
                  <Badge
                    tone={p.difficulty === "easy" ? "green" : p.difficulty === "medium" ? "amber" : "red"}
                    className="capitalize"
                  >
                    {p.points} pts
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Statement */}
          <section className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={pb.type === "mcq" ? "teal" : "blue"}>
                {pb.type === "mcq" ? "MCQ" : "Coding"}
              </Badge>
              <Badge
                tone={pb.difficulty === "easy" ? "green" : pb.difficulty === "medium" ? "amber" : "red"}
                className="capitalize"
              >
                {pb.difficulty}
              </Badge>
              <span className="text-sm text-muted-foreground">{pb.points} points</span>
            </div>
            <h1 className="mt-2 text-xl font-bold tracking-tight">{pb.title}</h1>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {pb.description}
            </p>
            {pb.imageUrls.length > 0 && (
              <div className="mt-3 grid gap-2">
                {pb.imageUrls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- R2 public URLs
                  <img
                    key={i}
                    src={url}
                    alt={`${pb.title} diagram ${i + 1}`}
                    loading="lazy"
                    className="max-w-full rounded-lg border border-border"
                  />
                ))}
              </div>
            )}

            {pb.type === "coding" && pb.testCases.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Examples</p>
                {pb.testCases.map((tc, i) => (
                  <div key={i} className="grid gap-1 rounded-lg bg-muted/60 p-3 font-mono text-xs">
                    <p><span className="font-sans font-medium">Input:</span> <span className="whitespace-pre-wrap">{tc.input}</span></p>
                    <p><span className="font-sans font-medium">Output:</span> <span className="whitespace-pre-wrap">{tc.expectedOutput}</span></p>
                  </div>
                ))}
              </div>
            )}

            {pb.type === "mcq" && (
              <fieldset className="mt-4">
                <legend className="sr-only">Choose one answer</legend>
                <div className="flex flex-col gap-2">
                  {pb.options.map((opt, i) => (
                    <label
                      key={i}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                        mcqChoice === i
                          ? "border-orange-500 bg-orange-600/10 font-medium"
                          : "border-border hover:bg-accent",
                      )}
                    >
                      <input
                        type="radio"
                        name={`mcq-${pb._id}`}
                        checked={mcqChoice === i}
                        onChange={() => setMcqChoice(i)}
                        className="sr-only"
                      />
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold" aria-hidden>
                        {String.fromCharCode(65 + i)}
                      </span>
                      {opt}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </section>

          {/* Editor / answer */}
          {error && <ErrorBanner message={error} />}

          {pb.type === "coding" ? (
            <section className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <label htmlFor="language-select" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Language
                  </label>
                  <select
                    id="language-select"
                    value={language}
                    onChange={(e) =>
                      pb && setLanguageByProblem((prev) => ({ ...prev, [pb._id]: e.target.value }))
                    }
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                  >
                    {(problemLanguages.length > 0 ? problemLanguages : (languages ?? [])).map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.name} {l.version}
                      </option>
                    ))}
                  </select>
                  <Button variant="ghost" size="sm" onClick={resetCode} disabled={!code}>
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    loading={busy === "run"}
                    disabled={!code.trim() || busy !== null}
                    onClick={() => send("run")}
                  >
                    <Play className="h-3.5 w-3.5" aria-hidden /> Run
                  </Button>
                  <Button
                    size="sm"
                    loading={busy === "submit"}
                    disabled={!code.trim() || busy !== null}
                    onClick={() => send("submit")}
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden /> Submit
                  </Button>
                </div>
              </div>

              <div className="p-4 pb-0">
                <CodeEditor value={code} onChange={setCode} language={language} />
                <p className="py-2 text-xs text-muted-foreground">
                  Run checks the public examples only (no score). Submit runs every test case and counts toward your best score.
                </p>
              </div>

              <div className="border-t border-border">
                <ResultsPanel submission={mergedLatest} liveStatus={liveForPb?.status ?? null} history={history} />
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
              <div className="flex flex-col gap-3">
                <Button
                  className="self-start"
                  loading={busy === "submit"}
                  disabled={mcqChoice === null || busy !== null}
                  onClick={() => send("submit")}
                >
                  <Send className="h-4 w-4" aria-hidden /> Submit answer
                </Button>
                <ResultsPanel submission={mergedLatest} liveStatus={liveForPb?.status ?? null} history={history} />
              </div>
            </section>
          )}

          {/* Full history */}
          {submissions && submissions.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
              <h2 className="mb-3 font-semibold">All my submissions</h2>
              <div className="flex flex-col gap-2">
                {submissions.map((s) => {
                  const lv = Object.values(live).find((e) => e.submissionId === s._id)
                  const status = lv?.status ?? s.status
                  const score = lv?.totalScore ?? s.totalScore
                  return (
                    <div key={s._id} className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5 text-sm">
                      <div className="flex items-center gap-3">
                        <SubmissionStatusBadge status={status} />
                        {s.mode === "run" && <Badge tone="slate">Run</Badge>}
                        <span className="font-medium tabular-nums">{score} pts</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.submittedAt).toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
