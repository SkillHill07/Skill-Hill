"use client"

import { useQuery } from "@tanstack/react-query"
import { CreditCard } from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, inr } from "@/lib/format"
import { PaymentStatusBadge } from "@/components/status-badge"
import { Card, CardContent, EmptyState, Skeleton } from "@/components/ui"

interface Payment {
  _id: string
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
  page: number
  totalPages: number
}

export default function PaymentsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.get<PaymentsResponse>("/payments?limit=50"),
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <CreditCard className="h-6 w-6 text-indigo-500" />
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : isError || !data || data.payments.length === 0 ? (
        <EmptyState title="No payments yet" hint="Deposit money to your wallet and your payment history will appear here." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {data.payments.map((p) => (
                <li key={p._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium capitalize">{p.purpose} · {inr(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</p>
                    {p.failureReason && (
                      <p className="mt-0.5 text-xs text-red-500">{p.failureReason}</p>
                    )}
                  </div>
                  <PaymentStatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
