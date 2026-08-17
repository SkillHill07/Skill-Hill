/** Paise → ₹ formatted string. */
export function inr(paise: number | null | undefined): string {
  if (paise == null) return "—"
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—"
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export const CONTEST_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  frozen: "Frozen",
  settled: "Settled",
  cancelled: "Cancelled",
}

export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  accepted: "Accepted",
  rejected: "Rejected",
  error: "Error",
  timeout: "Timeout",
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  created: "Created",
  attempted: "Attempted",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
}

export const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  flagged: "Flagged",
  banned: "Banned",
}
