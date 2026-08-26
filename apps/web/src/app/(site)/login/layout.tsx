import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to SkillHill to join coding contests and compete for cash prizes.",
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
