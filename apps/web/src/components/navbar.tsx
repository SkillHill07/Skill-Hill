"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Menu, Trophy, Wallet, X } from "lucide-react"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { useMe } from "@/hooks/use-me"
import { Button } from "./ui"
import { ThemeToggle } from "@/components/theme-toggle"
import Announcement1 from "@/components/watermelon-ui/announcement-1"
import { cn } from "@skillcontest/ui"

const links = [
  { href: "/contests", label: "Contests" },
  { href: "/problems", label: "Problems" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/wallet", label: "Wallet" },
  { href: "/prizes", label: "Prizes" },
]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: me } = useMe()

  async function logout() {
    try {
      await api.post("/auth/logout", {})
    } catch {
      // ignore — clear locally regardless
    }
    queryClient.clear()
    router.push("/")
    router.refresh()
  }

  return (
    <>
      <Announcement1 />
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <Trophy className="h-5 w-5 text-orange-500" aria-hidden />
          <span className="text-lg">SkillHill</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                pathname.startsWith(l.href)
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {me ? (
            <>
              <Link href="/wallet" className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <Wallet className="h-4 w-4" aria-hidden />
                Wallet
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 text-sm font-medium transition-colors hover:bg-accent"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">
                  {me.firstName?.[0] ?? "?"}
                </span>
                {me.firstName}
              </Link>
              <Button variant="ghost" size="sm" onClick={logout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-8 items-center justify-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-orange-600 px-3 text-sm font-medium text-white transition-colors hover:bg-orange-500"
              >
                Get started
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="cursor-pointer rounded-lg p-2 hover:bg-accent"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {/* Mobile menu overlay + panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 top-16 z-30 bg-black/20 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <nav
            aria-label="Mobile navigation"
            className="fixed left-0 right-0 top-16 z-40 border-b border-border bg-background px-4 py-3 shadow-lg md:hidden"
          >
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {l.label}
                </Link>
              ))}
              {me ? (
                <>
                  <Link href="/profile" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent">
                    Profile
                  </Link>
                  <button onClick={logout} className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-500">
                    Logout
                  </button>
                </>
              ) : (
                <Link href="/login" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent">
                  Sign in
                </Link>
              )}
            </div>
          </nav>
        </>
      )}
    </header>
    </>
  )
}
