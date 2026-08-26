import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your SkillHill profile, avatar and KYC verification.",
  robots: { index: false, follow: false },
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children
}
