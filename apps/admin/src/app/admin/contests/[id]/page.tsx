"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FileQuestion, Plus, RefreshCw, Users } from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, inr } from "@/lib/format"
import { ContestStatusBadge } from "@/components/status-badge"
import { Badge, Button, Card, CardContent, EmptyState, ErrorBanner, PageHeader, Skeleton, Table, TBody, TD, TH, THead, TR } from "@/components/ui"

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
  problemIds: Array<{ _id: string; title: string; type: string; difficulty: string; points: number }>
}

interface Leaderboard {
  entries: Array<{ rank: number; userId: string; totalScore: number; user: { firstName: string; lastName: string } | null }>
}

export default function AdminContestDetailPage() {
  const params = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const { data: contest, isLoading, isError } = useQuery({
    queryKey: ["admin-contest", params.id],
    queryFn: () => api.get<Contest>(`/contests/${params.id}?includeHidden=true`),
    retry: false,
  })

  const { data: leaderboard } = useQuery({
    queryKey: ["admin-leaderboard", params.id],
    queryFn: () => api.get<Leaderboard>(`/contests/${params.id}/leaderboard?limit=100`),
    retry: false,
  })

  async function act(action: "publish" | "cancel" | "freeze" | "settle" | "redistribute") {
    setBusy(action)
    setError(null)
    setNotice(null)
    try {
      if (action === "redistribute") {
        await api.post(`/admin/contests/${params.id}/prizes/redistribute`, {})
        setNotice("Prize distribution re-run — stuck prizes retried.")
      } else {
        await api.post(`/contests/${params.id}/${action}`, action === "cancel" ? { reason: "cancelled from admin" } : {})
      }
      queryClient.invalidateQueries({ queryKey: ["admin-contest", params.id] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (isLoading) {
    return <Skeleton className="h-96" />
  }
  if (isError || !contest) {
    return <EmptyState title="Contest not found" />
  }

  return (
    <div>
      <PageHeader
        title={contest.title}
        subtitle={`${contest.slug} · ${formatDate(contest.startTime)} → ${formatDate(contest.endTime)}`}
        actions={
          <div className="flex flex-wrap gap-1">
            {contest.status === "draft" && (
              <>
                <Button size="sm" variant="success" loading={busy === "publish"} onClick={() => act("publish")}>Publish</Button>
                <Link href={`/admin/contests/${params.id}/problems/new`}>
                  <Button size="sm" variant="outline"><Plus className="h-4 w-4" /> Add problem</Button>
                </Link>
              </>
            )}
            {contest.status === "active" && (
              <>
                <Button size="sm" variant="outline" loading={busy === "freeze"} onClick={() => act("freeze")}>Freeze</Button>
                <Button size="sm" variant="danger" loading={busy === "cancel"} onClick={() => act("cancel")}>Cancel</Button>
              </>
            )}
            {contest.status === "frozen" && (
              <Button size="sm" loading={busy === "settle"} onClick={() => act("settle")}>Settle & distribute</Button>
            )}
            {contest.status === "settled" && (
              <Button size="sm" variant="outline" loading={busy === "redistribute"} onClick={() => act("redistribute")}>
                <RefreshCw className="h-4 w-4" /> Redistribute prizes
              </Button>
            )}
            <Link href={`/admin/contests/${params.id}/submissions`}>
              <Button size="sm" variant="ghost">Submissions audit</Button>
            </Link>
          </div>
        }
      />

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      {notice && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
          {notice}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Overview */}
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col gap-3 p-5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <ContestStatusBadge status={contest.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Type</span>
              <Badge tone={contest.type === "paid" ? "violet" : "slate"}>{contest.type}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Entry fee</span>
              <span className="font-semibold">{contest.type === "paid" ? inr(contest.entryFee) : "Free"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Prize pool</span>
              <span className="font-semibold">{inr(contest.prizePool)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Max participants</span>
              <span>{contest.maxParticipants ?? "Unlimited"}</span>
            </div>
            {contest.description && (
              <p className="border-t border-border pt-3 whitespace-pre-line text-muted-foreground">{contest.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Problems */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <FileQuestion className="h-4 w-4 text-indigo-500" /> Problems ({contest.problemIds.length})
              </h2>
            </div>
            {contest.problemIds.length === 0 ? (
              <EmptyState title="No problems yet" hint="Add problems before publishing." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Title</TH>
                    <TH>Type</TH>
                    <TH>Difficulty</TH>
                    <TH>Points</TH>
                    <TH className="text-right">Edit</TH>
                  </TR>
                </THead>
                <TBody>
                  {contest.problemIds.map((p) => (
                    <TR key={p._id}>
                      <TD className="font-medium">{p.title}</TD>
                      <TD className="capitalize">{p.type}</TD>
                      <TD className="capitalize text-muted-foreground">{p.difficulty}</TD>
                      <TD>{p.points}</TD>
                      <TD className="text-right">
                        <Link href={`/admin/contests/${params.id}/problems/${p._id}`}>
                          <Button size="sm" variant="ghost">Edit</Button>
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <div className="mt-4">
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4 text-indigo-500" /> Leaderboard ({leaderboard?.entries.length ?? 0} ranked)
            </h2>
            {leaderboard && leaderboard.entries.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Rank</TH>
                    <TH>User</TH>
                    <TH>Score</TH>
                  </TR>
                </THead>
                <TBody>
                  {leaderboard.entries.slice(0, 20).map((e) => (
                    <TR key={e.userId}>
                      <TD>#{e.rank}</TD>
                      <TD>{e.user ? `${e.user.firstName} ${e.user.lastName}` : "Deleted user"}</TD>
                      <TD className="font-semibold">{e.totalScore}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : (
              <EmptyState title="No submissions yet" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
