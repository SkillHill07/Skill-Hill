# Website Pages & UI Structure (LeetCode-Style)

## Next.js 16 Compliance Rules

This entire page tree runs on **Next.js 16**. Before implementing any page, research the current Next.js 16 patterns. Key requirements:

- **`middleware.ts` → `proxy.ts`**: If middleware logic is needed, use `proxy.ts` with `export function proxy()`. No Edge runtime — proxy uses Node.js only.
- **Async params**: Every `params` and `searchParams` access must be awaited: `const { slug } = await props.params`.
- **Use `"use cache"` directive** for caching, not implicit `fetch` caching or old ISR patterns.
- **Turbopack is default**: No custom webpack configs unless using `--webpack` flag. Use `turbopack.rules` for loaders.
- **No `next lint`**: Use `eslint` directly in scripts.
- **No `unstable_*` APIs**: All experimental APIs removed — use stable equivalents.

> All component code must pass `pnpm build` with Next.js 16's Turbopack bundler. If a pattern doesn't build, check the current Next.js 16 docs before attempting workarounds.

## Overall Layout Structure

```
┌────────────────────────────────────────────────────────────┐
│  Navbar (Logo, Contests, Dashboard, Profile, Auth Status)  │
├────────────────────────────────────────────────────────────┤
│                        Page Content                        │
├────────────────────────────────────────────────────────────┤
│  Footer (Links, Terms, Privacy)                            │
└────────────────────────────────────────────────────────────┘
```

## Page Directory

```
apps/web/src/app/
├── page.tsx                    # Home — hero, winners marquee, stats, contests
├── layout.tsx                  # Root layout (Navbar + Footer)
├── contests/
│   ├── page.tsx                # All contests page
│   └── [id]/
│       ├── page.tsx            # Contest details
│       ├── workspace/
│       │   └── page.tsx        # LeetCode-style workspace (Main)
│       └── leaderboard/
│           └── page.tsx        # Contest leaderboard
├── problems/
│   ├── page.tsx                # Practice library (search, difficulty/type filters)
│   └── [id]/
│       └── page.tsx            # Problem practice (outside contest)
├── dashboard/
│   └── page.tsx                # User dashboard
├── profile/
│   └── page.tsx                # User profile
└── kyc/
    └── page.tsx                # KYC form (PAN, UPI)
```

## LeetCode-Style Workspace Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Workspace Header                                                          │
│  [← Back] Contest: "Weekly Challenge #1"  Timer: 01:23:45  [Submit] [Run] │
├────────────────────────────────┬───────────────────────────────────────────┤
│  Problem Panel (left)          │  Code Editor (right)                      │
│                                │                                           │
│  ┌──────────────────────────┐  │  ┌─────────────────────────────────────┐ │
│  │ Problem Selector         │  │  │ Toolbar: Language ▼  Theme ▼       │ │
│  │ [Problem 1] [Problem 2]  │  │  ├─────────────────────────────────────┤ │
│  │ [Problem 3] [Problem 4]  │  │  │                                     │ │
│  └──────────────────────────┘  │  │  1  function twoSum(nums, target) { │ │
│                                │  │  2    const map = new Map();        │ │
│  ┌──────────────────────────┐  │  │  3    for (let i = 0; i < ...)     │ │
│  │ Problem Description      │  │  │  4      const diff = target - ...  │ │
│  │ (Markdown rendered)      │  │  │  5      if (map.has(diff)) {       │ │
│  │                          │  │  │  6        return [map.get(diff), i];│ │
│  │ ## Two Sum               │  │  │  7      }                          │ │
│  │ Given an array of...     │  │  │  8      map.set(nums[i], i);       │ │
│  │                          │  │  │  9    }                            │ │
│  │ **Example 1:**           │  │  │ 10    return [];                   │ │
│  │ Input: nums = [2,7,...]  │  │  │ 11  }                             │ │
│  │ Output: [0,1]            │  │  │                                     │ │
│  │                          │  │  └─────────────────────────────────────┘ │
│  │ Constraints:             │  ├───────────────────────────────────────────┤
│  │ - 2 <= nums.length...    │  │  Test Case Panel (bottom)                │
│  │                          │  │  ┌─────────────────────────────────────┐ │
│  └──────────────────────────┘  │  │ [Run] [Submit]  [▶] Test Case 1    │ │
│                                │  │ Input: [2,7,11,15], 9              │ │
│                                │  │ Expected: [0,1]   Actual: [0,1]    │ │
│                                │  │ ✓ Passed (0.12ms)                  │ │
│                                │  ├─────────────────────────────────────┤ │
│                                │  │ [▶] Test Case 2                     │ │
│                                │  │ Input: [3,2,4], 6                   │ │
│                                │  │ Expected: [1,2]   Actual: [1,2]    │ │
│                                │  │ ✓ Passed (0.08ms)                   │ │
│                                │  └─────────────────────────────────────┘ │
└────────────────────────────────┴───────────────────────────────────────────┘
```

## Component Tree

### Home Page
```
HomePage
├── HeroSection (landing page if not signed in)
├── ContestList
│   ├── ContestFilters (status, language, prize range)
│   └── ContestCard[]
│       ├── ContestTitle
│       ├── ContestDateRange
│       ├── PrizePoolBadge
│       ├── EntryFeeBadge ("₹20")
│       ├── ParticipantCount
│       └── StatusBadge (Active/Upcoming/Ended)
└── Pagination
```

### Contest Detail Page
```
ContestDetailPage
├── ContestHeader
│   ├── ContestTitle
│   ├── StatusBadge
│   ├── Timer (start countdown or end countdown)
│   ├── PrizePool
│   ├── ParticipantCount
│   └── JoinButton (if active and not joined)
├── ContestTabs
│   ├── ProblemsTab
│   │   └── ProblemList
│   │       └── ProblemCard[]
│   │           ├── ProblemTitle
│   │           ├── DifficultyBadge (Easy/Medium/Hard)
│   │           ├── Points
│   │           └── Status (solved/unsolved)
│   ├── LeaderboardTab
│   │   └── LeaderboardPreview (top 10)
│   └── RulesTab
│       └── MarkdownRenderer (contest rules)
└── ContestFooter
```

### Contest Workspace (LeetCode-Style)
```
WorkspacePage
├── WorkspaceHeader
│   ├── BackButton
│   ├── ContestTitle
│   ├── Timer (HH:MM:SS countdown)
│   ├── ProblemSelector (dropdown/tabs)
│   └── ActionButtons (Run, Submit)
├── ResizableSplitPanel
│   ├── ProblemPanel (left)
│   │   ├── ProblemTitle
│   │   ├── DifficultyBadge
│   │   ├── ProblemDescription (Markdown rendered with Math support)
│   │   ├── Examples
│   │   │   └── ExampleBox[]
│   │   ├── Constraints
│   │   └── NotesSection
│   └── EditorPanel (right)
│       ├── EditorToolbar
│       │   ├── LanguageSelector
│       │   ├── ThemeToggle (dark/light)
│       │   ├── FontSizeControl
│       │   └── ResetCodeButton
│       ├── MonacoEditor (lazy loaded)
│       ├── TestCasePanel
│       │   ├── TabView (Test Cases / Results)
│       │   ├── TestCaseInput[]
│       │   │   ├── InputEditor
│       │   │   ├── ExpectedOutput
│       │   │   ├── RunButton
│       │   │   └── ResultDisplay (✓/✗)
│       │   └── SubmissionResults
│       │       ├── ResultSummary (passed/total)
│       │       ├── TestResultRow[]
│       │       │   ├── TestCaseName
│       │       │   ├── passed/icon
│       │       │   ├── ExecutionTime
│       │       │   └── Output (expandable)
│       │       └── ScoreDisplay
│       └── ConsoleOutput
└── SubmissionStatusToast (WebSocket-driven notifications)
```

### Leaderboard Page
```
LeaderboardPage
├── LeaderboardHeader
│   ├── ContestTitle
│   ├── RefreshButton
│   └── ParticipantCount
├── LeaderboardTable
│   ├── TableHeader (Rank, User, Score, Solved, Time)
│   └── LeaderboardRow[]
│       ├── RankBadge (🥇🥈🥉 for top 3)
│       ├── UserAvatar + Name
│       ├── Score
│       ├── ProblemsSolved
│       ├── TotalTime
│       └── IsCurrentUser highlight
└── Pagination / VirtualScroll
```

### User Dashboard
```
DashboardPage
├── DashboardHeader
│   ├── WelcomeMessage
│   └── QuickStats (Total Contests, Wins, Total Prize Won)
├── DashboardTabs
│   ├── ContestHistoryTab
│   │   └── ContestHistoryTable
│   │       └── HistoryRow[]
│   │           ├── ContestName
│   │           ├── Date
│   │           ├── Rank
│   │           ├── Score
│   │           └── PrizeWon
│   ├── PaymentHistoryTab
│   │   └── PaymentTable
│   │       └── PaymentRow[]
│   │           ├── ContestName
│   │           ├── Amount (₹20)
│   │           ├── Status (paid/refunded)
│   │           └── Date
│   └── KYCStatusTab
│       ├── KYCStatus (verified/pending/missing)
│       └── CompleteKYCButton
└── UpcomingContests Preview
```

## Shared Components (packages/ui)
- `Button` — shadcn/ui button
- `Card`, `CardHeader`, `CardContent` — shadcn/ui card
- `Badge` — difficulty/status badges
- `Avatar` — user avatar
- `Input`, `Textarea` — form inputs
- `Dialog` — modals
- `Tabs` — tab navigation
- `Select` — dropdowns
- `Table` — data tables
- `Toast` — notifications
- `Skeleton` — loading states
- `Tooltip` — hover tooltips
- `ResizablePanel` — split pane layout (custom)

## Theme
- Dark mode by default (LeetCode-style)
- Light mode toggle
- Use `next-themes` for theme switching
- Colors: slate/neutral gray backgrounds, accent colors for difficulty (green=Easy, orange=Medium, red=Hard)

## State Management
- **Server state**: TanStack Query (React Query) for all API data
- **Editor state**: Monaco Editor's built-in state model
- **UI state**: React useState/useReducer
- **Auth state**: Clerk `useUser()` / `useAuth()`
- **WebSocket state**: Custom `useWebSocket` hook

## Skills
- frontend-dev — all page implementations
- design-taste-frontend — LeetCode-inspired design
- frontend-design-review — code review for design quality
- performance — editor lazy loading, virtual scrolling
- accessibility — WCAG compliance for contest workspace