"use client"

import Link from "next/link"
import { useState } from "react"
import { KeyRound } from "lucide-react"
import { api, DEV_TURNSTILE_TOKEN } from "@/lib/api"
import { Button, Card, CardContent, ErrorBanner, Input, Label } from "@/components/ui"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post("/auth/forgot-password", { email, turnstileToken: DEV_TURNSTILE_TOKEN })
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold tracking-tight">
          <KeyRound className="h-6 w-6 text-indigo-500" /> Reset password
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
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" loading={busy}>Send reset link</Button>
            </form>
          )}
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
