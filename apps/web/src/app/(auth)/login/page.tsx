"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Github, LogIn, Loader2 } from "lucide-react"
import { api, getTurnstileToken } from "@/lib/api"
import { Button, Card, CardContent, ErrorBanner } from "@/components/ui"
import { FloatingInput } from "@/components/ui/floating-input"
import { FloatingPasswordInput } from "@/components/ui/floating-password-input"
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

  const { data: googleUrl, isLoading: googleLoading } = useQuery({
    queryKey: ["google-url"],
    queryFn: () => api.get<OAuthUrl>("/auth/google/url"),
    retry: false,
    staleTime: 5 * 60_000,
  })

  const { data: githubUrl, isLoading: githubLoading } = useQuery({
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
      window.location.href = nextPath
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-12 sm:py-20">
      {/* Brand */}
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600 text-white text-lg">
            S
          </span>
          SkillHill
        </Link>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to compete and win prizes
        </p>
      </div>

      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-4 p-6">
          {error && <ErrorBanner message={error} />}

          {/* OAuth buttons */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={googleUrl?.url ?? "#"}
              aria-disabled={!googleUrl?.url}
              onClick={(e) => {
                if (!googleUrl?.url) e.preventDefault()
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Google
            </a>
            <a
              href={githubUrl?.url ?? "#"}
              aria-disabled={!githubUrl?.url}
              onClick={(e) => {
                if (!githubUrl?.url) e.preventDefault()
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            >
              {githubLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Github className="h-4 w-4" />
              )}
              GitHub
            </a>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
            <FloatingInput
              id="email"
              name="email"
              type="email"
              label="Email address"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div>
              <FloatingPasswordInput
                id="password"
                name="password"
                label="Password"
                required
                minLength={8}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="mt-1.5 flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-orange-600 hover:underline dark:text-orange-400"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <Turnstile onToken={setTurnstileToken} />

            <Button type="submit" loading={busy} disabled={!turnstileToken} className="w-full h-11">
              <LogIn className="h-4 w-4" aria-hidden /> Sign in
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-orange-600 hover:underline dark:text-orange-400"
        >
          Create one free
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  )
}
