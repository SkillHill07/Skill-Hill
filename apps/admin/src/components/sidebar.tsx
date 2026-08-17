"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CreditCard,
  Globe,
  History,
  LayoutDashboard,
  Languages,
  LogOut,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react"
import { api } from "@/lib/api"
import { cn } from "@skillcontest/ui"

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/contests", label: "Contests", icon: Trophy },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/kyc", label: "KYC reviews", icon: ShieldCheck },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/audit", label: "Audit log", icon: History },
  { href: "/admin/languages", label: "Languages", icon: Languages },
  { href: "/admin/site", label: "Site content", icon: Globe },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: me } = useQuery({
    queryKey: ["admin-me"],
    queryFn: () => api.get<{ firstName: string; lastName: string; email: string; role: string }>("/auth/me"),
    retry: false,
  })

  async function logout() {
    try {
      await api.post("/auth/logout", {})
    } catch {
      // ignore
    }
    queryClient.clear()
    router.push("/admin/login")
    router.refresh()
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <Trophy className="h-5 w-5 text-indigo-500" />
        <span className="font-bold tracking-tight">SkillsArena Admin</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border p-3">
        {me && (
          <div className="mb-2 flex items-center gap-2 px-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              {me.firstName?.[0] ?? "A"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{me.firstName} {me.lastName}</p>
              <p className="truncate text-xs text-muted-foreground">{me.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-red-500"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>
    </aside>
  )
}
