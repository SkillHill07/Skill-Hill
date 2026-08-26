import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Reset password",
  description: "Request a password reset link for your SkillHill account.",
}

export default function ForgotpasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
