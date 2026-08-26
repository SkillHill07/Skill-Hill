"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { api } from "@/lib/api"
import { formatDate, inr } from "@/lib/format"
import { PaymentStatusBadge } from "@/components/status-badge"
import { Button, Card, CardContent, EmptyState, PageHeader, Select, Table, TBody, TD, TH, THead, TR } from "@/components/ui"

interface Payment {
  _id: string
  userId: { firstName: string; lastName: string; email: string } | string
  amount: number
  currency: string
  status: string
  purpose: string
  failureReason: string | null
  createdAt: string
}

interface PaymentsResponse {
  payments: Payment[]
  total: number
  totalPages: number
}

export default function AdminPaymentsPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payments", status],
    queryFn: () => {
      const q = new URLSearchParams({ limit: "50" })
      if (status) q.set("status", status)
      return api.get<PaymentsResponse>(`/admin/payments?${q.toString()}`)
    },
  })

  async function refund(paymentId: string) {
    setBusyId(paymentId)
    setError(null)
    try {
      await api.post("/admin/payments/refund", { paymentId })
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader title="Payments" subtitle="Audit all Razorpay payments and issue refunds" />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mb-4 max-w-[220px]">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="created">Created</option>
          <option value="attempted">Attempted</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </Select>
      </div>

      {isLoading ? (
        <EmptyState title="Loading…" />
      ) : !data || data.payments.length === 0 ? (
        <EmptyState title="No payments" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>User</TH>
                  <TH>Purpose</TH>
                  <TH>Amount</TH>
                  <TH>Status</TH>
                  <TH>Date</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {data.payments.map((p) => {
                  const user = typeof p.userId === "object" ? p.userId : null
                  return (
                    <TR key={p._id}>
                      <TD>
                        {user ? `${user.firstName} ${user.lastName}` : "—"}
                        {user?.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
                      </TD>
                      <TD className="capitalize">{p.purpose}</TD>
                      <TD className="font-semibold">{inr(p.amount)}</TD>
                      <TD><PaymentStatusBadge status={p.status} /></TD>
                      <TD className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</TD>
                      <TD className="text-right">
                        {p.status === "paid" && (
                          <Button size="sm" variant="danger" loading={busyId === p._id} onClick={() => void refund(p._id)}>
                            Refund
                          </Button>
                        )}
                      </TD>
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
