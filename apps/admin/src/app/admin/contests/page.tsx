"use client"

import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { Plus } from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, inr } from "@/lib/format"
import { ContestStatusBadge } from "@/components/status-badge"
import { Button, EmptyState, PageHeader, Table, TBody, TD, TH, THead, TR } from "@/components/ui"
import { cn } from "@skillcontest/ui"

interface Contest {
  _id: string
  title: string
  slug: string
  type: string
  entryFee: number
  prizePool: number
  status: string
  startTime: string
  endTime: string
}

interface ContestsResponse {
  contests: Array<{ contest: Contest; participantCount: number }>
  total: number
  totalPages: number
}

const STATUSES = ["draft", "active", "frozen", "settled", "cancelled"]

function AdminContestsInner() {
  const params = useSearchParams()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState(params.get("status") ?? "draft")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-contests", status],
    queryFn: () => api.get<ContestsResponse>(`/contests?status=${status}&limit=50`),
  })

  async function act(id: string, action: "publish" | "cancel" | "freeze" | "settle") {
    setBusyId(id)
    setError(null)
    try {
      await api.post(`/contests/${id}/${action}`, action === "cancel" ? { reason: "cancelled from admin" } : {})
      queryClient.invalidateQueries({ queryKey: ["admin-contests"] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Contests"
        subtitle="Create, manage, and run contests"
        actions={
          <Link href="/admin/contests/new">
            <Button>
              <Plus className="h-4 w-4" /> New contest
            </Button>
          </Link>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              status === s ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <EmptyState title="Loading…" />
      ) : !data || data.contests.length === 0 ? (
        <EmptyState title={`No ${status} contests`} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Contest</TH>
              <TH>Type</TH>
              <TH>Pool</TH>
              <TH>Participants</TH>
              <TH>Timing</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {data.contests.map(({ contest, participantCount }) => (
              <TR key={contest._id}>
                <TD>
                  <Link href={`/admin/contests/${contest._id}`} className="font-medium hover:text-indigo-600 dark:hover:text-indigo-400">
                    {contest.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{contest.slug}</p>
                </TD>
                <TD className="capitalize">{contest.type}</TD>
                <TD>
                  {inr(contest.prizePool)}
                  {contest.type === "paid" && <p className="text-xs text-muted-foreground">{inr(contest.entryFee)} entry</p>}
                </TD>
                <TD>{participantCount}</TD>
                <TD className="text-xs">
                  {formatDate(contest.startTime)}
                  <p className="text-muted-foreground">{formatDate(contest.endTime)}</p>
                </TD>
                <TD><ContestStatusBadge status={contest.status} /></TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    {contest.status === "draft" && (
                      <Button size="sm" variant="success" loading={busyId === contest._id} onClick={() => act(contest._id, "publish")}>
                        Publish
                      </Button>
                    )}
                    {contest.status === "active" && (
                      <>
                        <Button size="sm" variant="outline" loading={busyId === contest._id} onClick={() => act(contest._id, "freeze")}>
                          Freeze
                        </Button>
                        <Button size="sm" variant="danger" loading={busyId === contest._id} onClick={() => act(contest._id, "cancel")}>
                          Cancel
                        </Button>
                      </>
                    )}
                    {contest.status === "frozen" && (
                      <Button size="sm" loading={busyId === contest._id} onClick={() => act(contest._id, "settle")}>
                        Settle
                      </Button>
                    )}
                    <Link href={`/admin/contests/${contest._id}`}>
                      <Button size="sm" variant="ghost">View</Button>
                    </Link>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}

export default function AdminContestsPage() {
  return (
    <Suspense fallback={null}>
      <AdminContestsInner />
    </Suspense>
  )
}
