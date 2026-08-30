"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon } from "lucide-react"
import { api, getTurnstileToken } from "@/lib/api"
import { formatDate, inr } from "@/lib/format"
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorBanner,
  Skeleton,
  StatCard,
} from "@/components/ui"
import { FloatingInput } from "@/components/ui/floating-input"
import { Turnstile } from "@/components/turnstile"
import { RequireAuth } from "@/components/require-auth"

interface Balance {
  userId: string
  balance: number
  locked: number
  available: number
  status: string
  totalDeposited: number
  totalWithdrawn: number
  totalWon: number
}

interface Order {
  orderId: string
  amount: number
  currency: string
  keyId: string
  paymentId: string
  receipt: string
  purpose: string
}

interface Transaction {
  _id: string
  type: string
  amount: number
  status: string
  description?: string
  reference?: string
  createdAt: string
}

interface TransactionsResponse {
  transactions: Transaction[]
  total: number
  page: number
  totalPages: number
}

/** Load Razorpay Checkout from their CDN and open the modal for an order. */
async function openRazorpayCheckout(order: Order): Promise<void> {
  if (!(window as unknown as { Razorpay?: unknown }).Razorpay) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("Could not load Razorpay checkout"))
      document.body.appendChild(script)
    })
  }
  const Razorpay = (window as unknown as { Razorpay: new (o: Record<string, unknown>) => { open: () => void } }).Razorpay
  const rzp = new Razorpay({
    key: order.keyId,
    amount: order.amount,
    currency: order.currency,
    name: "SkillHill",
    description: "Wallet deposit",
    order_id: order.orderId,
    prefill: { contact: "", email: "" },
    theme: { color: "#ea580c" },
  })
  rzp.open()
}

/** Rupees (as typed by the user) → integer paise. */
function toPaise(rupees: string): number {
  const n = Number(rupees)
  if (!Number.isFinite(n)) return Number.NaN
  return Math.round(n * 100)
}

function WalletInner() {
  const [depositAmount, setDepositAmount] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [upiId, setUpiId] = useState("")
  const [turnstileToken, setTurnstileToken] = useState(() => getTurnstileToken())
  const [busy, setBusy] = useState<"deposit" | "withdraw" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const {
    data: balance,
    isLoading,
    isError: balanceError,
  } = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: () => api.get<Balance>("/wallet/balance"),
    retry: false,
  })

  const { data: txns } = useQuery({
    queryKey: ["wallet-transactions", 25],
    queryFn: () => api.get<TransactionsResponse>("/wallet/transactions?limit=25"),
  })

  async function deposit() {
    const paise = toPaise(depositAmount)
    if (!Number.isFinite(paise) || paise < 1000) {
      setError("Minimum deposit is ₹10")
      return
    }
    if (paise > 500000) {
      setError("Maximum deposit is ₹5,000 per order")
      return
    }
    setBusy("deposit")
    setError(null)
    setNotice(null)
    try {
      const order = await api.post<Order>("/wallet/deposit", { amount: paise })
      setNotice("Opening Razorpay checkout…")
      await openRazorpayCheckout(order)
      setNotice("If the payment was completed, your wallet will be credited shortly.")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function withdraw() {
    const paise = toPaise(withdrawAmount)
    if (!Number.isFinite(paise) || paise < 10000) {
      setError("Minimum withdrawal is ₹100")
      return
    }
    if (!turnstileToken) return
    setBusy("withdraw")
    setError(null)
    try {
      await api.post("/wallet/withdraw", {
        amount: paise,
        upiId: upiId || undefined,
        turnstileToken,
      })
      setNotice("Withdrawal requested — the payout will be processed via UPI.")
      setWithdrawAmount("")
      setUpiId("")
      setTurnstileToken(getTurnstileToken())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <WalletIcon className="h-6 w-6 text-orange-500" aria-hidden />
        <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
      </div>

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : balanceError ? (
        <ErrorBanner message="Could not load your wallet balance. Refresh the page to try again." />
      ) : balance ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Available balance" value={inr(balance.available)} />
          <StatCard label="Locked" value={inr(balance.locked)} />
          <StatCard label="Lifetime deposits" value={inr(balance.totalDeposited)} />
          <StatCard
            label="Total won"
            value={inr(balance.totalWon)}
            sub={balance.status === "frozen" ? "Wallet frozen by admin" : undefined}
          />
        </div>
      ) : null}

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
        >
          {notice}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Deposit */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-1 font-semibold">Add money</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Deposit funds via UPI/cards (Razorpay). Min ₹10, max ₹5,000 per order.
            </p>
            <div className="flex flex-col gap-3">
              <FloatingInput
                id="deposit"
                type="number"
                inputMode="decimal"
                label="Amount (₹)"
                min={10}
                max={5000}
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <Button
                onClick={deposit}
                loading={busy === "deposit"}
                disabled={balance?.status === "frozen"}
              >
                <ArrowDownLeft className="h-4 w-4" aria-hidden /> Deposit
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Withdraw */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-1 font-semibold">Withdraw</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Payout to your verified UPI id (min ₹100). KYC must be verified.
            </p>
            <div className="flex flex-col gap-3">
              <FloatingInput
                id="withdraw"
                type="number"
                inputMode="decimal"
                label="Amount (₹)"
                min={100}
                step="0.01"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              <FloatingInput
                id="upi"
                label="UPI id (optional)"
                autoComplete="off"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
              />

              <Turnstile onToken={setTurnstileToken} />

              <Button
                variant="secondary"
                onClick={withdraw}
                loading={busy === "withdraw"}
                disabled={balance?.status === "frozen" || !turnstileToken}
              >
                <ArrowUpRight className="h-4 w-4" aria-hidden /> Withdraw
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <div className="mt-6">
        <h2 className="mb-3 font-semibold">Transactions</h2>
        {txns && txns.transactions.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {txns.transactions.map((t) => (
                  <li
                    key={t._id}
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={t.amount > 0 ? "text-emerald-500" : "text-red-500"}>
                        {t.amount > 0 ? (
                          <ArrowDownLeft className="h-4 w-4" aria-hidden />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium capitalize">{t.type.replace(/_/g, " ")}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDate(t.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        tone={
                          t.status === "completed" ? "green" : t.status === "pending" ? "amber" : "neutral"
                        }
                      >
                        {t.status}
                      </Badge>
                      <span
                        className={`font-semibold tabular-nums ${
                          t.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                        }`}
                      >
                        {t.amount > 0 ? "+" : ""}
                        {inr(Math.abs(t.amount))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            title="No transactions yet"
            hint="Deposits, contest fees, prizes and withdrawals will appear here."
          />
        )}
      </div>
    </div>
  )
}

export default function WalletPage() {
  return (
    <RequireAuth>
      <WalletInner />
    </RequireAuth>
  )
}
