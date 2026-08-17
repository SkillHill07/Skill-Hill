import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <span className="font-bold">SkillHill</span> — skill-based coding contests
        </p>
        <div className="flex items-center gap-6">
          <Link href="/contests" className="transition-colors hover:text-foreground">
            Contests
          </Link>
          <Link href="/dashboard" className="transition-colors hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/login" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  )
}
