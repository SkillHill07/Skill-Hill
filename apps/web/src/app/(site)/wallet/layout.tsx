import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Wallet",
  description: "Manage your SkillHill wallet â€” deposits, withdrawals and transaction history.",
  robots: { index: false, follow: false },
}

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return children
}
