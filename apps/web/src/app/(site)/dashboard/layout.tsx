import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your contest dashboard â€” balance, recent activity and quick links.",
  robots: { index: false, follow: false },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
