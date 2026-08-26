"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { ArrowRight, Clock, ListChecks, Trophy, Users } from "lucide-react"
import { api, getTurnstileToken } from "@/lib/api"
import { formatDuration, formatDate, inr } from "@/lib/format"
import { ContestStatusBadge } from "@/components/status-badge"
import { Badge, Button, Card, CardContent, EmptyState, ErrorBanner, Skeleton } from "@/components/ui"
import { Turnstile } from "@/components/turnstile"

interface Contest {
  _id: string
  title: string
  slug: string
  description: string
  type: string
  entryFee: number
  prizePool: number
  maxParticipants: number | null
  status: string
  startTime: string
  endTime: string
  rules: string
  problemIds: Problem[]
}

interface Problem {
  _id: string
  title: string
  slug: string
  type: string
  difficulty: string
  points: number
}

interface PrizesResponse {
  type: string
  participantCount: number
  pool: number
  netPool: number
  platformFeeRate: number
  structure: Array<{ rank: number; share: number; amount: number }>
  winners: Array<{ rank: number; prizeAmount: number; status: string; user: { firstName: string; lastName: string } | null }>
}

function Countdown({ end }: { end: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const remaining = Math.max(0, Math.floor((new Date(end).getTime() - now) / 1000))
  return (
    <span className="tabular-nums" aria-live="off">
      {remaining > 0 ? formatDuration(remaining) : "Ended"}
    </span>
  )
}

export default function ContestDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const id = params.id
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState(() => getTurnstileToken())

  const { data: contest, isLoading, isError } = useQuery({
    queryKey: ["contest", id],
    queryFn: () => api.get<Contest>(`/contests/${id}`),
    retry: false,
  })

  const { data: prizes } = useQuery({
    queryKey: ["contest-prizes", id],
    queryFn: () => api.get<PrizesResponse>(`/contests/${id}/prizes`),
    retry: false,
  })

  async function join() {
    if (!turnstileToken) return
    setJoining(true)
    setError(null)
    try {
      await api.post(`/contests/${id}/join`, { turnstileToken })
      // Refresh contest + prizes data instead of a full page reload.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contest", id] }),
        queryClient.invalidateQueries({ queryKey: ["contest-prizes", id] }),
      ])
      router.push(`/contests/${id}/workspace`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setJoining(false)
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <Skeleton className="h-64" />
      </main>
    )
  }
  if (isError || !contest) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <EmptyState title="Contest not found" hint="It may be a draft (hidden from the public) or no longer exists." />
      </main>
    )
  }

  const isLive = contest.status === "active"
  const isUpcoming = contest.status === "active" && new Date(contest.startTime) > new Date()
  const canEnter = isLive || isUpcoming

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <Link href="/contests" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
        ← All contests
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column */}
        <div className="flex flex-col gap-6 min-w-0">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ContestStatusBadge status={contest.status} />
              <Badge tone={contest.type === "paid" ? "teal" : "slate"}>
                {contest.type === "paid" ? "Paid contest" : "Free contest"}
              </Badge>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">{contest.title}</h1>
            {contest.description && (
              <p className="mt-2 whitespace-pre-line text-muted-foreground">{contest.description}</p>
            )}
          </div>

          {/* Problems */}
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-orange-500" aria-hidden />
                <h2 className="font-semibold">Problems ({contest.problemIds.length})</h2>
              </div>
              {contest.problemIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No problems published yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {contest.problemIds.map((p) => (
                    <li key={p._id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-600/10 text-sm font-semibold text-orange-600 dark:text-orange-400">
                          {p.points}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.title}</p>
                          <p className="text-xs capitalize text-muted-foreground">
                            {p.type === "mcq" ? "Multiple choice" : "Coding"} · {p.difficulty}
                          </p>
                        </div>
                      </div>
                      {isLive && (
                        <Link
                          href={`/contests/${id}/workspace`}
                          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          Solve <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Rules */}
          {contest.rules && (
            <Card>
              <CardContent className="p-5">
                <h2 className="mb-2 font-semibold">Rules</h2>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{contest.rules}</p>
              </CardContent>
            </Card>
          )}

          {/* Prizes */}
          {prizes && (
            <Card>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
                  <h2 className="font-semibold">Prize breakdown</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Total pool</p>
                    <p className="text-xl font-bold">{inr(prizes.pool)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Net pool (after fees)</p>
                    <p className="text-xl font-bold">{inr(prizes.netPool)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Participants</p>
                    <p className="text-xl font-bold">{prizes.participantCount}</p>
                  </div>
                </div>
                {prizes.winners.length > 0 ? (
                  <ul className="mt-4 divide-y divide-border">
                    {prizes.winners.map((w) => (
                      <li key={w.rank} className="flex items-center justify-between py-2 text-sm">
                        <span className="font-medium">
                          #{w.rank} {w.user ? `${w.user.firstName} ${w.user.lastName}` : "—"}
                        </span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {inr(w.prizeAmount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-4 grid gap-2">
                    {prizes.structure.map((s) => (
                      <div key={s.rank} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Rank #{s.rank} · {(s.share * 100).toFixed(0)}%</span>
                        <span className="font-medium tabular-nums">{inr(s.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Prize pool</span>
                <span className="font-semibold tabular-nums">{inr(contest.prizePool)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Entry fee</span>
                <span className="font-semibold tabular-nums">
                  {contest.type === "paid" ? inr(contest.entryFee) : "Free"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Max participants</span>
                <span className="font-semibold">{contest.maxParticipants ?? "Unlimited"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Starts</span>
                <span className="font-semibold">{formatDate(contest.startTime)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Ends</span>
                <span className="font-semibold">{formatDate(contest.endTime)}</span>
              </div>
              {isLive && (
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-4 w-4" aria-hidden /> Time left
                  </span>
                  <span className="font-bold tabular-nums text-orange-600 dark:text-orange-400">
                    <Countdown end={contest.endTime} />
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-3">
                <ErrorBanner message={error} />
              </div>
            )}

            {canEnter && (
              <>
                <div className="mt-4">
                  <Turnstile onToken={setTurnstileToken} />
                </div>
                <Button
                  className="mt-3 w-full"
                  size="lg"
                  onClick={join}
                  loading={joining}
                  disabled={!turnstileToken}
                >
                  {isUpcoming ? "Register for contest" : "Join contest"}
                </Button>
              </>
            )}
            {isLive && (
              <button
                type="button"
                onClick={() => router.push(`/contests/${id}/workspace`)}
                className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-lg border border-border px-6 text-base font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Go to workspace
              </button>
            )}
            <Link
              href={`/contests/${id}/leaderboard`}
              className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Users className="h-4 w-4" aria-hidden /> View leaderboard
            </Link>
          </Card>
        </aside>
      </div>
    </main>
  )
}
