"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Code2, ListChecks, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { api } from "@/lib/api"
import { Badge, Button, Card, CardContent, EmptyState, Input, Skeleton } from "./ui"
import { SectionHeading } from "./marketing"
import { inr } from "@/lib/format"

export interface PracticeProblem {
  _id: string
  title: string
  slug: string
  difficulty: "easy" | "medium" | "hard"
  type: "coding" | "mcq"
  points: number
  languageSupport: string[]
  timeLimit: number
  memoryLimit: number
  contestId: {
    _id: string
    title: string
    slug: string
    status: string
    type: string
    entryFee: number
  } | null
}

interface ListResponse {
  problems: PracticeProblem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const difficultyTone: Record<string, "green" | "amber" | "red"> = {
  easy: "green",
  medium: "amber",
  hard: "red",
}

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  cpp: "C++",
  c: "C",
  go: "Go",
  rust: "Rust",
}

export function ProblemsExplorer({
  initial,
}: {
  initial: { difficulty: string; type: string; search: string }
}) {
  const [search, setSearch] = useState(initial.search)
  const [difficulty, setDifficulty] = useState(initial.difficulty)
  const [type, setType] = useState(initial.type)
  const [page, setPage] = useState(1)

  const params = useMemo(() => {
    const p = new URLSearchParams()
    if (search) p.set("search", search)
    if (difficulty) p.set("difficulty", difficulty)
    if (type) p.set("type", type)
    p.set("page", String(page))
    p.set("limit", "12")
    return p.toString()
  }, [search, difficulty, type, page])

  const { data, isLoading } = useQuery({
    queryKey: ["problems", params],
    queryFn: () => api.get<ListResponse>(`/problems?${params}`),
  })

  function changePage(next: number) {
    setPage(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeading
        align="left"
        eyebrow="Practice library"
        title="Solve problems, for free"
        description="Every problem here comes from a live or settled contest. No entry fee — just pick a problem and go."
      />

      {/* Filters */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search problems…"
            className="pl-9"
            aria-label="Search problems"
          />
        </div>
        <div className="flex gap-2">
          {["easy", "medium", "hard"].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={difficulty === d ? "primary" : "outline"}
              onClick={() => {
                setDifficulty(difficulty === d ? "" : d)
                setPage(1)
              }}
            >
              {d[0].toUpperCase() + d.slice(1)}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {["coding", "mcq"].map((t) => (
            <Button
              key={t}
              size="sm"
              variant={type === t ? "primary" : "outline"}
              onClick={() => {
                setType(type === t ? "" : t)
                setPage(1)
              }}
            >
              {t === "coding" ? "Coding" : "MCQ"}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : data && data.problems.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.problems.map((p) => (
            <Link key={p._id} href={`/problems/${p._id}`} className="group block">
              <Card className="h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-indigo-300 group-hover:shadow-md dark:group-hover:border-indigo-500/50">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={difficultyTone[p.difficulty] ?? "neutral"}>{p.difficulty}</Badge>
                    <div className="flex items-center gap-2">
                      {p.type === "mcq" ? (
                        <Badge tone="blue">
                          <ListChecks className="h-3 w-3" /> MCQ
                        </Badge>
                      ) : (
                        <Badge tone="violet">
                          <Code2 className="h-3 w-3" /> Coding
                        </Badge>
                      )}
                      <Badge tone="slate">{p.points} pts</Badge>
                    </div>
                  </div>
                  <h3 className="text-base font-semibold leading-snug transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    {p.title}
                  </h3>
                  {p.contestId && (
                    <p className="text-xs text-muted-foreground">
                      From “{p.contestId.title}”
                      {p.contestId.type === "paid" ? ` · ${inr(p.contestId.entryFee)} entry` : ""}
                    </p>
                  )}
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                    {p.languageSupport.slice(0, 4).map((lang) => (
                      <span
                        key={lang}
                        className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {LANGUAGE_LABELS[lang] ?? lang}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            title="No problems match your filters"
            hint="Try clearing the search or switching the difficulty."
          />
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages} · {data.total} problems
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => changePage(data.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages}
              onClick={() => changePage(data.page + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {data && data.total === 0 && !isLoading && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          New problems appear here as soon as contests go live.
        </p>
      )}
    </div>
  )
}
