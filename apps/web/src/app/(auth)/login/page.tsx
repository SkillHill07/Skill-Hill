"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Github, LogIn } from "lucide-react"
import { api, getTurnstileToken } from "@/lib/api"
import { Button, Card, CardContent, ErrorBanner, anchorButtonClasses } from "@/components/ui"
import { FloatingInput } from "@/components/ui/floating-input"
import { Turnstile } from "@/components/turnstile"

interface OAuthUrl {
  url: string
}

function LoginInner() {
  const params = useSearchParams()
  const nextPath = params.get("next") ?? "/dashboard"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [turnstileToken, setTurnstileToken] = useState(() => getTurnstileToken())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: googleUrl } = useQuery({
    queryKey: ["google-url"],
    queryFn: () => api.get<OAuthUrl>("/auth/google/url"),
    retry: false,
    staleTime: 5 * 60_000,
  })

  const { data: githubUrl } = useQuery({
    queryKey: ["github-url"],
    queryFn: () => api.get<OAuthUrl>("/auth/github/url"),
    retry: false,
    staleTime: 5 * 60_000,
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!turnstileToken) return
    setBusy(true)
    setError(null)
    try {
      await api.post("/auth/login", {
        email,
        password,
        turnstileToken,
      })
      // Hard navigation ensures the cookie is available on the next page.
      window.location.href = nextPath
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to compete and win prizes
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          {error && <ErrorBanner message={error} />}

          <div className="grid grid-cols-2 gap-2">
            <a
              href={googleUrl?.url ?? "#"}
              aria-disabled={!googleUrl?.url}
              className={anchorButtonClasses}
            >
              Google
            </a>
            <a
              href={githubUrl?.url ?? "#"}
              aria-disabled={!githubUrl?.url}
              className={anchorButtonClasses}
            >
              <Github className="h-4 w-4" aria-hidden /> GitHub
            </a>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or with email{" "}
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3" noValidate={false}>
            <FloatingInput
              id="email"
              name="email"
              type="email"
              label="Email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FloatingInput
              id="password"
              name="password"
              type="password"
              label="Password"
              required
              minLength={8}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-orange-600 hover:underline dark:text-orange-400"
              >
                Forgot password?
              </Link>
            </div>

            <Turnstile onToken={setTurnstileToken} />

            <Button type="submit" loading={busy} disabled={!turnstileToken}>
              <LogIn className="h-4 w-4" aria-hidden /> Sign in
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link
              href="/register"
              className="font-medium text-orange-600 hover:underline dark:text-orange-400"
            >
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  )
}
