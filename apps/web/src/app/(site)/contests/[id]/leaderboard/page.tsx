"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Trophy } from "lucide-react"
import { api } from "@/lib/api"
import { formatTime } from "@/lib/format"
import { Card, CardContent, EmptyState, Skeleton } from "@/components/ui"
import { cn } from "@skillcontest/ui"

interface LeaderboardResponse {
  contestId: string
  returned: number
  entries: Array<{
    rank: number
    userId: string
    totalScore: number
    submittedAt: string | null
    user: { firstName: string; lastName: string; avatarUrl: string | null } | null
  }>
}

const MEDAL = ["bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400", "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300", "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400"]

export default function LeaderboardPage() {
  const params = useParams<{ id: string }>()
  const { data, isLoading, isError } = useQuery({
    queryKey: ["leaderboard", params.id],
    queryFn: () => api.get<LeaderboardResponse>(`/contests/${params.id}/leaderboard?limit=100`),
    retry: false,
  })

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href={`/contests/${params.id}`} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
        ← Back to contest
      </Link>
      <div className="mb-6 mt-4 flex items-center gap-2">
        <Trophy className="h-6 w-6 text-amber-500" aria-hidden />
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
      </div>

      {isLoading ? (
        <Skeleton className="h-72" />
      ) : isError || !data ? (
        <EmptyState title="Leaderboard unavailable" hint="This contest may be hidden or not accepting submissions yet." />
      ) : data.entries.length === 0 ? (
        <EmptyState title="No submissions yet" hint="Be the first to submit a solution!" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {data.entries.map((e) => (
                <li key={e.userId} className="flex items-center gap-4 px-5 py-3">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      e.rank <= 3 ? MEDAL[e.rank - 1] : "bg-muted text-muted-foreground",
                    )}
                  >
                    {e.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {e.user ? `${e.user.firstName} ${e.user.lastName}` : "Deleted user"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.submittedAt ? `Submitted ${formatTime(e.submittedAt)}` : "—"}
                    </p>
                  </div>
                  <span className="font-bold tabular-nums">{e.totalScore}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
