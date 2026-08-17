"use client"

import { useQuery } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { ShieldCheck, User } from "lucide-react"
import { api } from "@/lib/api"
import { Badge, Button, Card, CardContent, ErrorBanner, Input, Label, Skeleton } from "@/components/ui"

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

const KYC_TONES: Record<string, "neutral" | "green" | "amber" | "red"> = {
  pending: "amber",
  verified: "green",
  rejected: "red",
}

export default function ProfilePage() {
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

  const fileRef = useRef<HTMLInputElement>(null)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")

  const [pan, setPan] = useState("")
  const [bankAccount, setBankAccount] = useState("")
  const [ifsc, setIfsc] = useState("")
  const [upi, setUpi] = useState("")

  const [busy, setBusy] = useState<"profile" | "avatar" | "kyc" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function syncForm() {
    if (!me) return
    setFirstName(me.firstName)
    setLastName(me.lastName)
    setPhone(me.phone ?? "")
  }

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
    return <div className="mx-auto max-w-3xl px-4 py-10"><Skeleton className="h-72" /></div>
  }

  if (!firstName) syncForm()

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <User className="h-6 w-6 text-indigo-500" />
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      {notice && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
          {notice}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Profile card */}
        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-indigo-600 text-xl font-bold text-white">
                {me.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={me.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  me.firstName?.[0] ?? "?"
                )}
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-semibold">{me.firstName} {me.lastName}</p>
                <p className="text-sm text-muted-foreground">{me.email}</p>
                <Badge tone={me.role === "admin" || me.role === "creator" ? "violet" : "neutral"}>{me.role}</Badge>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="fn">First name</Label>
                <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ln">Last name</Label>
                <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ph">Phone</Label>
                <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={saveProfile} loading={busy === "profile"}>Save changes</Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()} loading={busy === "avatar"}>
                Upload avatar
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void uploadAvatar(f)
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* KYC card */}
        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> KYC verification
              </h2>
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
                <Input id="pan" value={pan} onChange={(e) => setPan(e.target.value)} placeholder="ABCDE1234F" maxLength={10} />
              </div>
              <div>
                <Label htmlFor="upi">UPI id</Label>
                <Input id="upi" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@upi" />
              </div>
              <div>
                <Label htmlFor="bank">Bank account number</Label>
                <Input id="bank" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="9–18 digits" />
              </div>
              <div>
                <Label htmlFor="ifsc">IFSC code</Label>
                <Input id="ifsc" value={ifsc} onChange={(e) => setIfsc(e.target.value)} placeholder="HDFC0001234" maxLength={11} />
              </div>
            </div>

            <Button variant="secondary" onClick={saveKyc} loading={busy === "kyc"}>
              Submit for verification
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
