"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight } from "lucide-react"
import { api } from "@/lib/api"
import { Card, CardContent, EmptyState, PageHeader, Skeleton, StatCard } from "@/components/ui"
import { ContestStatusBadge } from "@/components/status-badge"
import { formatDate, inr } from "@/lib/format"

interface ContestsResponse {
  contests: Array<{
    contest: {
      _id: string
      title: string
      type: string
      entryFee: number
      prizePool: number
      status: string
      startTime: string
    }
    participantCount: number
  }>
  total: number
}

interface PendingKyc {
  total: number
  users: unknown[]
}

export default function AdminDashboardPage() {
  const { data: drafts, isLoading: draftsLoading } = useQuery({
    queryKey: ["admin-contests", "draft"],
    queryFn: () => api.get<ContestsResponse>("/contests?status=draft&limit=5"),
  })

  const { data: active, isLoading: activeLoading } = useQuery({
    queryKey: ["admin-contests", "active"],
    queryFn: () => api.get<ContestsResponse>("/contests?status=active&limit=5"),
  })

  const { data: kyc } = useQuery({
    queryKey: ["admin-kyc-pending"],
    queryFn: () => api.get<PendingKyc>("/admin/kyc/pending"),
    retry: false,
  })

  const loading = draftsLoading || activeLoading

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform overview and quick actions" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending KYC" value={kyc?.total ?? "—"} sub={kyc && kyc.total > 0 ? "Waiting for review" : "All clear"} />
        <StatCard label="Active contests" value={active?.total ?? "—"} />
        <StatCard label="Draft contests" value={drafts?.total ?? "—"} />
      </div>

      {loading ? (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {/* Active contests */}
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Live contests</h2>
                <Link href="/admin/contests?status=active" className="flex items-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {active && active.contests.length > 0 ? (
                <ul className="divide-y divide-border">
                  {active.contests.map(({ contest, participantCount }) => (
                    <li key={contest._id}>
                      <Link href={`/admin/contests/${contest._id}`} className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{contest.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {participantCount} joined · ends {formatDate(contest.startTime)}
                          </p>
                        </div>
                        <ContestStatusBadge status={contest.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No live contests" />
              )}
            </CardContent>
          </Card>

          {/* Drafts */}
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Draft contests</h2>
                <Link href="/admin/contests/new" className="flex items-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                  Create new <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {drafts && drafts.contests.length > 0 ? (
                <ul className="divide-y divide-border">
                  {drafts.contests.map(({ contest }) => (
                    <li key={contest._id}>
                      <Link href={`/admin/contests/${contest._id}`} className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{contest.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {contest.type === "paid" ? `${inr(contest.entryFee)} entry` : "Free"} · {inr(contest.prizePool)} pool
                          </p>
                        </div>
                        <ContestStatusBadge status={contest.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No drafts" hint="Create a contest to get started." />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
