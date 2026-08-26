import type { Metadata } from "next"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

interface ContestMeta {
  title: string
  description?: string
  prizePool: number
  status: string
}

/** Dynamic SEO for contest detail pages; falls back silently on API errors. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  let contest: ContestMeta | null = null
  try {
    const res = await fetch(`${API_URL}/contests/${id}`, { cache: "no-store" })
    const body = (await res.json()) as { success?: boolean; data?: ContestMeta }
    if (res.ok && body?.success && body.data) {
      // Draft contests are not publicly visible — keep them unindexed.
      if (body.data.status === "draft") return { robots: { index: false, follow: false } }
      contest = body.data
    }
  } catch {
    // fall through to default metadata
  }

  if (!contest) {
    return { title: "Contest", robots: { index: false, follow: true } }
  }

  const title = `${contest.title} — coding contest`
  const description =
    contest.description?.slice(0, 155) ??
    `Join this SkillHill coding contest and compete for ${contest.prizePool > 0 ? "prize money" : "glory"}.`

  return {
    title,
    description,
    alternates: { canonical: `/contests/${id}` },
    openGraph: { title, description, type: "website" },
  }
}

export default function ContestLayout({ children }: { children: React.ReactNode }) {
  return children
}
