import Link from "next/link"
import { Trophy } from "lucide-react"

const footerNav = [
  {
    heading: "Compete",
    links: [
      { href: "/contests", label: "Contests" },
      { href: "/problems", label: "Practice library" },
      { href: "/contests?status=upcoming", label: "Upcoming" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/wallet", label: "Wallet" },
      { href: "/prizes", label: "My prizes" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { href: "/register", label: "Create account" },
      { href: "/login", label: "Sign in" },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 font-bold tracking-tight">
            <Trophy className="h-5 w-5 text-orange-500" aria-hidden />
            SkillHill
          </p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Skill-based coding contests. Pay ₹20 to enter, solve against the
            clock, and win prize money credited straight to your wallet.
          </p>
        </div>

        {footerNav.map((group) => (
          <nav key={group.heading} aria-label={group.heading}>
            <p className="mb-3 text-sm font-semibold">{group.heading}</p>
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

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} SkillHill. All rights reserved.</p>
          <p>Prizes are credited automatically after each contest settles.</p>
        </div>
      </div>
    </footer>
  )
}
