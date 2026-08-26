import type { Metadata } from "next"
import { ProblemsExplorer } from "@/components/problems-explorer"

export const metadata: Metadata = {
  title: "Practice library",
  description:
    "Browse the free practice library: problems from past and live contests, filter by difficulty, type, and language.",
  alternates: { canonical: "/problems" },
}

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const initial = {
    difficulty: typeof params.difficulty === "string" ? params.difficulty : "",
    type: typeof params.type === "string" ? params.type : "",
    search: typeof params.search === "string" ? params.search : "",
  }
  return <ProblemsExplorer initial={initial} />
}
