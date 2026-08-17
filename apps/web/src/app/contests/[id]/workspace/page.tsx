"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, ChevronLeft, Code2, Play, XCircle } from "lucide-react"
import { api } from "@/lib/api"
import { getSocket, type SubmissionStatusEvent } from "@/lib/socket"
import { Badge, Button, Card, CardContent, EmptyState, ErrorBanner, Skeleton, Textarea } from "@/components/ui"
import { SubmissionStatusBadge } from "@/components/status-badge"
import { cn } from "@skillcontest/ui"
import { formatDate } from "@/lib/format"

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

interface Submission {
  _id: string
  problemId: string
  language: string | null
  status: string
  totalScore: number
  publicPassed: number
  publicTotal: number
  hiddenPassed: number
  hiddenTotal: number
  executionTime: number
  memoryUsed: number
  compilerOutput: string | null
  submittedAt: string
}

const STARTERS: Record<string, string> = {
  javascript: `// Your solution\nfunction solve(input) {\n  return input;\n}\n`,
  python: `# Your solution\ndef solve(input):\n    return input\n`,
  golang: `package main\n\nfunc Solve(input string) string {\n    return input\n}\n`,
  cpp: `#include <iostream>\n\nint main() {\n    std::cout << "hello";\n    return 0;\n}\n`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("hello");\n    }\n}\n`,
}

export default function WorkspacePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const contestId = params.id

  const [activeProblem, setActiveProblem] = useState<string | null>(null)
  const [language, setLanguage] = useState<string>("javascript")
  const [code, setCode] = useState("")
  const [mcqChoice, setMcqChoice] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
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
  })

  const { data: languages } = useQuery({
    queryKey: ["languages"],
    queryFn: () => api.get<Language[]>("/languages"),
    retry: false,
  })

  const { data: submissions, refetch: refetchSubmissions } = useQuery({
    queryKey: ["submissions", contestId],
    queryFn: () => api.get<Submission[]>(`/contests/${contestId}/submissions`),
  })

  const activeProblemData = problems?.find((p) => p._id === activeProblem) ?? problems?.[0]

  // Load solutions from history once problems load
  useEffect(() => {
    if (!activeProblemData) return
    const template = activeProblemData.solutionTemplate?.[language]
    if (template) {
      setCode(template)
    } else {
      setCode(STARTERS[language] ?? STARTERS.javascript)
    }
  }, [activeProblemData?._id, language])

  // Socket — live submission status. The `live` map is keyed by problemId so
  // the status line always reflects the LATEST event for the active problem;
  // the per-submission history below merges live events by submissionId.
  useEffect(() => {
    const socket = getSocket()
    const handler = (event: SubmissionStatusEvent) => {
      if (event.contestId !== contestId) return
      setLive((prev) => ({ ...prev, [event.problemId]: event }))
      if (event.status === "accepted" || event.status === "rejected" || event.status === "error" || event.status === "timeout") {
        refetchSubmissions()
      }
    }
    socket.on("submission:queued", handler)
    socket.on("submission:running", handler)
    socket.on("submission:completed", handler)
    return () => {
      socket.off("submission:queued", handler)
      socket.off("submission:running", handler)
      socket.off("submission:completed", handler)
    }
  }, [contestId, refetchSubmissions])

  const refreshSubmissions = useCallback(() => {
    refetchSubmissions()
  }, [refetchSubmissions])

  const problemLanguages = useMemo(() => {
    if (!activeProblemData || activeProblemData.type === "mcq") return []
    const supported = new Set(activeProblemData.languageSupport ?? [])
    return (languages ?? []).filter((l) => supported.has(l.key) || supported.size === 0)
  }, [activeProblemData, languages])

  async function submit() {
    if (!activeProblemData) return
    setSubmitting(true)
    setError(null)
    try {
      const payload =
        activeProblemData.type === "mcq"
          ? { problemId: activeProblemData._id, code: mcqChoice?.toString() ?? "" }
          : { problemId: activeProblemData._id, language, code }
      await api.post(`/contests/${contestId}/submissions`, payload)
      refreshSubmissions()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (contestLoading || problemsLoading) {
    return <div className="mx-auto max-w-6xl px-4 py-10"><Skeleton className="h-96" /></div>
  }
  if (!contest || !problems || problems.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <EmptyState title="No problems available" hint="Problems are published when the contest goes live." />
      </div>
    )
  }
  if (contest.status !== "active") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <EmptyState title="Contest is not live" hint="The workspace opens when the contest is active." />
      </div>
    )
  }

  const pb = activeProblemData
  if (!pb) return null
  const liveForPb = live[pb._id]
  const liveEventBySubmission = new Map(
    Object.entries(live).flatMap(([, ev]) => (ev ? [[ev.submissionId, ev]] : [])),
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <button
        onClick={() => router.push(`/contests/${contestId}`)}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {contest.title}
      </button>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Problem list */}
        <Card className="h-fit">
          <CardContent className="p-3">
            <p className="px-2 pb-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Problems
            </p>
            <ul className="flex flex-col gap-1 lg:gap-0.5">
              {problems.map((p, i) => (
                <li key={p._id}>
                  <button
                    onClick={() => setActiveProblem(p._id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition-colors",
                      p._id === pb._id ? "bg-indigo-600/10 font-medium text-indigo-600 dark:text-indigo-400" : "hover:bg-accent",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{i + 1}.</span>
                      {p.title}
                    </span>
                    <Badge tone={p.difficulty === "easy" ? "green" : p.difficulty === "medium" ? "amber" : "red"} className="capitalize">
                      {p.points}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Problem panel */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={pb.type === "mcq" ? "violet" : "blue"}>{pb.type === "mcq" ? "MCQ" : "Coding"}</Badge>
                <Badge tone={pb.difficulty === "easy" ? "green" : pb.difficulty === "medium" ? "amber" : "red"} className="capitalize">
                  {pb.difficulty}
                </Badge>
                <span className="text-sm text-muted-foreground">{pb.points} points</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight">{pb.title}</h1>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{pb.description}</p>
              {pb.imageUrls.length > 0 && (
                <div className="grid gap-2">
                  {pb.imageUrls.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={url} alt={`${pb.title} diagram ${i + 1}`} className="max-w-full rounded-lg border border-border" />
                  ))}
                </div>
              )}

              {/* Public examples */}
              {pb.type === "coding" && pb.testCases.length > 0 && (
                <div className="mt-1 flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Examples</p>
                  {pb.testCases.map((tc, i) => (
                    <div key={i} className="grid gap-1 rounded-lg bg-muted/60 p-3 text-xs">
                      <p><span className="font-medium">Input:</span> <code className="whitespace-pre-wrap">{tc.input}</code></p>
                      <p><span className="font-medium">Output:</span> <code className="whitespace-pre-wrap">{tc.expectedOutput}</code></p>
                    </div>
                  ))}
                </div>
              )}

              {/* MCQ options */}
              {pb.type === "mcq" && (
                <div className="mt-2 flex flex-col gap-2">
                  {pb.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setMcqChoice(i)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                        mcqChoice === i
                          ? "border-indigo-500 bg-indigo-600/10 font-medium"
                          : "border-border hover:bg-accent",
                      )}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold">
                        {String.fromCharCode(65 + i)}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Editor / submit */}
          {pb.type === "coding" ? (
            <Card>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-indigo-500" />
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="h-9 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      {problemLanguages.length > 0
                        ? problemLanguages.map((l) => (
                            <option key={l.key} value={l.key}>{l.name} {l.version}</option>
                          ))
                        : (languages ?? []).map((l) => (
                            <option key={l.key} value={l.key}>{l.name} {l.version}</option>
                          ))}
                    </select>
                  </div>
                  <Button onClick={submit} loading={submitting} disabled={!code.trim()}>
                    <Play className="h-4 w-4" /> Submit
                  </Button>
                </div>
                <Textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  spellCheck={false}
                  className="min-h-[360px] font-mono text-[13px] leading-relaxed"
                  placeholder="Write your solution here…"
                />
                {error && <ErrorBanner message={error} />}
                {liveForPb && (
                  <div className="flex items-center gap-2 text-sm">
                    {liveForPb.status === "accepted" ? (
                      <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" /> Accepted — {liveForPb.totalScore ?? 0} pts
                      </span>
                    ) : liveForPb.status === "rejected" || liveForPb.status === "error" || liveForPb.status === "timeout" ? (
                      <span className="flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
                        <XCircle className="h-4 w-4" /> {liveForPb.status} — {liveForPb.publicPassed ?? 0}/{liveForPb.publicTotal ?? 0} public passed
                      </span>
                    ) : (
                      <SubmissionStatusBadge status={liveForPb.status} />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col gap-3 p-5">
                <Button onClick={submit} loading={submitting} disabled={mcqChoice === null}>
                  Submit answer
                </Button>
                {error && <ErrorBanner message={error} />}
              </CardContent>
            </Card>
          )}

          {/* Submission history */}
          {submissions && submissions.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h2 className="mb-3 font-semibold">My submissions</h2>
                <div className="flex flex-col gap-2">
                  {submissions.map((s) => {
                    const lv = liveEventBySubmission.get(s._id)
                    const status = lv?.status ?? s.status
                    const score = lv?.totalScore ?? s.totalScore
                    return (
                      <div key={s._id} className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5 text-sm">
                        <div className="flex items-center gap-3">
                          <SubmissionStatusBadge status={status} />
                          <span className="font-medium">{score} pts</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(s.submittedAt)}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
