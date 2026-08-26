"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { Badge, Card, CardContent, EmptyState, PageHeader, Select, Table, TBody, TD, TH, THead, TR } from "@/components/ui"

interface AuditEntry {
  _id: string
  actorId: string
  actorRole: string
  action: string
  resource: string
  resourceId: string | null
  details: Record<string, unknown> | null
  ip: string | null
  createdAt: string
}

interface AuditResponse {
  logs: AuditEntry[]
  total: number
}

const ACTION_LABELS: Record<string, string> = {
  "contest.create": "Contest created",
  "contest.update": "Contest updated",
  "contest.publish": "Contest published",
  "contest.cancel": "Contest cancelled",
  "contest.freeze": "Contest frozen",
  "contest.settle": "Contest settled",
  "prize.redistribute": "Prizes re-distributed",
  "payment.refund": "Payment refunded",
  "wallet.status": "Wallet frozen/unfrozen",
  "user.status": "User status changed",
  "user.role": "User role changed",
  "kyc.review": "KYC reviewed",
}

export default function AdminAuditPage() {
  const [action, setAction] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", action],
    queryFn: () => {
      const q = new URLSearchParams({ limit: "100" })
      if (action) q.set("action", action)
      return api.get<AuditResponse>(`/admin/audit?${q.toString()}`)
    },
  })

  const actions = useMemo(() => {
    const set = new Set((data?.logs ?? []).map((l) => l.action))
    return [...set].sort()
  }, [data])

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every money, ban, and contest-state admin action — who, what, when, from where" />

      <div className="mb-4 max-w-[220px]">
        <Select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <EmptyState title="Loading…" />
      ) : !data || data.logs.length === 0 ? (
        <EmptyState title="No audit entries" hint="Admin actions that move money or change contest state appear here." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>Time</TH>
                  <TH>Action</TH>
                  <TH>Actor</TH>
                  <TH>Resource</TH>
                  <TH>Details</TH>
                  <TH>IP</TH>
                </TR>
              </THead>
              <TBody>
                {data.logs.map((l) => (
                  <TR key={l._id}>
                    <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(l.createdAt)}</TD>
                    <TD><Badge tone="violet">{ACTION_LABELS[l.action] ?? l.action}</Badge></TD>
                    <TD>
                      <span className="font-medium">{l.actorId.slice(-6)}</span>
                      <p className="text-xs text-muted-foreground capitalize">{l.actorRole}</p>
                    </TD>
                    <TD className="text-xs">
                      {l.resource}
                      {l.resourceId && <p className="font-mono text-muted-foreground">{l.resourceId.slice(-6)}</p>}
                    </TD>
                    <TD className="max-w-[260px] text-xs text-muted-foreground">
                      {l.details ? <code className="whitespace-pre-wrap">{JSON.stringify(l.details)}</code> : "—"}
                    </TD>
                    <TD className="font-mono text-xs text-muted-foreground">{l.ip ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
