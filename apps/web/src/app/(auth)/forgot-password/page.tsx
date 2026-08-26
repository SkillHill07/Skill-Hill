"use client"

import Link from "next/link"
import { useState } from "react"
import { KeyRound } from "lucide-react"
import { api, getTurnstileToken } from "@/lib/api"
import { Button, Card, CardContent, ErrorBanner, Input, Label } from "@/components/ui"
import { Turnstile } from "@/components/turnstile"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [turnstileToken, setTurnstileToken] = useState(() => getTurnstileToken())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!turnstileToken) return
    setBusy(true)
    setError(null)
    try {
      await api.post("/auth/forgot-password", { email, turnstileToken })
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold tracking-tight">
          <KeyRound className="h-6 w-6 text-orange-500" aria-hidden /> Reset password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">We&apos;ll email you a reset link</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          {error && <ErrorBanner message={error} />}
          {sent ? (
            <p className="text-sm text-muted-foreground">
              If an account exists with that email, a password reset link has been sent.
              Check your inbox and follow the link.
            </p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <Turnstile onToken={setTurnstileToken} />

              <Button type="submit" loading={busy} disabled={!turnstileToken}>
                Send reset link
              </Button>
            </form>
          )}
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-orange-600 hover:underline dark:text-orange-400">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
