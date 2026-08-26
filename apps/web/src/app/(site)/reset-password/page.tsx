"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { ShieldCheck } from "lucide-react"
import { api } from "@/lib/api"
import { Button, Card, CardContent, ErrorBanner, Input, Label } from "@/components/ui"

function ResetPasswordInner() {
  const router = useRouter()
  const params = useSearchParams()
  const email = params.get("email") ?? ""
  const token = params.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post("/auth/reset-password", { email, token, password })
      setDone(true)
      setTimeout(() => router.push("/login"), 1500)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!email || !token) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Invalid reset link. <Link href="/forgot-password" className="text-orange-600 hover:underline">Request a new one</Link>.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-orange-500" /> Choose a new password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{email}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          {error && <ErrorBanner message={error} />}
          {done && (
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Password reset! Redirecting to sign in…
            </p>
          )}
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">At least 8 characters</p>
            </div>
            <Button type="submit" loading={busy}>Reset password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  )
}
