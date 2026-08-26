import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Coding contests",
  description:
    "Browse live, upcoming and settled ₹20 coding contests on SkillHill. Join a contest, solve the problems, top the leaderboard and win prize money.",
  alternates: { canonical: "/contests" },
}

export default function ContestsLayout({ children }: { children: React.ReactNode }) {
  return children
}
