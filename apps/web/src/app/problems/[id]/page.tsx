import type { Metadata } from "next"
import { ProblemViewer } from "@/components/problem-viewer"

export const metadata: Metadata = {
  title: "Problem — SkillHill",
  description: "Practice a contest problem: read the statement, check examples, and study the template.",
}

export default async function ProblemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ProblemViewer problemId={id} />
}
