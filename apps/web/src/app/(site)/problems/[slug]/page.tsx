import type { Metadata } from "next"
import { ProblemViewer } from "@/components/problem-viewer"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

interface ProblemMeta {
  title: string
  difficulty?: string
  description?: string
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  let problem: ProblemMeta | null = null
  try {
    const res = await fetch(`${API_URL}/problems/slug/${slug}`, { cache: "no-store" })
    const body = (await res.json()) as { success?: boolean; data?: ProblemMeta }
    if (res.ok && body?.success && body.data) problem = body.data
  } catch {
    // fall through to default metadata
  }

  if (!problem) {
    return { title: "Problem", robots: { index: false, follow: true } }
  }

  const difficulty = problem.difficulty ? ` (${problem.difficulty})` : ""
  return {
    title: `${problem.title}${difficulty}`,
    description:
      problem.description?.replace(/[#*`>]/g, "").slice(0, 155) ??
      `Practice problem: read the statement, check examples, and study the starter template.`,
    alternates: { canonical: `/problems/${slug}` },
    openGraph: { title: `${problem.title}${difficulty} · SkillHill`, type: "article" },
  }
}

export default async function ProblemDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <ProblemViewer problemSlug={slug} />
}
