import Link from "next/link"
import { Code2, Infinity as InfinityIcon, ListChecks, Users } from "lucide-react"
import { ContestStatusBadge } from "./status-badge"
import { Badge, Card, CardContent } from "./ui"
import { formatDate, inr } from "@/lib/format"

export interface ContestCardData {
  _id: string
  title: string
  slug: string
  type: string
  problemType?: string
  entryFee: number
  prizePool: number
  maxParticipants: number | null
  status: string
  startTime: string
  endTime: string | null
  isEternal?: boolean
  participantCount?: number
  description?: string
}

export function ContestCard({ contest, participants }: { contest: ContestCardData; participants?: number }) {
  const count = participants ?? contest.participantCount ?? 0
  return (
    <Link href={`/contests/${contest._id}`} className="group block">
      <Card className="transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-orange-300 group-hover:shadow-md dark:group-hover:border-orange-500/50">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ContestStatusBadge status={contest.status} />
              {contest.isEternal && (
                <Badge tone="blue"><InfinityIcon className="h-3 w-3" /> Always Open</Badge>
              )}
              {contest.problemType === "mcq" && (
                <Badge tone="amber"><ListChecks className="h-3 w-3" /> MCQ</Badge>
              )}
              {contest.problemType === "coding" && (
                <Badge tone="blue"><Code2 className="h-3 w-3" /> Coding</Badge>
              )}
              {contest.problemType === "mixed" && (
                <Badge tone="teal"><Code2 className="h-3 w-3" /> Mixed</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {contest.type === "paid" && (
                <Badge tone="teal">{inr(contest.entryFee)} entry</Badge>
              )}
              <Badge tone="green">{inr(contest.prizePool)} pool</Badge>
            </div>
          </div>

          <h3 className="text-base font-semibold leading-snug transition-colors group-hover:text-orange-600 dark:group-hover:text-orange-400">
            {contest.title}
          </h3>

          {contest.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{contest.description}</p>
          )}

          <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {contest.isEternal
                ? "Always open"
                : formatDate(contest.startTime)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {count}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
