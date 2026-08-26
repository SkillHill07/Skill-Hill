import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Payments",
  description: "Your SkillHill payment history.",
  robots: { index: false, follow: false },
}

export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  return children
}
