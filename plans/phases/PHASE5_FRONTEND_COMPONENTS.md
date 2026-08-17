# Phase 5: Frontend Components

## Objective
Build the LeetCode-style user interface and admin panel with all contest, payment, and code submission flows.

## Critical: Next.js 16 Compliance

This phase targets **Next.js 16**. Before writing any frontend code, research the current Next.js 16 docs. The following patterns are **forbidden** as they are removed/deprecated:

| Deprecated Pattern | Next.js 16 Replacement |
|---|---|
| `middleware.ts` | `proxy.ts` with `export function proxy()` |
| `params` / `searchParams` as sync | `const { slug } = await props.params` |
| `revalidateTag(tag)` single-arg | `revalidateTag(tag, 'max')` or `updateTag(tag)` |
| `next lint` | Use ESLint directly |
| `serverRuntimeConfig` | Environment variables |
| `experimental.ppr` / `dynamicIO` | Removed — use `"use cache"` |
| `unstable_*` APIs | Stable equivalents (check current docs) |
| webpack config without flag | Use `turbopack.rules` or `--webpack` flag |
| `fetch()` caching defaults | Explicit `"use cache"` directive |
| Parallel route slots without `default.js` | Add `default.tsx` for every `@slot` |

**Every developer must research current Next.js 16 patterns before implementation.** Assume any tutorial or pattern from 2024 or earlier is outdated.

## Tasks

### 1. Website Pages (apps/web)

#### 1.1 Home / Contest Listing Page
- **File**: `apps/web/src/app/page.tsx` (already exists, update)
- **Components**: ContestCard, ContestList,FilterBar
- **Features**: List upcoming/active contests, filter by status, pagination
- **Skill**: frontend-dev, design-taste-frontend
- **Best Practices**:
  - Server Component by default, use TanStack Query for live data
  - Use shadcn/ui Card components
  - Show contest name, date, prize pool, entry fee, participant count

#### 1.2 Contest Detail Page
- **File**: `apps/web/src/app/contests/[id]/page.tsx`
- **Components**: ContestHeader, ProblemList, LeaderboardPreview, JoinButton
- **Features**:
  - Show contest details including rules
  - List of problems with difficulty badges
  - Leaderboard preview (top 10)
  - Join with ₹20 payment button
- **Skill**: frontend-dev, frontend-design

#### 1.3 Payment / Checkout Modal
- **File**: `apps/web/src/modules/payment/components/PaymentModal.tsx`
- **Components**: PaymentModal, RazorpayButton
- **Features**: Razorpay Checkout integration, payment status display
- **Skill**: razorpay, frontend-dev
- **Best Practices**:
  - Create order via API → open Razorpay checkout with `order_id`
  - Never trust client-side payment success; wait for webhook
  - Show loading/processing state after payment
  - On webhook confirmation, redirect to contest workspace

#### 1.4 Contest Workspace (LeetCode-style)
- **File**: `apps/web/src/app/contests/[id]/workspace/page.tsx`
- **Components**: WorkspaceLayout, ProblemPanel, CodeEditor, TestCasePanel, SubmissionPanel
- **Layout**:
  ```
  ┌──────────────────────────────────────────────────┐
  │  Header: Timer, Problem Selector, Submit Button  │
  ├──────────────────────┬───────────────────────────┤
  │  Problem Panel        │  Code Editor              │
  │  (description,        │  (Monaco Editor)          │
  │   examples, notes)    │                           │
  │                       ├───────────────────────────┤
  │                       │  Test Case Panel           │
  │                       │  (run / submit, results)   │
  └──────────────────────┴───────────────────────────┘
  ```
- **Skill**: frontend-dev, design-taste-frontend, frontend-design-review
- **Best Practices**:
  - Monaco Editor for code editing (lazy loaded)
  - Resizable panels
  - Keyboard shortcuts (Ctrl+Enter to submit)
  - Tab management for multiple problems
  - Auto-save code to localStorage as draft

#### 1.5 Problem Panel
- **File**: `apps/web/src/modules/contest/components/ProblemPanel.tsx`
- **Features**: Scrollable problem description with Markdown rendering, examples display
- **Skill**: frontend-dev

#### 1.6 Code Editor
- **File**: `apps/web/src/modules/submit/components/CodeEditor.tsx`
- **Features**:
  - Monaco Editor with language selection
  - Syntax highlighting, line numbers
  - Theme toggle (dark/light)
- **Dependencies**: `@monaco-editor/react`
- **Skill**: frontend-dev
- **Best Practices**:
  - Lazy load Monaco Editor (large bundle)
  - Debounce auto-save

#### 1.7 Submission Results Panel
- **File**: `apps/web/src/modules/submit/components/SubmissionResults.tsx`
- **Features**: Display test case results (passed/failed), execution time, score
- **Skill**: frontend-dev
- **Best Practices**:
  - Animated result reveal
  - Color-code: green = pass, red = fail

#### 1.8 Leaderboard Page
- **File**: `apps/web/src/app/contests/[id]/leaderboard/page.tsx`
- **Components**: LeaderboardTable, LeaderboardRow, UserRank
- **Features**: Full contest leaderboard with real-time updates
- **Skill**: frontend-dev, performance
- **Best Practices**:
  - Virtual scrolling for large leaderboards
  - TanStack Query with short staleTime for live data
  - Highlight current user's row

#### 1.9 User Dashboard
- **File**: `apps/web/src/app/dashboard/page.tsx`
- **Components**: DashboardStats, ContestHistory, PaymentHistory
- **Features**: View past contests, results, payment history
- **Skill**: frontend-dev

#### 1.10 Timer Component
- **File**: `apps/web/src/modules/contest/components/ContestTimer.tsx`
- **Features**: Live countdown timer synced with server time
- **Skill**: frontend-dev
- **Best Practices**:
  - Sync with server time on mount (fetch server timestamp)
  - Use `use interval` for countdown
  - Auto-submit when timer reaches zero
  - Display in HH:MM:SS format

### 2. Admin Panel Pages (apps/admin)

#### 2.1 Admin Login & Layout
- **File**: `apps/admin/src/app/layout.tsx`
- **Components**: AdminLayout, AdminSidebar, AdminHeader
- **Features**: Separate auth from user app, RBAC roles
- **Skill**: frontend-dev, design-taste-frontend

#### 2.2 Contest Management Dashboard
- **File**: `apps/admin/src/app/contests/page.tsx`
- **Components**: ContestTable, CreateContestButton, ContestFilters
- **Features**: List all contests with status, CRUD operations
- **Skill**: frontend-dev

#### 2.3 Create/Edit Contest Form
- **File**: `apps/admin/src/app/contests/new/page.tsx`
- **Components**: ContestForm, DateTimePicker, PrizePoolInput
- **Features**: Form with validation, state transition buttons (publish/cancel/settle)
- **Skill**: frontend-dev

#### 2.4 Problem Management
- **File**: `apps/admin/src/app/contests/[id]/problems/page.tsx`
- **Components**: ProblemList, ProblemForm, TestCaseEditor, CorrectSolutionInput
- **Features**: Add/edit/remove problems, define test cases, set correct answer
- **Skill**: frontend-dev, security-review
- **Best Practices**:
  - Hidden test cases and solutions always submitted via separate protected fields
  - Warning before publishing if problems incomplete

#### 2.5 User Management
- **File**: `apps/admin/src/app/users/page.tsx`
- **Components**: UserTable, UserDetailPanel, BanButton
- **Features**: List users, view details, ban/unban
- **Skill**: frontend-dev
- **Best Practices**:
  - Admin actions logged to audit collection

#### 2.6 Payment Management
- **File**: `apps/admin/src/app/payments/page.tsx`
- **Components**: PaymentTable, RefundButton
- **Features**: View all payments, issue refunds
- **Skill**: frontend-dev, razorpay

#### 2.7 Analytics Page
- **File**: `apps/admin/src/app/analytics/page.tsx`
- **Components**: StatsCards, RevenueChart, ContestParticipationChart
- **Features**: Platform usage analytics, revenue stats
- **Skill**: frontend-dev

#### 2.8 Audit Log
- **File**: `apps/admin/src/app/audit/page.tsx`
- **Components**: AuditLogTable, AuditLogFilters
- **Features**: View admin action audit trail
- **Skill**: frontend-dev

## Deliverables
- Complete LeetCode-style contest workspace
- Contest listing and detail pages
- Razorpay checkout flow
- Real-time leaderboard
- Admin panel with full CRUD
- Responsive design

## Dependencies
- Phase 2 (Contest APIs)
- Phase 3 (Payment APIs)
- Phase 4 (Submission APIs)

## Verification
- Workspace loads contest problems
- Code editor accepts input, syntax highlights
- Submission flow works end-to-end
- Leaderboard updates after submissions
- Admin CRUD operations work
- **`pnpm build` passes** (Next.js 16 Turbopack build — no webpack config errors)
- **No deprecated APIs** used (middleware.ts, sync params, single-arg revalidateTag, etc.)
- **All `params`/`searchParams` are awaited** (`await props.params` pattern)