"use client"

import Link from "next/link"
import { Trophy } from "lucide-react"
import { useMe } from "@/hooks/use-me"

const footerNav = [
  {
    heading: "Product",
    links: [
      { href: "/contests", label: "Contests" },
      { href: "/problems", label: "Problems" },
      { href: "/leaderboard", label: "Leaderboard" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/prizes", label: "My prizes" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
  {
    heading: "Get started",
    authOnly: true,
    links: [
      { href: "/register", label: "Create account" },
      { href: "/login", label: "Sign in" },
    ],
  },
]

export function Footer() {
  const { data: me } = useMe()
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-4 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <Trophy className="h-4 w-4 text-orange-500" aria-hidden />
              <span className="text-base">SkillHill</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Competitive coding contests with live leaderboards, instant judging,
              and automatic prize payouts.
            </p>
          </div>

          {/* Nav groups */}
          {footerNav
            .filter((group) => !group.authOnly || !me)
            .map((group) => (
              <nav key={group.heading} aria-label={group.heading}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.heading}
                </p>
                <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                  {group.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="transition-colors hover:text-foreground">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>&copy; {new Date().getFullYear()} SkillHill. All rights reserved.</p>
          <p>Prizes credited automatically after each contest settles.</p>
        </div>
      </div>
    </footer>
  )
}
