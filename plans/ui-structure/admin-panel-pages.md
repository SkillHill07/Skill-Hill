# Admin Panel Pages & UI Structure

## Next.js 16 Compliance Rules

Same rules as the website app (`apps/admin` also uses Next.js 16):

- `proxy.ts` replaces `middleware.ts` (no Edge runtime)
- `params` and `searchParams` must be awaited
- `"use cache"` directive for caching
- Turbopack is the default bundler
- No `next lint` — use ESLint directly
- No `unstable_*` APIs

## Overall Layout

```
┌───────────────────────────────────────────────────────────────┐
│  Sidebar (narrow, collapsible)       │  Main Content Area     │
│                                      │                        │
│  ┌─────────────────────────────────┐ │  ┌───────────────────┐ │
│  │ Logo                            │ │  │ Top Bar           │ │
│  │                                 │ │  │ [Search] [Admin] ▼│ │
│  │ ● Dashboard                     │ │  ├───────────────────┤ │
│  │ ● Contests                      │ │  │                   │ │
│  │ ● Users                         │ │  │   Page Content    │ │
│  │ ● Payments                      │ │  │                   │ │
│  │ ● Analytics                     │ │  │                   │ │
│  │ ● Audit Log                     │ │  │                   │ │
│  │ ● Settings                      │ │  │                   │ │
│  │                                 │ │  │                   │ │
│  └─────────────────────────────────┘ │  └───────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

## Page Directory

```
apps/admin/src/app/
├── layout.tsx                   # Root layout with Sidebar + TopBar
├── page.tsx                     # Dashboard overview
├── contests/
│   ├── page.tsx                 # Contest list (CRUD)
│   ├── new/page.tsx             # Create contest form
│   └── [id]/
│       ├── page.tsx             # Contest detail/edit
│       ├── problems/
│       │   ├── page.tsx         # Problem list
│       │   ├── new/page.tsx     # Add problem form
│       │   └── [problemId]/
│       │       ├── page.tsx     # Edit problem
│       │       └── test-cases/
│       │           └── page.tsx # Test case management
│       └── participants/
│           └── page.tsx         # Participant list
├── users/
│   └── page.tsx                 # User management
├── payments/
│   ├── page.tsx                 # Payment list
│   └── refunds/
│       └── page.tsx             # Refund management
├── analytics/
│   └── page.tsx                 # Platform analytics
├── audit/
│   └── page.tsx                 # Audit log viewer
└── settings/
    └── page.tsx                 # System settings
```

## Component Trees

### Dashboard Page
```
AdminDashboard
├── StatsCards
│   ├── TotalContestsStat
│   ├── ActiveContestsStat
│   ├── TotalUsersStat
│   ├── TotalRevenueStat (in ₹)
│   └── PendingPayoutsStat
├── RecentContestsWidget
│   └── ContestMiniTable[]
│       ├── ContestName
│       ├── Status (with color badge)
│       ├── Participants
│       └── Actions (View/Edit)
├── RecentPaymentsWidget
│   └── PaymentMiniTable[]
│       ├── User
│       ├── Contest
│       ├── Amount (₹20)
│       └── Status (paid/refunded)
└── QuickActions
    ├── CreateContestButton
    ├── ViewAuditLogButton
    └── ManageUsersButton
```

### Contest List Page
```
ContestListPage
├── PageHeader
│   ├── Title
│   ├── CreateContestButton
│   └── FilterControls (status, date range)
├── ContestTable (shadcn/ui Table)
│   └── ContestRow[]
│       ├── Title
│       ├── Status (draft/active/frozen/settled/cancelled)
│       ├── DateRange (start - end)
│       ├── ParticipantsCount
│       ├── RevenueCollected (entryFee × participants)
│       ├── PrizePool
│       └── Actions
│           ├── ViewButton → /contests/[id]
│           ├── EditButton → /contests/[id] (draft only)
│           ├── PublishButton (draft → active)
│           ├── FreezeButton (active → frozen)
│           ├── SettleButton (frozen → settled)
│           ├── CancelButton (→ cancelled)
│           └── DeleteButton (draft only)
└── Pagination
```

### Create / Edit Contest Form
```
ContestForm
├── FormField: Title (input)
├── FormField: Slug (input, auto-generated from title)
├── FormField: Description (rich text editor)
├── FormField: StartTime (datetime picker)
├── FormField: EndTime (datetime picker)
├── FormField: EntryFee (number, in ₹ — converted to paise)
├── FormField: PrizePool (number, in ₹ — converted to paise)
├── FormField: MaxParticipants (number, optional)
├── FormField: Rules (markdown editor)
├── FormField: PrizeDistribution (table of rank→percentage)
├── FormActions: [Save Draft] [Save & Publish]
└── ValidationSummary (inline Zod errors)
```

### Problem Management Page
```
ProblemListPage
├── PageHeader
│   ├── ContestName + Breadcrumb
│   └── AddProblemButton
├── ProblemTable
│   └── ProblemRow[]
│       ├── Order
│       ├── Title
│       ├── Difficulty (Easy/Medium/Hard badge)
│       ├── Points
│       ├── TestCases (public/hidden count)
│       └── Actions (Edit, Delete, Reorder)
└── DragAndDropReorder (optional)
```

### Problem Form
```
ProblemFormPage (Admin)
├── PageHeader: "Add Problem to [Contest]"
├── Form
│   ├── Title (input)
│   ├── Difficulty (select: Easy/Medium/Hard)
│   ├── Points (number)
│   ├── TimeLimit (number, ms)
│   ├── MemoryLimit (number, MB)
│   ├── LanguageSupport (multi-select)
│   ├── Description (Markdown editor with preview)
│   ├── SolutionTemplates
│   │   └── Per-language code editor (Monaco)
│   ├── TestCases
│   │   └── TestCaseForm[]
│   │       ├── Input (code editor, read-only after save)
│   │       ├── ExpectedOutput (code editor)
│   │       ├── IsPublic (toggle)
│   │       └── RemoveButton
│   ├── AddTestCaseButton
│   ├── CorrectSolution (code editor, stored separately, never exposed)
│   └── FormActions: [Save] [Save & Add Another]
```

### User Management Page
```
UserManagementPage
├── PageHeader
│   ├── Title: "Users"
│   └── SearchBar (search by name/email/clerkId)
├── UserTable
│   └── UserRow[]
│       ├── Avatar + Name
│       ├── Email
│       ├── ClerkId (truncated)
│       ├── KYCStatus (verified/pending/none)
│       ├── JoinDate
│       ├── TotalContests
│       ├── TotalWins
│       ├── TotalEarnings (₹)
│       ├── Status (active/banned)
│       └── Actions
│           ├── ViewDetailsButton
│           ├── BanButton (with confirmation dialog)
│           └── UnbanButton
└── Pagination
```

### Payment Management Page
```
PaymentManagementPage
├── PageHeader
│   ├── Title: "Payments"
│   └── FilterControls (status, contest, date range)
├── PaymentTable
│   └── PaymentRow[]
│       ├── RazorpayOrderId
│       ├── RazorpayPaymentId (if paid)
│       ├── User (name + email)
│       ├── Contest (title)
│       ├── Amount (₹20)
│       ├── Status Badge (created/paid/refunded/failed)
│       ├── Date
│       └── Actions
│           ├── RefundButton (if paid)
│           └── ViewUserButton
├── RefundModal (confirmation dialog with reason input)
└── Pagination
```

### Analytics Page
```
AnalyticsPage
├── DateRangeSelector
├── StatsCards
│   ├── TotalRevenueChart (bar chart, daily/weekly)
│   ├── ContestParticipationChart (line chart)
│   ├── PopularContestsTable
│   └── UserGrowthChart
├── JudgePerformance
│   ├── AvgJudgingTimeChart
│   ├── SubmissionsPerHourChart
│   └── PassRateChart (public vs hidden)
└── ExportButtons (CSV)
```

### Audit Log Page
```
AuditLogPage
├── PageHeader
│   ├── Title: "Audit Log"
│   └── FilterControls (action type, admin user, date range)
├── AuditLogTable
│   └── AuditLogRow[]
│       ├── Timestamp
│       ├── AdminName
│       ├── ActionType (create/edit/publish/freeze/settle/refund/ban)
│       ├── ResourceType (contest/user/payment)
│       ├── ResourceId
│       ├── Details (truncated, expandable)
│       └── IPAddress
├── Pagination
└── ExportButton (CSV)
```

## Shared Components (from packages/ui)
Same shadcn/ui components as the website, plus:
- `DataTable` — sortable, filterable table with pagination
- `FormField` — form wrapper with label, error, description
- `DateTimePicker` — date+time picker (use shadcn/ui or a library)
- `RichTextEditor` — for problem description (TipTap or similar)
- `ConfirmDialog` — confirmation before destructive actions
- `StatusBadge` — contextual status indicators

## RBAC & Access Control
- `admin`: Full access to all pages and actions
- `creator`: Can create/manage contests but cannot settle/payout or manage users

## Best Practices
- Every mutation action requires confirmation dialog
- All destructive actions logged to audit
- Money fields display in ₹ but stored/transmitted as paise
- Bulk operations avoided — each action is explicit
- Admin panel has its own auth session (separate from user app)

## Skills
- frontend-design — admin panel layout
- frontend-dev — page implementations
- design-taste-frontend — professional admin theme
- security-review — access control audit
- backend-development — API integration