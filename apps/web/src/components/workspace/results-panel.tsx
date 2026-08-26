"use client"

import { useState } from "react"
import { CheckCircle2, Clock, MemoryStick, Terminal, XCircle, Zap } from "lucide-react"
import type { SubmissionTestCaseResult } from "@skillcontest/shared-types"
import { Badge } from "@/components/ui"
import { cn } from "@skillcontest/ui"

export interface WorkspaceSubmission {
  _id: string
  mode: "run" | "submit"
  status: string
  totalScore: number
  publicPassed: number
  publicTotal: number
  hiddenPassed: number
  hiddenTotal: number
  executionTime: number
  memoryUsed: number
  compilerOutput: string | null
  testResults: SubmissionTestCaseResult[]
}

type Panel = "tests" | "compiler" | "history"

/**
 * Judge results panel for the workspace: per-test-case outcomes, compiler
 * output, runtime/memory stats. Mirrors the information density of a modern
 * competitive-programming judge without copying its chrome.
 */
export function ResultsPanel({
  submission,
  liveStatus,
  history,
}: {
  submission: WorkspaceSubmission | null
  liveStatus: string | null
  history: Array<{ id: string; mode: string; status: string; score: number; at: Date }>
}) {
  const [tab, setTab] = useState<Panel>("tests")

  const isPending =
    liveStatus === "pending" || liveStatus === "queued" || liveStatus === "running"
  const isFinal =
    submission &&
    ["accepted", "rejected", "error", "timeout"].includes(submission.status)

  const tabs: Array<{ key: Panel; label: string; badge?: number }> = [
    { key: "tests", label: "Test cases" },
    { key: "compiler", label: "Compiler output", badge: submission?.compilerOutput ? 1 : undefined },
    { key: "history", label: "History", badge: history.length || undefined },
  ]

  return (
    <section aria-label="Judge results" className="flex flex-col">
      {/* Tab bar */}
      <div role="tablist" aria-label="Results sections" className="flex items-center gap-1 border-b border-border px-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-orange-600 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.badge ? (
              <Badge tone="slate" className="px-1.5 py-0">{t.badge}</Badge>
            ) : null}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* Status line */}
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {isPending ? (
            <span className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
              <Zap className="h-4 w-4 animate-pulse" aria-hidden />
              {liveStatus === "running" ? "Running…" : "Queued…"}
            </span>
          ) : isFinal && submission ? (
            submission.status === "accepted" ? (
              <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                {submission.mode === "run" ? "Ran OK" : "Accepted"}
                {submission.mode !== "run" && ` — ${submission.totalScore} pts`}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4" aria-hidden />
                {submission.status === "rejected"
                  ? submission.mode === "run"
                    ? "Wrong answer"
                    : "Rejected"
                  : submission.status === "timeout"
                    ? "Time limit exceeded"
                    : "Error"}
                {" — "}
                {submission.publicPassed}/{submission.publicTotal} public tests passed
              </span>
            )
          ) : (
            <span className="text-muted-foreground">Run or submit to see results here.</span>
          )}

          {submission && (isFinal || !isPending) && submission.executionTime > 0 && (
            <>
              <Stat icon={<Clock className="h-3.5 w-3.5" aria-hidden />} label={`${submission.executionTime} ms`} />
              {submission.memoryUsed > 0 && (
                <Stat icon={<MemoryStick className="h-3.5 w-3.5" aria-hidden />} label={`${(submission.memoryUsed / 1024).toFixed(1)} MB`} />
              )}
            </>
          )}
        </div>

        {/* Panels */}
        {tab === "tests" && (
          <>
            {!submission || submission.testResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No test-case results yet. Use Run to check the example tests without affecting your score.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {submission.testResults.map((tc, i) => (
                  <li
                    key={tc.testCaseId || i}
                    className="rounded-lg border border-border p-3 text-xs"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium">Case {i + 1}</span>
                      <span className={tc.passed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                        {tc.passed ? "Passed" : "Failed"} · {tc.executionTime} ms
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <IOLine label="Expected" value={tc.expectedOutput} tone="neutral" />
                      <IOLine label="Actual" value={tc.output} tone={tc.passed ? "green" : "red"} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === "compiler" && (
          <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-slate-100" aria-live="polite">
            {submission?.compilerOutput || "No compile errors."}
          </pre>
        )}

        {tab === "history" && (
          <>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submissions yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2">
                      {h.status === "accepted" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" aria-hidden />
                      )}
                      {h.mode === "run" && <Badge tone="slate">Run</Badge>}
                      <span className="font-medium tabular-nums">
                        {h.mode === "run" ? `${h.score} pts` : `${h.score} pts`}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {h.at.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
      {icon}
      {label}
    </span>
  )
}

function IOLine({ label, value, tone }: { label: string; value: string; tone: "neutral" | "green" | "red" }) {
  return (
    <div>
      <p className="mb-1 font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <pre
        className={cn(
          "overflow-x-auto rounded-md bg-muted/70 p-2 font-mono",
          tone === "green" && "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300",
          tone === "red" && "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300",
        )}
      >
        {value || "(empty)"}
      </pre>
    </div>
  )
}

export function CompilerIcon() {
  return <Terminal className="h-3.5 w-3.5" aria-hidden />
}
