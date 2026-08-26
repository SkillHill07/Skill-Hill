"use client"

import { useEffect } from "react"
import Link from "next/link"

/**
 * Root error boundary. Converts unexpected runtime failures into a friendly,
 * actionable screen while logging the error for developers.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-6xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
        Something went wrong
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        This page hit an unexpected error
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        It&apos;s not you — we hit a snag loading this page. Try again, or head
        back to the contests list while we sort it out.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-orange-600 px-4 text-sm font-medium text-white transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
        >
          Try again
        </button>
        <Link
          href="/contests"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Browse contests
        </Link>
      </div>
      {error.digest && (
        <p className="mt-8 text-xs text-muted-foreground">Error reference: {error.digest}</p>
      )}
    </main>
  )
}
