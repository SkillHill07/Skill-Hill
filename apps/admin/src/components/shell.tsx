"use client"

import { usePathname, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { api } from "@/lib/api"
import { Sidebar } from "./sidebar"
import { Spinner } from "./ui"

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const { data: me, isLoading, isError } = useQuery({
    queryKey: ["admin-me"],
    queryFn: () =>
      api.get<{ role: string }>("/auth/me").then((u) => {
        if (u.role !== "admin" && u.role !== "creator") {
          throw new Error("Not staff")
        }
        return u
      }),
    retry: false,
  })

  const isLogin = pathname.startsWith("/admin/login")

  useEffect(() => {
    if (!isLogin && !isLoading && (isError || !me)) {
      router.replace("/admin/login")
    }
    if (isLogin && me) {
      router.replace("/admin")
    }
  }, [isLogin, isLoading, isError, me, router])

  // Login page: standalone centered layout
  if (isLogin) {
    return <div className="min-h-screen">{children}</div>
  }

  if (isLoading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  )
}
