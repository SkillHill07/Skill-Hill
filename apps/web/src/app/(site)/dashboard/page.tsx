"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CheckCircle2, Clock, LayoutDashboard, Trophy, Wallet, XCircle } from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, inr } from "@/lib/format"
import { Card, CardContent, EmptyState, ErrorBanner, Skeleton, StatCard, Badge } from "@/components/ui"
import { RequireAuth } from "@/components/require-auth"

interface Balance {
  balance: number
  locked: number
  available: number
  totalDeposited: number
  totalWon: number
  totalSpentOnFees: number
}

interface Transaction {
  _id: string
  type: string
  amount: number
  status: string
  description?: string
  createdAt: string
}

interface TransactionsResponse {
  transactions: Transaction[]
}

interface Participation {
  _id: string
  contest: { title: string; slug: string } | null
  totalScore: number
  rank: number | null
  status: string
  joinedAt: string
}

function DashboardInner() {
  const { data: me, isLoading: meLoading, isError: meError } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<{ firstName: string }>( "/auth/me"),
    retry: false,
  })

  const { data: balance, isLoading: balanceLoading, isError: balanceError } = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: () => api.get<Balance>("/wallet/balance"),
    retry: false,
  })

  const { data: txns } = useQuery({
    queryKey: ["wallet-transactions", 5],
    queryFn: () => api.get<TransactionsResponse>("/wallet/transactions?limit=5"),
    retry: false,
  })

  const { data: participations } = useQuery({
    queryKey: ["my-participations"],
    queryFn: () => api.get<Participation[]>("/contests/me/participations?limit=5"),
    retry: false,
  })

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6 text-orange-500" aria-hidden />
        <h1 className="text-2xl font-bold tracking-tight">
          {me ? `Welcome back, ${me.firstName}` : "Dashboard"}
        </h1>
      </div>

      {meError || balanceError ? (
        <ErrorBanner message="Some of your dashboard data couldn't load. Refresh the page to try again." />
      ) : null}

      {/* Stats */}
      {meLoading || balanceLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : balance ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Available balance" value={inr(balance.available)} />
          <StatCard label="Locked" value={inr(balance.locked)} />
          <StatCard label="Lifetime deposits" value={inr(balance.totalDeposited)} />
          <StatCard
            label="Total won"
            value={inr(balance.totalWon)}
            sub={balance.totalSpentOnFees > 0 ? `Fees paid: ${inr(balance.totalSpentOnFees)}` : undefined}
          />
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <Wallet className="h-4 w-4 text-orange-500" aria-hidden /> Recent transactions
              </h2>
              <Link
                href="/wallet"
                className="flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline dark:text-orange-400"
              >
                View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            {txns && txns.transactions.length > 0 ? (
              <ul className="divide-y divide-border">
                {txns.transactions.map((t) => (
                  <li key={t._id} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      {t.amount > 0 ? (
                        <ArrowDownLeft className="h-4 w-4 text-emerald-500" aria-hidden />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-red-500" aria-hidden />
                      )}
                      <div>
                        <span className="font-medium capitalize">{t.type.replace(/_/g, " ")}</span>
                        {t.description && (
                          <p className="text-xs text-muted-foreground">{t.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</span>
                      <span className="flex items-center gap-1">
                        <Badge tone={t.status === "completed" ? "green" : t.status === "pending" ? "amber" : "neutral"}>
                          {t.status}
                        </Badge>
                        <span className={`font-semibold tabular-nums ${t.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                          {t.amount > 0 ? "+" : ""}{inr(Math.abs(t.amount))}
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No transactions yet" hint="Deposit funds or join a contest to get started." />
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <h2 className="mb-1 font-semibold">Quick actions</h2>
            <Link href="/contests" className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-accent">
              Browse contests <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/wallet" className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-accent">
              Add funds <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/problems" className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-accent">
              Practice problems <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/prizes" className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-accent">
              My prizes <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/profile" className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-accent">
              Profile & KYC <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent contests */}
      <div className="mt-6">
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <Trophy className="h-4 w-4 text-amber-500" aria-hidden /> Recent contests
              </h2>
            </div>
            {participations && participations.length > 0 ? (
              <ul className="divide-y divide-border">
                {participations.map((p) => (
                  <li key={p._id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.contest?.title ?? "Contest"}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(p.joinedAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                      ) : p.status === "timedout" ? (
                        <Clock className="h-4 w-4 text-amber-500" aria-hidden />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" aria-hidden />
                      )}
                      {p.rank && <Badge tone="amber">#{p.rank}</Badge>}
                      <span className="text-sm font-semibold tabular-nums">{p.totalScore} pts</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No contests yet" hint="Join a contest to start competing for prizes." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardInner />
    </RequireAuth>
  )
}
