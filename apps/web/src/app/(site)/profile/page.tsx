"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  CreditCard,
  History,
  Loader2,
  Pencil,
  Settings,
  ShieldCheck,
  User,
  Wallet,
  XCircle,
  Trophy,
} from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, inr } from "@/lib/format"
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorBanner,
  Skeleton,
} from "@/components/ui"
import { FloatingInput } from "@/components/ui/floating-input"
import { RequireAuth } from "@/components/require-auth"
import { cn } from "@skillcontest/ui"

/* ──────────────────────── types ──────────────────────── */

interface Me {
  _id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  phoneCountryCode: string | null
  avatarUrl: string | null
  role: string
}

interface KycStatus {
  panVerified: boolean
  kycStatus: string
  hasPan: boolean
  hasBankAccount: boolean
  hasIfsc: boolean
  hasUpiId: boolean
}

interface Balance {
  balance: number
  locked: number
  available: number
  totalDeposited: number
  totalWithdrawn: number
  totalWon: number
}

interface Transaction {
  _id: string
  type: string
  amount: number
  status: string
  description?: string
  createdAt: string
}

interface ContestParticipation {
  _id: string
  contestId: string
  contest: { title: string; slug: string } | null
  totalScore: number
  rank: number | null
  status: string
  joinedAt: string
}

interface SubmissionHistory {
  _id: string
  problemId: string
  problem: { title: string } | null
  contestId: string
  contest: { title: string } | null
  status: string
  totalScore: number
  mode: string
  createdAt: string
}

type Tab = "overview" | "activity" | "wallet" | "settings"

const KYC_TONES: Record<string, "neutral" | "green" | "amber" | "red"> = {
  pending: "amber",
  verified: "green",
  rejected: "red",
}

const tabs: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
  { key: "overview", label: "Overview", icon: <User className="h-4 w-4" /> },
  { key: "activity", label: "Activity", icon: <History className="h-4 w-4" /> },
  { key: "wallet", label: "Wallet", icon: <Wallet className="h-4 w-4" /> },
  { key: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
]

/* ──────────────────────── Overview Tab ──────────────────────── */

function OverviewTab({
  me,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  busy,
  saveProfile,
  uploadAvatar,
}: {
  me: Me
  firstName: string
  setFirstName: (v: string) => void
  lastName: string
  setLastName: (v: string) => void
  busy: "profile" | "avatar" | "kyc" | null
  saveProfile: () => void
  uploadAvatar: (f: File) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<File | null>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setPreviewFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  function confirmUpload() {
    if (previewFile) {
      uploadAvatar(previewFile)
    }
    clearPreview()
  }

  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewFile(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Profile card */}
      <Card className="overflow-hidden">
        {/* Cover gradient */}
        <div className="h-24 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500" />
        <CardContent className="-mt-10 p-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Avatar */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative -mt-12 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-background bg-orange-600 text-2xl font-bold text-white shadow-lg transition-transform hover:scale-105 cursor-pointer"
            >
              {me.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                me.firstName?.[0] ?? "?"
              )}
              <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-5 w-5 text-white" />
              </span>
              {busy === "avatar" && (
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60">
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                </span>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Upload avatar"
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold tracking-tight">
                {me.firstName} {me.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">{me.email}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge tone={me.role === "admin" || me.role === "creator" ? "teal" : "neutral"}>
                  {me.role}
                </Badge>
                {me.phone && (
                  <span className="text-xs text-muted-foreground">
                    {me.phoneCountryCode} {me.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit name */}
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 font-semibold text-sm">Personal info</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FloatingInput
              id="fn"
              name="firstName"
              label="First name"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <FloatingInput
              id="ln"
              name="lastName"
              label="Last name"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div className="mt-3">
            <Button onClick={saveProfile} disabled={busy === "profile"}>
              {busy === "profile" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Avatar preview dialog */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={clearPreview}>
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Update profile photo</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Preview how your new avatar will look.
            </p>
            <div className="mt-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Avatar preview"
                className="h-28 w-28 rounded-2xl object-cover ring-4 ring-orange-500/20"
              />
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={clearPreview}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={confirmUpload} disabled={busy === "avatar"}>
                {busy === "avatar" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save photo"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────── Activity Tab ──────────────────────── */

function ActivityTab() {
  const { data: participations, isLoading: loadingParticipations } = useQuery({
    queryKey: ["my-participations"],
    queryFn: () => api.get<ContestParticipation[]>("/contests/me/participations?limit=20"),
    retry: false,
  })

  const { data: submissions, isLoading: loadingSubmissions } = useQuery({
    queryKey: ["my-submissions"],
    queryFn: () => api.get<SubmissionHistory[]>("/contests/me/submissions?limit=20"),
    retry: false,
  })

  if (loadingParticipations || loadingSubmissions) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Contests */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold">
              <Trophy className="h-4 w-4 text-amber-500" />
              Contests joined
            </h3>
            {participations && participations.length > 0 && (
              <Badge tone="slate">{participations.length}</Badge>
            )}
          </div>
          {!participations || participations.length === 0 ? (
            <EmptyState title="No contests yet" hint="Join a contest to see your history here." />
          ) : (
            <div className="space-y-2">
              {participations.map((p) => (
                <Link
                  key={p._id}
                  href={`/contests/${p.contestId}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-accent cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm">{p.contest?.title ?? "Contest"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.joinedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.rank && <Badge tone="amber">#{p.rank}</Badge>}
                    <span className="text-sm font-semibold tabular-nums">{p.totalScore} pts</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submissions */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Recent submissions</h3>
            {submissions && submissions.length > 0 && (
              <Badge tone="slate">{submissions.length}</Badge>
            )}
          </div>
          {!submissions || submissions.length === 0 ? (
            <EmptyState title="No submissions yet" hint="Submit a solution to see it here." />
          ) : (
            <div className="space-y-2">
              {submissions.map((s) => (
                <div
                  key={s._id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {s.status === "accepted" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.problem?.title ?? "Problem"}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.contest?.title ?? "Practice"} · {s.mode === "run" ? "Run" : "Submit"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge tone={s.status === "accepted" ? "green" : "red"}>
                      {s.status}
                    </Badge>
                    <span className="text-sm tabular-nums">{s.totalScore} pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ──────────────────────── Wallet Tab ──────────────────────── */

function WalletTab() {
  const { data: balance, isLoading } = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: () => api.get<Balance>("/wallet/balance"),
    retry: false,
  })

  const { data: txns } = useQuery({
    queryKey: ["wallet-transactions", 10],
    queryFn: () => api.get<{ transactions: Transaction[] }>("/wallet/transactions?limit=10"),
  })

  return (
    <div className="flex flex-col gap-5">
      {/* Balance cards */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : balance ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="relative overflow-hidden">
            <div className="absolute right-2 top-2 text-emerald-500/20">
              <Wallet className="h-8 w-8" />
            </div>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Available</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {inr(balance.available)}
              </p>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            <div className="absolute right-2 top-2 text-amber-500/20">
              <CreditCard className="h-8 w-8" />
            </div>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Locked</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{inr(balance.locked)}</p>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            <div className="absolute right-2 top-2 text-orange-500/20">
              <Trophy className="h-8 w-8" />
            </div>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total won</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{inr(balance.totalWon)}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Quick actions */}
      <div className="flex gap-2">
        <Link href="/wallet" className="flex-1">
          <Button variant="outline" className="w-full" size="sm">
            <ArrowDownLeft className="h-4 w-4" /> Deposit
          </Button>
        </Link>
        <Link href="/wallet" className="flex-1">
          <Button variant="outline" className="w-full" size="sm">
            <ArrowUpRight className="h-4 w-4" /> Withdraw
          </Button>
        </Link>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-4 font-semibold">Recent transactions</h3>
          {txns && txns.transactions.length > 0 ? (
            <div className="space-y-2">
              {txns.transactions.map((t) => (
                <div
                  key={t._id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", t.amount > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>
                      {t.amount > 0 ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize">{t.type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge tone={t.status === "completed" ? "green" : t.status === "pending" ? "amber" : "neutral"}>
                      {t.status}
                    </Badge>
                    <span className={cn("text-sm font-semibold tabular-nums", t.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                      {t.amount > 0 ? "+" : ""}{inr(Math.abs(t.amount))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No transactions yet" hint="Deposit or join a contest to see transactions." />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ──────────────────────── Settings Tab ──────────────────────── */

function SettingsTab({
  phone,
  setPhone,
  phoneError,
  kyc,
  pan,
  setPan,
  panError,
  bankAccount,
  setBankAccount,
  ifsc,
  setIfsc,
  upi,
  setUpi,
  busy,
  saveProfile,
  saveKyc,
}: {
  phone: string
  setPhone: (v: string) => void
  phoneError: string | null
  kyc: KycStatus | undefined
  pan: string
  setPan: (v: string) => void
  panError: string | null
  bankAccount: string
  setBankAccount: (v: string) => void
  ifsc: string
  setIfsc: (v: string) => void
  upi: string
  setUpi: (v: string) => void
  busy: "profile" | "avatar" | "kyc" | null
  saveProfile: () => void
  saveKyc: () => void
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Phone */}
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 font-semibold text-sm">Phone number</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Used for account recovery and notifications.
          </p>
          <div className="max-w-sm">
            <FloatingInput
              id="ph"
              name="phone"
              type="tel"
              inputMode="numeric"
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={phoneError ?? undefined}
            />
          </div>
          <div className="mt-3">
            <Button onClick={saveProfile} disabled={busy === "profile"}>
              {busy === "profile" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save phone"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KYC */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> KYC verification
            </h3>
            {kyc && <Badge tone={KYC_TONES[kyc.kycStatus] ?? "neutral"}>{kyc.kycStatus}</Badge>}
          </div>
          <p className="mt-1 mb-4 text-xs text-muted-foreground">
            Required to withdraw winnings. All fields are encrypted at rest.
          </p>

          {kyc && (
            <div className="flex flex-wrap gap-2 text-xs mb-4">
              <Badge tone={kyc.hasPan ? "green" : "neutral"}>PAN {kyc.hasPan ? "✓" : "—"}</Badge>
              <Badge tone={kyc.hasBankAccount ? "green" : "neutral"}>Bank {kyc.hasBankAccount ? "✓" : "—"}</Badge>
              <Badge tone={kyc.hasIfsc ? "green" : "neutral"}>IFSC {kyc.hasIfsc ? "✓" : "—"}</Badge>
              <Badge tone={kyc.hasUpiId ? "green" : "neutral"}>UPI {kyc.hasUpiId ? "✓" : "—"}</Badge>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <FloatingInput
              id="pan"
              label="PAN number (ABCDE1234F)"
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase())}
              maxLength={10}
              autoComplete="off"
              error={panError ?? undefined}
            />
            <FloatingInput
              id="upi"
              label="UPI id"
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              autoComplete="off"
              required
            />
            <FloatingInput
              id="bank"
              label="Bank account number"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
            />
            <FloatingInput
              id="ifsc"
              label="IFSC code"
              value={ifsc}
              onChange={(e) => setIfsc(e.target.value.toUpperCase())}
              maxLength={11}
              autoComplete="off"
            />
          </div>

          <div className="mt-3">
            <Button variant="secondary" onClick={saveKyc} disabled={busy === "kyc"}>
              {busy === "kyc" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit for verification"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ──────────────────────── Main Profile ──────────────────────── */

function ProfileInner() {
  const { data: me, isLoading, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<Me>("/auth/me"),
    retry: false,
  })

  const { data: kyc, refetch: refetchKyc } = useQuery({
    queryKey: ["kyc-status"],
    queryFn: () => api.get<KycStatus>("/auth/kyc/status"),
    retry: false,
  })

  const [tab, setTab] = useState<Tab>("overview")

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null)

  const [pan, setPan] = useState("")
  const [bankAccount, setBankAccount] = useState("")
  const [ifsc, setIfsc] = useState("")
  const [upi, setUpi] = useState("")

  const [busy, setBusy] = useState<"profile" | "avatar" | "kyc" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [panError, setPanError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  useEffect(() => {
    if (!me || syncedUserId === me._id) return
    setFirstName(me.firstName)
    setLastName(me.lastName)
    setPhone(me.phone ?? "")
    setSyncedUserId(me._id)
  }, [me, syncedUserId])

  async function saveProfile() {
    setBusy("profile")
    setError(null)
    setNotice(null)
    setPhoneError(null)
    try {
      const form = new FormData()
      form.append("firstName", firstName)
      form.append("lastName", lastName)
      form.append("phone", phone)
      await api.put("/auth/me", form)
      setNotice("Profile updated")
      refetch()
    } catch (err) {
      const msg = (err as Error).message
      if (msg.toLowerCase().includes("phone")) {
        setPhoneError(msg)
      } else {
        setError(msg)
      }
    } finally {
      setBusy(null)
    }
  }

  async function uploadAvatar(file: File) {
    setBusy("avatar")
    setError(null)
    try {
      const form = new FormData()
      form.append("avatar", file)
      await api.put("/auth/me", form)
      setNotice("Avatar updated")
      refetch()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function saveKyc() {
    setBusy("kyc")
    setError(null)
    setNotice(null)
    setPanError(null)

    // Client-side PAN validation
    if (pan.trim() && !/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(pan.trim().toUpperCase())) {
      setPanError("Invalid PAN format. Expected: ABCDE1234F")
      setBusy(null)
      return
    }

    try {
      const body: Record<string, string> = {}
      if (pan.trim()) body.panNumber = pan.trim().toUpperCase()
      if (bankAccount.trim()) body.bankAccountNumber = bankAccount.trim()
      if (ifsc.trim()) body.ifscCode = ifsc.trim().toUpperCase()
      if (upi.trim()) body.upiId = upi.trim().toLowerCase()
      await api.put("/auth/kyc", body)
      setNotice("KYC details submitted for verification")
      refetchKyc()
    } catch (err) {
      const msg = (err as Error).message
      if (msg.toLowerCase().includes("pan")) {
        setPanError(msg)
      } else {
        setError(msg)
      }
    } finally {
      setBusy(null)
    }
  }

  if (isLoading || !me) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <Skeleton className="h-72" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      {/* Notices */}
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
        >
          {notice}
        </div>
      )}

      {/* Tab bar */}
      <div role="tablist" aria-label="Profile sections" className="mb-6 flex items-center gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer",
              tab === t.key
                ? "border-orange-600 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <OverviewTab
          me={me}
          firstName={firstName}
          setFirstName={setFirstName}
          lastName={lastName}
          setLastName={setLastName}
          busy={busy}
          saveProfile={saveProfile}
          uploadAvatar={uploadAvatar}
        />
      )}

      {tab === "activity" && <ActivityTab />}

      {tab === "wallet" && <WalletTab />}

      {tab === "settings" && (
        <SettingsTab
          phone={phone}
          setPhone={setPhone}
          phoneError={phoneError}
          kyc={kyc}
          pan={pan}
          setPan={setPan}
          panError={panError}
          bankAccount={bankAccount}
          setBankAccount={setBankAccount}
          ifsc={ifsc}
          setIfsc={setIfsc}
          upi={upi}
          setUpi={setUpi}
          busy={busy}
          saveProfile={saveProfile}
          saveKyc={saveKyc}
        />
      )}
    </div>
  )
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  )
}
