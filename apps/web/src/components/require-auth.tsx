"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useMe } from "@/hooks/use-me"
import { Skeleton } from "@/components/ui"

/**
 * Client-side route guard for authenticated pages. Renders a loading state
 * while the session resolves, redirects to /login?next=… when signed out,
 * and renders children once the user is confirmed.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useMe()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !me) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [isLoading, me, router, pathname])

  if (isLoading || !me) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-10">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return <>{children}</>
}
