"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Github, UserPlus } from "lucide-react"
import { api, DEV_TURNSTILE_TOKEN } from "@/lib/api"
import { Button, Card, CardContent, ErrorBanner, Input, Label } from "@/components/ui"

interface OAuthUrl {
  url: string
}

export default function RegisterPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
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
      await api.post("/auth/register", {
        firstName,
        lastName,
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
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Start competing in ₹20 coding contests</p>
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
            <span className="h-px flex-1 bg-border" /> or sign up with email <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fn">First name</Label>
                <Input id="fn" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ln">Last name</Label>
                <Input id="ln" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
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
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">At least 8 characters</p>
            </div>
            <Button type="submit" loading={busy}>
              <UserPlus className="h-4 w-4" /> Create account
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
