"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Github, LogIn } from "lucide-react"
import { api, DEV_TURNSTILE_TOKEN } from "@/lib/api"
import { Button, Card, CardContent, ErrorBanner, Input, Label } from "@/components/ui"

interface OAuthUrl {
  url: string
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: googleUrl } = useQuery({
    queryKey: ["google-url"],
    queryFn: () => api.get<OAuthUrl>("/auth/google/url"),
    retry: false,
  })

  const { data: githubUrl } = useQuery({
    queryKey: ["github-url"],
    queryFn: () => api.get<OAuthUrl>("/auth/github/url"),
    retry: false,
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post("/auth/login", {
        email,
        password,
        turnstileToken: DEV_TURNSTILE_TOKEN,
      })
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to compete and win prizes</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          {error && <ErrorBanner message={error} />}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={!googleUrl?.url} className="w-full">
              <a href={googleUrl?.url ?? "#"}>Google</a>
            </Button>
            <Button variant="outline" disabled={!githubUrl?.url} className="w-full">
              <a href={githubUrl?.url ?? "#"} className="flex items-center gap-2">
                <Github className="h-4 w-4" /> GitHub
              </a>
            </Button>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" loading={busy}>
              <LogIn className="h-4 w-4" /> Sign in
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link href="/register" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
