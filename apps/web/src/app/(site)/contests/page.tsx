"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
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

const TABS = [
  { key: "active", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "settled", label: "Past" },
] as const

export default function ContestsPage() {
  const [status, setStatus] = useState<string>("active")
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["contests", status, page],
    queryFn: () =>
      api.get<ContestsResponse>(`/contests?status=${status}&page=${page}&limit=12`),
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
      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setStatus(tab.key)
              setPage(1)
            }}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              status === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
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
          title={status === "active" ? "No live contests right now" : "Nothing here yet"}
          hint={status === "active" ? "Check back soon — new contests are added regularly." : undefined}
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
