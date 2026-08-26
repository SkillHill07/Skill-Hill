"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { StatusBadge } from "@/components/status-badge"
import { Button, Card, CardContent, EmptyState, ErrorBanner, PageHeader, Table, TBody, TD, TH, THead, TR, Textarea } from "@/components/ui"

interface PendingUser {
  _id: string
  firstName: string
  lastName: string
  email: string
  accountStatus: string
  panVerified: boolean
  kycStatus: string
  createdAt: string
}

interface PendingResponse {
  total: number
  users: PendingUser[]
}

interface KycDetails {
  user: PendingUser
  kyc: {
    panNumber: string | null
    bankAccountNumber: string | null
    ifscCode: string | null
    upiId: string | null
  }
}

export default function AdminKycPage() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [action, setAction] = useState<"approved" | "rejected">("approved")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-kyc-pending"],
    queryFn: () => api.get<PendingResponse>("/admin/kyc/pending"),
  })

  const { data: details } = useQuery({
    queryKey: ["admin-kyc-details", selected],
    queryFn: () => api.get<KycDetails>(`/admin/kyc/${selected}`),
    enabled: !!selected,
  })

  async function review() {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      await api.put(`/admin/kyc/${selected}/review`, {
        action,
        ...(action === "rejected" ? { rejectionReason: reason } : {}),
      })
      setSelected(null)
      setReason("")
      queryClient.invalidateQueries({ queryKey: ["admin-kyc-pending"] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="KYC reviews" subtitle="Verify user PAN / bank / UPI submissions" />

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <EmptyState title="Loading…" />
            ) : !data || data.users.length === 0 ? (
              <EmptyState title="No pending KYC" hint="All caught up!" />
            ) : (
              <Table className="border-0">
                <THead>
                  <TR>
                    <TH>User</TH>
                    <TH>PAN</TH>
                    <TH>Submitted</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.users.map((u) => (
                    <TR key={u._id} className={selected === u._id ? "bg-indigo-600/5" : undefined}>
                      <TD>
                        <p className="font-medium">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </TD>
                      <TD>{u.panVerified ? "Verified" : "Not verified"}</TD>
                      <TD className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</TD>
                      <TD><StatusBadge status={u.kycStatus} /></TD>
                      <TD className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelected(u._id)}>
                          Review
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Review panel */}
        <div>
          {selected && details ? (
            <Card>
              <CardContent className="flex flex-col gap-3 p-5 text-sm">
                <h2 className="font-semibold">Review KYC</h2>
                <div className="flex flex-col gap-1 rounded-lg bg-muted/60 p-3">
                  <p><span className="text-muted-foreground">PAN:</span> <code>{details.kyc.panNumber ?? "—"}</code></p>
                  <p><span className="text-muted-foreground">Bank:</span> <code>{details.kyc.bankAccountNumber ?? "—"}</code></p>
                  <p><span className="text-muted-foreground">IFSC:</span> <code>{details.kyc.ifscCode ?? "—"}</code></p>
                  <p><span className="text-muted-foreground">UPI:</span> <code>{details.kyc.upiId ?? "—"}</code></p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={action === "approved" ? "success" : "outline"}
                    onClick={() => setAction("approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant={action === "rejected" ? "danger" : "outline"}
                    onClick={() => setAction("rejected")}
                  >
                    Reject
                  </Button>
                </div>
                {action === "rejected" && (
                  <div>
                    <Textarea
                      rows={2}
                      placeholder="Rejection reason (required)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>
                )}
                <Button onClick={review} loading={busy} disabled={action === "rejected" && !reason.trim()}>
                  Submit review
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-5 text-sm text-muted-foreground">
                Select a user to review their KYC details.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
