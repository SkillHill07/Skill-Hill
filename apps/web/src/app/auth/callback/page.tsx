"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Card, CardContent, ErrorBanner, Spinner } from "@/components/ui"

function OAuthCallbackInner() {
  const router = useRouter()
  const params = useSearchParams()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(
    params.get("error") ?? null,
  )

  useEffect(() => {
    if (params.get("error")) return
    let cancelled = false

    async function settle() {
      try {
        // Verify the session cookie actually landed (cross-domain cookie
        // failures surface here instead of as a silent broken login).
        await api.get("/auth/me")
        if (cancelled) return
        await queryClient.invalidateQueries({ queryKey: ["me"] })
        router.replace(params.get("isNewUser") === "true" ? "/dashboard?welcome=1" : "/dashboard")
      } catch {
        if (!cancelled) {
          setError("We couldn't complete the sign-in. Please try again.")
        }
      }
    }

    void settle()
    return () => {
      cancelled = true
    }
  }, [params, queryClient, router])

  if (error) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col gap-4 p-6">
          <ErrorBanner message={error} />
          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-orange-600 px-4 text-sm font-medium text-white transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            Back to sign in
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <Spinner />
        <p className="text-sm font-medium text-foreground">Signing you in…</p>
        <p className="text-sm text-muted-foreground">This will only take a moment.</p>
      </CardContent>
    </Card>
  )
}

export default function AuthCallbackPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col items-center justify-center px-4">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center gap-3 p-10">
              <Spinner />
              <p className="text-sm text-muted-foreground">Signing you in…</p>
            </CardContent>
          </Card>
        }
      >
        <OAuthCallbackInner />
      </Suspense>
    </main>
  )
}
