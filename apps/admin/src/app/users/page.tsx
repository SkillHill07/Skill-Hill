"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { AccountStatusBadge, StatusBadge } from "@/components/status-badge"
import { Button, Card, CardContent, EmptyState, Input, PageHeader, Select, Table, TBody, TD, TH, THead, TR } from "@/components/ui"

interface User {
  _id: string
  firstName: string
  lastName: string
  email: string
  role: string
  accountStatus: string
  kycStatus: string | null
  createdAt: string
}

interface UsersResponse {
  users: User[]
  total: number
  totalPages: number
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [accountStatus, setAccountStatus] = useState("")
  const [role, setRole] = useState("")
  const [kycStatus, setKycStatus] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, accountStatus, role, kycStatus],
    queryFn: () => {
      const q = new URLSearchParams()
      if (search) q.set("search", search)
      if (accountStatus) q.set("accountStatus", accountStatus)
      if (role) q.set("role", role)
      if (kycStatus) q.set("kycStatus", kycStatus)
      q.set("limit", "50")
      return api.get<UsersResponse>(`/admin/accounts?${q.toString()}`)
    },
  })

  async function changeStatus(userId: string, status: string) {
    setBusy(userId)
    setError(null)
    try {
      await api.patch(`/admin/accounts/${userId}/status`, { status, reason: `set from admin panel` })
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function changeRole(userId: string, newRole: string) {
    setBusy(userId)
    setError(null)
    try {
      await api.patch(`/admin/accounts/${userId}/role`, { role: newRole })
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function toggleWallet(userId: string, freeze: boolean) {
    setBusy(userId)
    setError(null)
    try {
      await api.patch(`/admin/wallets/${userId}/status`, { status: freeze ? "frozen" : "active" })
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader title="Users" subtitle="Search, filter, and manage accounts" />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <Input placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={accountStatus} onChange={(e) => setAccountStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="flagged">Flagged</option>
          <option value="banned">Banned</option>
        </Select>
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="creator">Creator</option>
          <option value="admin">Admin</option>
        </Select>
        <Select value={kycStatus} onChange={(e) => setKycStatus(e.target.value)}>
          <option value="">All KYC</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </Select>
      </div>

      {isLoading ? (
        <EmptyState title="Loading…" />
      ) : !data || data.users.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>User</TH>
                  <TH>Role</TH>
                  <TH>Status</TH>
                  <TH>KYC</TH>
                  <TH>Joined</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {data.users.map((u) => (
                  <TR key={u._id}>
                    <TD>
                      <p className="font-medium">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </TD>
                    <TD>
                      <Select
                        className="h-8 w-24"
                        value={u.role}
                        disabled={busy === u._id}
                        onChange={(e) => void changeRole(u._id, e.target.value)}
                      >
                        <option value="user">User</option>
                        <option value="creator">Creator</option>
                        <option value="admin">Admin</option>
                      </Select>
                    </TD>
                    <TD><AccountStatusBadge status={u.accountStatus} /></TD>
                    <TD>{u.kycStatus ? <StatusBadge status={u.kycStatus} /> : "—"}</TD>
                    <TD className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        {u.accountStatus !== "banned" && (
                          <Button size="sm" variant="danger" loading={busy === u._id} onClick={() => void changeStatus(u._id, "banned")}>
                            Ban
                          </Button>
                        )}
                        {u.accountStatus !== "active" && (
                          <Button size="sm" variant="success" loading={busy === u._id} onClick={() => void changeStatus(u._id, "active")}>
                            Activate
                          </Button>
                        )}
                        <Button size="sm" variant="outline" loading={busy === u._id} onClick={() => void toggleWallet(u._id, true)}>
                          Freeze wallet
                        </Button>
                        <Button size="sm" variant="ghost" loading={busy === u._id} onClick={() => void toggleWallet(u._id, false)}>
                          Unfreeze
                        </Button>
                      </div>
                    </TD>
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
