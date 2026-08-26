"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { CheckCircle2, History, Settings, ShieldCheck, User, XCircle } from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, inr } from "@/lib/format"
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorBanner,
  Input,
  Label,
  Skeleton,
} from "@/components/ui"
import { RequireAuth } from "@/components/require-auth"
import { cn } from "@skillcontest/ui"

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

type Tab = "profile" | "activity" | "settings"

const KYC_TONES: Record<string, "neutral" | "green" | "amber" | "red"> = {
  pending: "amber",
  verified: "green",
  rejected: "red",
}

const tabs: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
  { key: "profile", label: "Profile", icon: <User className="h-4 w-4" /> },
  { key: "activity", label: "Activity", icon: <History className="h-4 w-4" /> },
  { key: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
]

function ProfileTab({
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

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-orange-600 text-2xl font-bold text-white">
            {me.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.avatarUrl} alt={`${me.firstName}'s avatar`} className="h-full w-full object-cover" />
            ) : (
              me.firstName?.[0] ?? "?"
            )}
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold">
              {me.firstName} {me.lastName}
            </p>
            <p className="text-sm text-muted-foreground">{me.email}</p>
            <Badge tone={me.role === "admin" || me.role === "creator" ? "teal" : "neutral"}>
              {me.role}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="fn">First name</Label>
            <Input id="fn" name="firstName" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ln">Last name</Label>
            <Input id="ln" name="lastName" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={saveProfile} loading={busy === "profile"}>
            Save changes
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} loading={busy === "avatar"}>
            Upload avatar
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Upload avatar image"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void uploadAvatar(f)
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

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

  const isLoading = loadingParticipations || loadingSubmissions

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    )
  }

  const hasParticipations = participations && participations.length > 0
  const hasSubmissions = submissions && submissions.length > 0

  return (
    <div className="flex flex-col gap-4">
      {/* Contests */}
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 font-semibold">Contests joined</h3>
          {!hasParticipations ? (
            <EmptyState title="No contests yet" hint="Join a contest to see your history here." />
          ) : (
            <ul className="divide-y divide-border">
              {participations.map((p) => (
                <li key={p._id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.contest?.title ?? "Contest"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.joinedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.rank && (
                      <Badge tone="amber">#{p.rank}</Badge>
                    )}
                    <span className="text-sm font-semibold tabular-nums">{p.totalScore} pts</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Submissions */}
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 font-semibold">Recent submissions</h3>
          {!hasSubmissions ? (
            <EmptyState title="No submissions yet" hint="Submit a solution to see it here." />
          ) : (
            <ul className="divide-y divide-border">
              {submissions.map((s) => (
                <li key={s._id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {s.status === "accepted" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.problem?.title ?? "Problem"}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.contest?.title ?? "Practice"} · {s.mode === "run" ? "Run" : "Submit"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={s.status === "accepted" ? "green" : "red"}>
                      {s.status}
                    </Badge>
                    <span className="text-sm tabular-nums">{s.totalScore} pts</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SettingsTab({
  me,
  phone,
  setPhone,
  kyc,
  pan,
  setPan,
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
  me: Me
  phone: string
  setPhone: (v: string) => void
  kyc: KycStatus | undefined
  pan: string
  setPan: (v: string) => void
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
    <div className="flex flex-col gap-4">
      {/* Phone */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <h3 className="font-semibold">Phone number</h3>
          <div className="max-w-sm">
            <Label htmlFor="ph">Phone</Label>
            <Input id="ph" name="phone" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" />
          </div>
          <div>
            <Button onClick={saveProfile} loading={busy === "profile"}>
              Save phone
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KYC */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden /> KYC verification
            </h3>
            {kyc && <Badge tone={KYC_TONES[kyc.kycStatus] ?? "neutral"}>{kyc.kycStatus}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            Required to withdraw winnings. All fields are encrypted at rest.
          </p>

          {kyc && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone={kyc.hasPan ? "green" : "neutral"}>PAN {kyc.hasPan ? "✓" : "—"}</Badge>
              <Badge tone={kyc.hasBankAccount ? "green" : "neutral"}>Bank {kyc.hasBankAccount ? "✓" : "—"}</Badge>
              <Badge tone={kyc.hasIfsc ? "green" : "neutral"}>IFSC {kyc.hasIfsc ? "✓" : "—"}</Badge>
              <Badge tone={kyc.hasUpiId ? "green" : "neutral"}>UPI {kyc.hasUpiId ? "✓" : "—"}</Badge>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="pan">PAN number</Label>
              <Input id="pan" value={pan} onChange={(e) => setPan(e.target.value)} placeholder="ABCDE1234F" maxLength={10} autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="upi">UPI id</Label>
              <Input id="upi" type="text" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@upi" autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="bank">Bank account number</Label>
              <Input id="bank" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="9–18 digits" inputMode="numeric" autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="ifsc">IFSC code</Label>
              <Input id="ifsc" value={ifsc} onChange={(e) => setIfsc(e.target.value)} placeholder="HDFC0001234" maxLength={11} autoComplete="off" />
            </div>
          </div>

          <Button variant="secondary" onClick={saveKyc} loading={busy === "kyc"}>
            Submit for verification
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

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

  const [tab, setTab] = useState<Tab>("profile")

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
    try {
      const form = new FormData()
      form.append("firstName", firstName)
      form.append("lastName", lastName)
      form.append("phone", phone)
      await api.put("/auth/me", form)
      setNotice("Profile updated")
      refetch()
    } catch (err) {
      setError((err as Error).message)
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
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (isLoading || !me) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <Skeleton className="h-72" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-orange-600 text-lg font-bold text-white">
          {me.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            me.firstName?.[0] ?? "?"
          )}
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {me.firstName} {me.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">{me.email}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div role="tablist" aria-label="Profile sections" className="mb-6 flex items-center gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
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

      {/* Tab content */}
      {tab === "profile" && (
        <ProfileTab
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

      {tab === "settings" && (
        <SettingsTab
          me={me}
          phone={phone}
          setPhone={setPhone}
          kyc={kyc}
          pan={pan}
          setPan={setPan}
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
