import { Badge } from "./ui"
import {
  CONTEST_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PRIZE_STATUS_LABELS,
  SUBMISSION_STATUS_LABELS,
} from "@/lib/format"

const contestTones: Record<string, "neutral" | "green" | "amber" | "red" | "blue" | "teal"> = {
  draft: "neutral",
  active: "green",
  frozen: "blue",
  settled: "teal",
  cancelled: "red",
}

const submissionTones: Record<string, "neutral" | "green" | "amber" | "red" | "blue" | "teal"> = {
  pending: "amber",
  running: "blue",
  accepted: "green",
  rejected: "red",
  error: "red",
  timeout: "amber",
}

const paymentTones: Record<string, "neutral" | "green" | "amber" | "red" | "blue" | "teal"> = {
  created: "neutral",
  attempted: "blue",
  paid: "green",
  failed: "red",
  refunded: "amber",
}

const prizeTones: Record<string, "neutral" | "green" | "amber" | "red" | "blue" | "teal"> = {
  pending: "amber",
  credited: "green",
  failed: "red",
}

export function ContestStatusBadge({ status }: { status: string }) {
  return <Badge tone={contestTones[status] ?? "neutral"}>{CONTEST_STATUS_LABELS[status] ?? status}</Badge>
}

export function SubmissionStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={submissionTones[status] ?? "neutral"}>
      {SUBMISSION_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return <Badge tone={paymentTones[status] ?? "neutral"}>{PAYMENT_STATUS_LABELS[status] ?? status}</Badge>
}

export function PrizeStatusBadge({ status }: { status: string }) {
  return <Badge tone={prizeTones[status] ?? "neutral"}>{PRIZE_STATUS_LABELS[status] ?? status}</Badge>
}
