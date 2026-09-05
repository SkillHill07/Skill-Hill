import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a free SkillHill account and join coding contests.",
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
