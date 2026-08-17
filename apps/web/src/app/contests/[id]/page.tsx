"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { ArrowRight, Clock, ListChecks, Trophy, Users } from "lucide-react"
import { api, DEV_TURNSTILE_TOKEN } from "@/lib/api"
import { formatDuration, formatDate, inr } from "@/lib/format"
import { ContestStatusBadge } from "@/components/status-badge"
import { Badge, Button, Card, CardContent, EmptyState, ErrorBanner, Skeleton } from "@/components/ui"

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
    <span className="tabular-nums">
      {remaining > 0 ? formatDuration(remaining) : "Ended"}
    </span>
  )
}

export default function ContestDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

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
    setJoining(true)
    setError(null)
    try {
      await api.post(`/contests/${id}/join`, { turnstileToken: DEV_TURNSTILE_TOKEN })
      window.location.reload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setJoining(false)
    }
  }

  if (isLoading) {
    return <div className="mx-auto max-w-6xl px-4 py-10"><Skeleton className="h-64" /></div>
  }
  if (isError || !contest) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <EmptyState title="Contest not found" hint="It may be a draft (hidden from the public) or no longer exists." />
      </div>
    )
  }

  const isLive = contest.status === "active"
  const isUpcoming = contest.status === "active" && new Date(contest.startTime) > new Date()
  const canEnter = isLive || isUpcoming

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/contests" className="text-sm text-muted-foreground hover:text-foreground">
        ← All contests
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="flex flex-col gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ContestStatusBadge status={contest.status} />
              <Badge tone={contest.type === "paid" ? "violet" : "slate"}>
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
                <ListChecks className="h-4 w-4 text-indigo-500" />
                <h2 className="font-semibold">Problems ({contest.problemIds.length})</h2>
              </div>
              {contest.problemIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No problems published yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {contest.problemIds.map((p) => (
                    <li key={p._id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/10 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                          {p.points}
                        </span>
                        <div>
                          <p className="font-medium">{p.title}</p>
                          <p className="text-xs capitalize text-muted-foreground">
                            {p.type === "mcq" ? "Multiple choice" : "Coding"} · {p.difficulty}
                          </p>
                        </div>
                      </div>
                      {isLive && (
                        <Link href={`/contests/${id}/workspace`}>
                          <Button size="sm" variant="outline">
                            Solve <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
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
                  <Trophy className="h-4 w-4 text-amber-500" />
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
                        <span className="font-medium">{inr(s.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Prize pool</span>
                <span className="font-semibold">{inr(contest.prizePool)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Entry fee</span>
                <span className="font-semibold">
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
                    <Clock className="h-4 w-4" /> Time left
                  </span>
                  <span className="font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                    <Countdown end={contest.endTime} />
                  </span>
                </div>
              )}
            </div>

            {error && <ErrorBanner message={error} />}

            {canEnter && (
              <Button className="mt-4 w-full" size="lg" onClick={join} loading={joining}>
                {isUpcoming ? "Register for contest" : "Join contest"}
              </Button>
            )}
            {isLive && (
              <Link href={`/contests/${id}/workspace`} className="mt-2 block">
                <Button className="w-full" variant="outline" size="lg">
                  Go to workspace
                </Button>
              </Link>
            )}
            <Link href={`/contests/${id}/leaderboard`} className="mt-2 block">
              <Button className="w-full" variant="ghost" size="sm">
                <Users className="h-4 w-4" /> View leaderboard
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
