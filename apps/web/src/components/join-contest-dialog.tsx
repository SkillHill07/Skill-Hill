"use client"

import { useCallback, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  ArrowDownLeft,
  CreditCard,
  LogIn,
  Shield,
  Wallet,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react"
import { api } from "@/lib/api"
import { inr } from "@/lib/format"
import { useMe } from "@/hooks/use-me"
import { useToast } from "@/components/ui/toast"

interface JoinContestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contestId: string
  contestTitle: string
  entryFee: number
  prizePool: number
  onSuccess?: () => void
}

interface Balance {
  balance: number
  available: number
  locked: number
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

/** Load Razorpay Checkout from their CDN and open the modal. */
async function openRazorpayCheckout(
  order: Order,
  description: string,
): Promise<void> {
  if (!(window as unknown as { Razorpay?: unknown }).Razorpay) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("Could not load Razorpay checkout"))
      document.body.appendChild(script)
    })
  }
  const Razorpay = (
    window as unknown as {
      Razorpay: new (o: Record<string, unknown>) => { open: () => void }
    }
  ).Razorpay
  const rzp = new Razorpay({
    key: order.keyId,
    amount: order.amount,
    currency: order.currency,
    name: "SkillHill",
    description,
    order_id: order.orderId,
    prefill: { contact: "", email: "" },
    theme: { color: "#ea580c" },
  })
  rzp.open()
}

type DialogStep = "balance" | "payment" | "processing" | "success"

export function JoinContestDialog({
  open,
  onOpenChange,
  contestId,
  contestTitle,
  entryFee,
  prizePool,
  onSuccess,
}: JoinContestDialogProps) {
  const { data: me } = useMe()
  const [step, setStep] = useState<DialogStep>("balance")
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const balanceBefore = useRef<number | null>(null)

  const { data: balance } = useQuery<Balance>({
    queryKey: ["wallet-balance"],
    queryFn: () => api.get<Balance>("/wallet/balance"),
    enabled: open && !!me,
    retry: false,
  })

  const isFree = entryFee === 0
  const hasEnoughBalance = (balance?.available ?? 0) >= entryFee
  const shortfall = entryFee - (balance?.available ?? 0)
  const needsPayment = !isFree && !hasEnoughBalance

  function handleOpenChange(value: boolean) {
    if (!value) {
      setStep("balance")
      setError(null)
    }
    onOpenChange(value)
  }

  /** Poll wallet balance after Razorpay checkout. Show toast + join on success. */
  const pollForPayment = useCallback(
    (amountPaise: number) => {
      balanceBefore.current = balance?.available ?? 0
      let attempts = 0
      const maxAttempts = 20
      const poll = setInterval(async () => {
        attempts++
        try {
          const fresh = await api.get<Balance>("/wallet/balance")
          if (fresh.available > (balanceBefore.current ?? 0)) {
            clearInterval(poll)
            toast({
              variant: "success",
              title: "Payment received!",
              description: `${inr(amountPaise)} credited. Joining contest…`,
            })
            void queryClient.invalidateQueries({ queryKey: ["wallet-balance"] })
            // Auto-join the contest now that wallet is funded
            handleDirectJoin()
          }
        } catch {
          // ignore
        }
        if (attempts >= maxAttempts) {
          clearInterval(poll)
          setError("Payment is still processing. Please wait a moment and try joining again.")
          setStep("balance")
        }
      }, 2000)
    },
    [balance, toast, queryClient],
  )

  async function handlePayAndJoin() {
    setError(null)
    setStep("processing")

    try {
      const order = await api.post<Order>("/payments/create-order", {
        amount: entryFee,
        purpose: "contest",
        contestId,
      })

      await openRazorpayCheckout(order, `Entry fee — ${contestTitle}`)

      // Razorpay closed — poll for balance change
      pollForPayment(entryFee)
    } catch (err) {
      setError((err as Error).message)
      setStep("payment")
    }
  }

  async function handleDirectJoin() {
    setError(null)
    setStep("processing")

    try {
      // For free contests or when balance is sufficient, join directly
      const { getTurnstileToken } = await import("@/lib/api")
      const turnstileToken = getTurnstileToken()
      await api.post(`/contests/${contestId}/join`, { turnstileToken })
      setStep("success")
      onSuccess?.()
    } catch (err) {
      setError((err as Error).message)
      setStep("balance")
    }
  }

  // Not logged in → auth prompt
  if (!me) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-600/10">
              <LogIn className="h-6 w-6 text-orange-600" />
            </div>
            <DialogTitle className="text-center mt-3">Sign in to join</DialogTitle>
            <DialogDescription className="text-center">
              Create a free account or sign in to join <strong>{contestTitle}</strong> and compete for prizes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button
              className="w-full"
              onClick={() => {
                window.location.href = "/login"
              }}
            >
              Sign in
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                window.location.href = "/register"
              }}
            >
              Create account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Free contest → direct join
  if (isFree) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Join {contestTitle}</DialogTitle>
            <DialogDescription>
              This is a free contest. No payment required.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}          <Button
              className="w-full"
              disabled={step === "processing"}
              onClick={handleDirectJoin}
            >
              {step === "processing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : step === "success" ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Joined! Redirecting…
                </>
              ) : (
                "Join contest"
              )}
            </Button>
        </DialogContent>
      </Dialog>
    )
  }

  // Paid contest
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {step === "success" ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600/10">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">You&apos;re in!</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Payment received. Redirecting to the workspace…
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Join {contestTitle}</DialogTitle>
              <DialogDescription>
                Entry fee: <strong>{inr(entryFee)}</strong> · Prize pool: <strong>{inr(prizePool)}</strong>
              </DialogDescription>
            </DialogHeader>

            {/* Balance summary */}
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="h-4 w-4" /> Wallet balance
                </span>
                <span className="text-lg font-bold tabular-nums">
                  {inr(balance?.available ?? 0)}
                </span>
              </div>
              {needsPayment && (
                <p className="mt-2 text-xs text-muted-foreground">
                  You need <strong>{inr(shortfall)}</strong> more to join this contest.
                </p>
              )}
              {hasEnoughBalance && !isFree && (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="mr-1 inline h-3 w-3" />
                  Sufficient balance to join
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {needsPayment && (
              <div className="space-y-3">
                <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
                  <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                    Pay {inr(entryFee)} via Razorpay
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    UPI, cards, netbanking — secure checkout powered by Razorpay.
                  </p>
                </div>
                <Button
                  className="w-full"
                  disabled={step === "processing"}
                  onClick={handlePayAndJoin}
                >
                  {step === "processing" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <><CreditCard className="h-4 w-4" /> Pay {inr(entryFee)} & join</>
                  )}
                </Button>
              </div>
            )}

            {hasEnoughBalance && (
              <Button
                className="w-full"
                disabled={step === "processing"}
                onClick={handleDirectJoin}
              >
                {step === "processing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <><Shield className="h-4 w-4" /> Join with wallet balance</>
                )}
              </Button>
            )}

            <p className="text-center text-xs text-muted-foreground">
              {inr(entryFee)} deducted from wallet · Remaining balance stays available for future contests.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
