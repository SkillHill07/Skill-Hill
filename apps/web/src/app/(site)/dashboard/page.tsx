"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, LayoutDashboard, Trophy, Wallet } from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, inr } from "@/lib/format"
import { Card, CardContent, EmptyState, ErrorBanner, Skeleton, StatCard } from "@/components/ui"
import { RequireAuth } from "@/components/require-auth"

interface Balance {
  balance: number
  locked: number
  available: number
  totalDeposited: number
  totalWon: number
}

interface Transaction {
  _id: string
  type: string
  amount: number
  status: string
  createdAt: string
}

interface TransactionsResponse {
  transactions: Transaction[]
}

function DashboardInner() {
  const {
    data: me,
    isLoading: meLoading,
    isError: meError,
  } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<{ firstName: string }>("/auth/me"),
    retry: false,
  })

  const {
    data: balance,
    isLoading: balanceLoading,
    isError: balanceError,
  } = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: () => api.get<Balance>("/wallet/balance"),
    retry: false,
  })

  const { data: txns } = useQuery({
    queryKey: ["wallet-transactions", 5],
    queryFn: () => api.get<TransactionsResponse>("/wallet/transactions?limit=5"),
    retry: false,
  })

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6 text-orange-500" aria-hidden />
        <h1 className="text-2xl font-bold tracking-tight">
          {me ? `Welcome, ${me.firstName}` : "Dashboard"}
        </h1>
      </div>

      {meError || balanceError ? (
        <ErrorBanner message="Some of your dashboard data couldn't load. Refresh the page to try again." />
      ) : null}

      {meLoading || balanceLoading ? (
        <Skeleton className="h-28" />
      ) : balance ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Available balance" value={inr(balance.available)} />
          <StatCard label="Locked" value={inr(balance.locked)} />
          <StatCard label="Lifetime deposits" value={inr(balance.totalDeposited)} />
          <StatCard label="Total won" value={inr(balance.totalWon)} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <Wallet className="h-4 w-4 text-orange-500" aria-hidden /> Recent activity
              </h2>
              <Link
                href="/wallet"
                className="flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline dark:text-orange-400"
              >
                Wallet <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            {txns && txns.transactions.length > 0 ? (
              <ul className="divide-y divide-border">
                {txns.transactions.map((t) => (
                  <li key={t._id} className="flex items-center justify-between py-2 text-sm">
                    <span className="capitalize text-muted-foreground">
                      {t.type.replace(/_/g, " ")}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</span>
                      <span
                        className={`font-semibold tabular-nums ${
                          t.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : ""
                        }`}
                      >
                        {t.amount > 0 ? "+" : ""}
                        {inr(Math.abs(t.amount))}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No activity yet"
                hint="Join a contest or add money to get started."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <Trophy className="h-4 w-4 text-amber-500" aria-hidden /> Quick links
            </h2>
            <div className="flex flex-col gap-2">
              <Link href="/contests" className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-accent">
                Browse contests <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/prizes" className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-accent">
                My prizes <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/payments" className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-accent">
                Payment history <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/profile" className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-accent">
                Profile &amp; KYC <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
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
