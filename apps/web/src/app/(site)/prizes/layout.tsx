import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "My prizes",
  description: "Prize money you have won in SkillHill contests.",
  robots: { index: false, follow: false },
}

export default function PrizesLayout({ children }: { children: React.ReactNode }) {
  return children
}
