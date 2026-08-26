"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { SubmissionStatusBadge } from "@/components/status-badge"
import { Card, CardContent, EmptyState, PageHeader, Select, Table, TBody, TD, TH, THead, TR } from "@/components/ui"

interface Submission {
  _id: string
  userId: { firstName: string; lastName: string; email: string } | string
  problemId: { _id: string; title: string } | string
  language: string | null
  status: string
  totalScore: number
  publicPassed: number
  publicTotal: number
  hiddenPassed: number
  hiddenTotal: number
  executionTime: number
  memoryUsed: number
  compilerOutput: string | null
  submittedAt: string
}

interface Response {
  submissions: Submission[]
  total: number
  totalPages: number
}

const STATUSES = ["pending", "running", "accepted", "rejected", "error", "timeout"]

export default function AdminSubmissionsPage() {
  const params = useParams<{ id: string }>()
  const [status, setStatus] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["admin-submissions", params.id, status],
    queryFn: () => {
      const q = new URLSearchParams({ limit: "100" })
      if (status) q.set("status", status)
      return api.get<Response>(`/admin/contests/${params.id}/submissions?${q.toString()}`)
    },
  })

  return (
    <div>
      <PageHeader title="Submissions audit" subtitle="Every submission in this contest, newest first" />

      <div className="mb-4 max-w-[220px]">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <EmptyState title="Loading…" />
      ) : !data || data.submissions.length === 0 ? (
        <EmptyState title="No submissions" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>User</TH>
                  <TH>Problem</TH>
                  <TH>Lang</TH>
                  <TH>Status</TH>
                  <TH>Score</TH>
                  <TH>Tests</TH>
                  <TH>Time</TH>
                  <TH>Submitted</TH>
                </TR>
              </THead>
              <TBody>
                {data.submissions.map((s) => {
                  const user = typeof s.userId === "object" ? s.userId : null
                  const problem = typeof s.problemId === "object" ? s.problemId : null
                  return (
                    <TR key={s._id}>
                      <TD>
                        {user ? `${user.firstName} ${user.lastName}` : "—"}
                        {user?.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
                      </TD>
                      <TD>{problem?.title ?? "—"}</TD>
                      <TD>{s.language ?? "mcq"}</TD>
                      <TD><SubmissionStatusBadge status={s.status} /></TD>
                      <TD className="font-semibold">{s.totalScore}</TD>
                      <TD className="text-xs">
                        {s.publicPassed}/{s.publicTotal} public · {s.hiddenPassed}/{s.hiddenTotal} hidden
                      </TD>
                      <TD className="text-xs">{(s.executionTime / 1000).toFixed(2)}s</TD>
                      <TD className="text-xs text-muted-foreground">{formatDate(s.submittedAt)}</TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
