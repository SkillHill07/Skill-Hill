"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Trophy } from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, inr } from "@/lib/format"
import { PrizeStatusBadge } from "@/components/status-badge"
import { Card, CardContent, EmptyState, Skeleton } from "@/components/ui"

interface Prize {
  _id: string
  rank: number
  prizeAmount: number
  status: string
  contest: { title: string; slug: string } | null
  contestId: string
  createdAt: string
}

interface PrizesResponse {
  prizes: Prize[]
  total: number
  page: number
  totalPages: number
}

export default function PrizesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["prizes"],
    queryFn: () => api.get<PrizesResponse>("/prizes?limit=50"),
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <Trophy className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold tracking-tight">My prizes</h1>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : isError || !data || data.prizes.length === 0 ? (
        <EmptyState title="No prizes yet" hint="Finish in the top ranks of a contest to win prize money." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {data.prizes.map((p) => (
                <li key={p._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    {p.contest ? (
                      <Link href={`/contests/${p.contestId}`} className="font-medium hover:text-indigo-600 dark:hover:text-indigo-400">
                        {p.contest.title}
                      </Link>
                    ) : (
                      <p className="font-medium">Contest</p>
                    )}
                    <p className="text-xs text-muted-foreground">Rank #{p.rank} · {formatDate(p.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PrizeStatusBadge status={p.status} />
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{inr(p.prizeAmount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
