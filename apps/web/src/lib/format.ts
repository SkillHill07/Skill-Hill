/** Paise (2000 = ₹20) → ₹ formatted string. */
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

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "—"
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Seconds → HH:MM:SS (countdown). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":")
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

export const PRIZE_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  credited: "Credited",
  failed: "Failed",
}

export const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "text-emerald-600 dark:text-emerald-400",
  medium: "text-amber-600 dark:text-amber-400",
  hard: "text-rose-600 dark:text-rose-400",
}
