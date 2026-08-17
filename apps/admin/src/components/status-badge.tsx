import { Badge } from "./ui"
import {
  ACCOUNT_STATUS_LABELS,
  CONTEST_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  SUBMISSION_STATUS_LABELS,
} from "@/lib/format"

const tones: Record<string, "neutral" | "green" | "amber" | "red" | "blue" | "violet"> = {
  draft: "neutral",
  active: "green",
  frozen: "blue",
  settled: "violet",
  cancelled: "red",
  pending: "amber",
  running: "blue",
  accepted: "green",
  rejected: "red",
  error: "red",
  timeout: "amber",
  created: "neutral",
  attempted: "blue",
  paid: "green",
  failed: "red",
  refunded: "amber",
  verified: "green",
  flagged: "amber",
  banned: "red",
  inactive: "neutral",
}

export function StatusBadge({ status, labels }: { status: string; labels?: Record<string, string> }) {
  return <Badge tone={tones[status] ?? "neutral"}>{labels?.[status] ?? status}</Badge>
}

export function ContestStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} labels={CONTEST_STATUS_LABELS} />
}

export function SubmissionStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} labels={SUBMISSION_STATUS_LABELS} />
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} labels={PAYMENT_STATUS_LABELS} />
}

export function AccountStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} labels={ACCOUNT_STATUS_LABELS} />
}
