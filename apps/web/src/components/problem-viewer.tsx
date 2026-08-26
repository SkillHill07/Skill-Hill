"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Clock3, Code2, HardDrive, ListChecks, TriangleAlert } from "lucide-react"
import { api } from "@/lib/api"
import { Badge, Button, Card, CardContent, ErrorBanner, Skeleton } from "./ui"
import { inr } from "@/lib/format"

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
  contestId: {
    _id: string
    title: string
    slug: string
    status: string
    type: string
    entryFee: number
  } | null
}

const difficultyTone: Record<string, "green" | "amber" | "red"> = {
  easy: "green",
  medium: "amber",
  hard: "red",
}

export function ProblemViewer({ problemId }: { problemId: string }) {
  const { data: problem, isLoading, error } = useQuery({
    queryKey: ["problem", problemId],
    queryFn: () => api.get<PracticeProblemDetail>(`/problems/${problemId}`),
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-4 h-40" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link
          href="/problems"
          className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline dark:text-orange-400"
        >
          <ArrowLeft className="h-4 w-4" /> Back to library
        </Link>
        <div className="mt-6">
          <ErrorBanner message="This problem isn't available for practice right now." />
        </div>
      </div>
    )
  }

  if (!problem) return null

  // API may omit these fields entirely (e.g. MCQs) — never assume presence.
  const templates = Object.entries(problem.solutionTemplate ?? {}).filter(([, code]) => code)
  const languageSupport = problem.languageSupport ?? []
  const firstTemplateLang = languageSupport[0] ?? templates[0]?.[0]
  const firstTemplate = firstTemplateLang ? templates.find(([lang]) => lang === firstTemplateLang) ?? templates[0] : templates[0]

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href="/problems"
        className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline dark:text-orange-400"
      >
        <ArrowLeft className="h-4 w-4" /> Back to library
      </Link>

      {/* Header */}
      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={difficultyTone[problem.difficulty] ?? "neutral"}>{problem.difficulty}</Badge>
          <Badge tone="teal">{problem.type === "mcq" ? "MCQ" : "Coding"}</Badge>
          <Badge tone="slate">{problem.points} pts</Badge>
          {problem.type === "coding" && (
            <>
              <Badge tone="blue">
                <Clock3 className="h-3 w-3" /> {problem.timeLimit / 1000}s
              </Badge>
              <Badge tone="blue">
                <HardDrive className="h-3 w-3" /> {problem.memoryLimit} MB
              </Badge>
            </>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{problem.title}</h1>
        {problem.contestId && (
          <p className="mt-1 text-sm text-muted-foreground">
            From contest{" "}
            <Link
              href={`/contests/${problem.contestId._id}`}
              className="font-medium text-orange-600 hover:underline dark:text-orange-400"
            >
              {problem.contestId.title}
            </Link>
            {problem.contestId.type === "paid" && ` · ${inr(problem.contestId.entryFee)} entry`}
          </p>
        )}
      </div>

      {/* Statement */}
      <Card className="mt-6">
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Statement
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{problem.description}</p>
        </CardContent>
      </Card>

      {/* Public examples */}
      {problem.type === "coding" && problem.testCases.length > 0 && (
        <Card className="mt-4">
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Examples
            </h2>
            <div className="mt-3 flex flex-col gap-3">
              {problem.testCases.map((tc, i) => (
                <div key={i} className="overflow-hidden rounded-lg border border-border">
                  <div className="border-b border-border bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground">
                    Example {i + 1}
                    {tc.description ? ` — ${tc.description}` : ""}
                  </div>
                  <div className="grid gap-3 p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Input</p>
                      <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 px-3 py-2 text-xs text-slate-100">
                        {tc.input}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Output</p>
                      <pre className="mt-1 overflow-x-auto rounded-md bg-slate-950 px-3 py-2 text-xs text-slate-100">
                        {tc.expectedOutput}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MCQ options */}
      {problem.type === "mcq" && problem.options.length > 0 && (
        <Card className="mt-4">
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Options
            </h2>
            <ol className="mt-3 flex flex-col gap-2">
              {problem.options.map((opt, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-border px-4 py-3 text-sm"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Starter template */}
      {problem.type === "coding" && firstTemplate && (
        <Card className="mt-4">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Code2 className="h-4 w-4" /> Starter template
              </h2>
              {templates.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  Available in: {languageSupport.join(", ")}
                </p>
              )}
            </div>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 px-4 py-3 text-sm text-slate-100">
              <code>{firstTemplate[1]}</code>
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Practice note */}
      <Card className="mt-4">
        <CardContent className="flex items-start gap-3 p-6">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm text-muted-foreground">
            This is a practice view. In a live contest you would submit solutions
            here, get judged against hidden test cases, and earn points on the
            leaderboard.
          </p>
          <Button size="sm" className="ml-auto shrink-0" onClick={() => (window.location.href = "/contests")}>
            Find a contest
          </Button>
        </CardContent>
      </Card>

      {/* Language chips */}
      {languageSupport.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <ListChecks className="h-4 w-4 text-muted-foreground" aria-hidden />
          {languageSupport.map((lang) => (
            <span
              key={lang}
              className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {lang}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
