"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Code2, ListChecks } from "lucide-react"
import { api } from "@/lib/api"
import { ContestCard, type ContestCardData } from "@/components/contest-card"
import { Button, EmptyState, Skeleton } from "@/components/ui"
import { cn } from "@skillcontest/ui"

interface ContestsResponse {
  contests: Array<{ contest: ContestCardData; participantCount: number }>
  total: number
  page: number
  totalPages: number
}

const STATUS_TABS = [
  { key: "active", label: "Live" },
  { key: "always_open", label: "Always Open" },
  { key: "upcoming", label: "Upcoming" },
  { key: "settled", label: "Past" },
] as const

const TYPE_FILTERS = [
  { key: "", label: "All", icon: null },
  { key: "coding", label: "Coding", icon: <Code2 className="h-3.5 w-3.5" /> },
  { key: "mcq", label: "MCQ", icon: <ListChecks className="h-3.5 w-3.5" /> },
] as const

export default function ContestsPage() {
  const [status, setStatus] = useState<string>("active")
  const [problemType, setProblemType] = useState<string>("")
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["contests", status, problemType, page],
    queryFn: () => {
      const params = new URLSearchParams({ status, page: String(page), limit: "12" })
      if (problemType) params.set("problemType", problemType)
      return api.get<ContestsResponse>(`/contests?${params}`)
    },
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Contests</h1>
        <p className="mt-1 text-muted-foreground">
          Compete in timed coding challenges and win real prize money.
        </p>
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setStatus(tab.key)
              setPage(1)
            }}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
              status === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Problem type filter */}
      <div className="mb-6 flex items-center gap-2">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setProblemType(f.key)
              setPage(1)
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              problemType === f.key
                ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400"
                : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-orange-300",
            )}
          >
            {f.icon}
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : isError || !data ? (
        <EmptyState title="Could not load contests" hint="The API may be offline — try again later." />
      ) : data.contests.length === 0 ? (
        <EmptyState
          title={
            status === "active" ? "No live contests right now"
            : status === "always_open" ? "No always-open contests yet"
            : "Nothing here yet"
          }
          hint={
            status === "active" ? "Check back soon — new contests are added regularly."
            : status === "always_open" ? "Free practice contests that never close will appear here."
            : undefined
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.contests.map(({ contest, participantCount }) => (
              <ContestCard key={contest._id} contest={contest} participants={participantCount} />
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
