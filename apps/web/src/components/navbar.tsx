"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Menu, Trophy, X } from "lucide-react"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { useMe } from "@/hooks/use-me"
import { Button } from "./ui"
import { ThemeToggle } from "@/components/theme-toggle"
import Announcement1 from "@/components/watermelon-ui/announcement-1"
import { cn } from "@skillcontest/ui"

const navLinks = [
  { href: "/contests", label: "Contests" },
  { href: "/problems", label: "Problems" },
  { href: "/leaderboard", label: "Leaderboard" },
]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const { data: me } = useMe()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

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
      <header
        className={cn(
          "sticky top-0 z-40 border-b border-border/60 backdrop-blur-xl transition-colors",
          scrolled ? "bg-background/95" : "bg-background/80",
        )}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
            <Trophy className="h-4 w-4 text-orange-500" aria-hidden />
            <span className="text-base">SkillHill</span>
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  pathname === l.href || pathname.startsWith(l.href + "/")
                    ? "text-foreground bg-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Desktop right */}
          <div className="hidden items-center gap-1.5 md:flex">
            <ThemeToggle />
            {me ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-md py-1.5 pl-1.5 pr-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-600 text-[11px] font-bold text-white">
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
                  className="inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-8 items-center justify-center rounded-md bg-orange-600 px-3.5 text-sm font-medium text-white transition-colors hover:bg-orange-500"
                >
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* Mobile controls */}
          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              className="cursor-pointer rounded-md p-1.5 hover:bg-accent"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <>
            <div
              className="fixed inset-0 top-14 z-30 bg-black/20 md:hidden"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <nav
              aria-label="Mobile navigation"
              className="fixed left-0 right-0 top-14 z-40 border-b border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur-xl md:hidden"
            >
              <div className="flex flex-col gap-0.5">
                {navLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-sm font-medium",
                      pathname === l.href
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {l.label}
                  </Link>
                ))}
                <div className="my-2 border-t border-border" />
                {me ? (
                  <>
                    <Link
                      href="/profile"
                      onClick={() => setOpen(false)}
                      className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent"
                    >
                      Profile
                    </Link>
                    <button
                      onClick={() => {
                        setOpen(false)
                        logout()
                      }}
                      className="rounded-md px-3 py-2.5 text-left text-sm font-medium text-red-500"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent"
                  >
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
