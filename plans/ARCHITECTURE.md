# System Architecture — Module Interactions

## Core Principle
Each module owns its domain logic, data, and routes. Modules call each other's service functions (never routes) via dependency injection or direct import of the service layer. No circular dependencies.

## Module Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         apps/api/src/modules/                           │
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│  │  Auth     │    │  Contest │    │  Problem  │    │Submission│         │
│  │  (exists) │    │          │    │          │    │          │         │
│  └─────┬────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘         │
│        │              │              │              │                  │
│        │              ├──────────────┤              │                  │
│        │              │  references  │              │                  │
│        │              │  problemIds[]│              │                  │
│        │              │              │              │                  │
│        │              │              │    reads     │                  │
│        │              │              │◄─────────────┤                  │
│        │              │              │  testCases   │                  │
│        │              │              │              │                  │
│  ┌─────┴────┐    ┌────┴─────┐    ┌──┴───────┐    ┌──┴─────────┐      │
│  │  Wallet   │    │Leaderboard│  │  Judge    │    │  Payment   │      │
│  │          │    │          │    │  (worker) │    │           │      │
│  └─────┬────┘    └──────────┘    └──────────┘    └─────┬──────┘      │
│        │                                                │              │
│        │  ┌──────────┐                                 │              │
│        ├──┤  Prize    │◄───────────────────────────────┤              │
│        │  │          │  webhook → wallet.credit()      │              │
│        │  └──────────┘                                 │              │
│        │                                                │              │
│        └────────────────────────────────────────────────┘              │
│                    wallet.balance check for contest join               │
└─────────────────────────────────────────────────────────────────────────┘
```

## Module Responsibilities & Boundaries

### Contest Module
- Owns: contest lifecycle, participation tracking, state machine
- References: problems by ID (`problemIds[]`) — does NOT own problem data
- Calls: wallet service (check balance on join), prize service (trigger on settle)
- Does NOT contain: problem definitions, test cases, code execution, payments, user balance

### Problem Module
- Owns: problem definitions, test cases (public + hidden), solution templates, correct solutions
- Test cases are **embedded sub-documents** in the problem — NOT a separate module
- Scoped: problems belong to a contest (`contestId`) but could be extracted to standalone bank later
- Provides: `getTestCases(problemId, includeHidden)` — judge module calls this

### Submission Module
- Owns: submission lifecycle, result storage
- References: userId, contestId, problemId (all by ID, no ownership)
- Delegates to: judge module (via Upstash) for code execution
- Calls: leaderboard service to update scores

### Judge Module
- Owns: code execution, Docker sandbox, test case running, score calculation
- Reads from: problem module (test cases), submission module (code)
- Writes to: submission module (results)
- Runs as: Upstash worker in separate process — never in API request thread

### Payment Module
- Owns: Razorpay order creation, webhook verification, refunds
- **Does NOT** manage user balances — that's the wallet module's job
- On webhook success: calls `wallet.deposit()`
- Raw payment gateway interface only

### Wallet Module
- Owns: user balances, transactions, deposits, deductions, withdrawals
- Each user has exactly one wallet
- All money operations go through this module
- Interacts with: payment module (deposits), contest module (fee deduction), prize module (winnings credit)

### Leaderboard Module
- Owns: real-time scores (Redis), final standings (MongoDB)
- Called by: submission module after judging completes
- Read by: contest module (for prize calculation), frontend

### Prize Module
- Owns: prize distribution calculation, payout tracking
- Reads: frozen leaderboard
- Writes: wallet.credit() for each winner
- No direct Razorpay calls — payouts handled by wallet module withdrawal flow

## Data Flow: Contest Join (Complete)

```
User clicks "Join Contest (₹20)"
  → Frontend calls POST /api/contests/:id/join
  → Contest route handler (validates contest is active, not full)
  → Checks wallet.balance >= entryFee (2000 paise)
    → If insufficient: redirect to deposit flow
    → If sufficient: calls wallet.deduct(userId, entryFee, contestRef)
  → Creates participation record
  → Returns success
```

## Data Flow: Payment Deposit

```
User clicks "Add Funds" → Razorpay Checkout opens → User pays
  → Razorpay sends webhook POST /api/webhooks/razorpay
  → Payment webhook handler:
    1. Verifies HMAC signature
    2. Checks idempotency
    3. Updates payment record
    4. Calls wallet.deposit(userId, amount, paymentRef)
  → Returns 200 OK
```

## Data Flow: Submission & Judging (Full)

```
User writes code → clicks Submit
  → POST /api/contests/:id/submissions
  → Submission service:
    1. Validates user is in contest, contest is active
    2. Rate limit check (Redis)
    3. Creates submission record (status: pending)
    4. Enqueues Upstash job with { submissionId, problemId }
    5. Returns 202

Judge Worker (separate process):
  → Dequeues job
  → Reads submission (code, language)
  → Reads problem test cases via Problem service
    → Only hidden test cases at this stage (public already shown in UI)
  → For each test case:
    → Spawns Docker container
    → Feeds input, captures output
    → Compares with expected
  → Calculates score
  → Updates submission (status, results, score)
  → Calls leaderboard.updateScore(contestId, userId, newScore)
  → Emits WebSocket event to user
```

## Data Flow: Contest Settlement

```
Contest endTime reached → Upstash delayed job fires
  → freezes contest (no more submissions)
  → Snapshots leaderboard Redis → MongoDB

Admin triggers settle (or Upstash auto-settle)
  → Prize module reads frozen leaderboard
  → Calculates prize distribution
  → For each winner:
    → wallet.credit(winnerId, prizeAmount, contestRef)
  → Marks contest as settled
```

## Why Problems & Test Cases Are One Module

- Test cases have no meaning without a problem — they are inherently sub-documents
- A separate test-case module would add cross-module query complexity for no gain
- The judge worker reads test cases via the Problem service: `problemService.getTestCases(problemId, includeHidden)`
- If test cases grow very large (~100+ per problem), they can be extracted to a separate collection but still managed by the Problem module

## Why a Wallet Module Is Needed

Without wallet:
- Payment webhook directly creates participation
- Prize payout directly calls Razorpay
- No user balance, no partial deposits
- Each payment is a standalone ₹20 transaction
- Refunds go back to Razorpay, not user's account

With wallet:
- Users can deposit once, join multiple contests
- Winnings go to wallet, user chooses when to withdraw
- Refunds go back to wallet
- Platform can track total user balance
- Razorpay fees minimized (fewer transactions)
- Withdrawal flow is separate from contest flow

## Why NOT a Separate Funds Module

Platform-wide funds (revenue, platform fee) are managed via:
- Existing payment records (Razorpay)
- Wallet transaction logs
- Admin analytics dashboard queries

A separate "Funds" module would duplicate what the wallet + payment modules already track. The platform's earnings are simply: total deposits − total withdrawals − total refunds. This can be queried from transaction records.

## Module Dependency Graph

```
Auth ──────────────────────────────────────────────────┐
                                                        │
Wallet ──── depends on ──── Payment (for deposits)      │
    │                              │                    │
    ├── depends on ──── Razorpay  │                    │
    │                              │                    │
Contest ─── depends on ──── Wallet (balance check)      │
    │                              │                    │
    ├── depends on ──── Problem (problem data)          │
    │                              │                    │
Submission ─── depends on ──── Contest, Problem, Auth   │
    │                              │                    │
    ├── sends to ──── Judge (Upstash)                    │
    │                              │                    │
Judge ──── reads ──── Problem (test cases)              │
    │                              │                    │
    └── writes ──── Submission, Leaderboard              │
                        │                              │
Leaderboard ─── depends on ──── Contest                  │
                        │                              │
Prize ──── reads ──── Leaderboard                        │
    │                              │                    │
    └── writes ──── Wallet (credit winners)             │
                        │                              │
                        └── no circular deps            │
```

## Future Extraction Points (ponytail debt items)
- **Standalone problem bank**: If problems need to exist outside contests, extract `contestId` → `problemBankId` and add a many-to-many relationship
- **Separate test-case collection**: If problems exceed 50+ test cases, move to separate Mongoose collection for query performance
- **Escrow wallet**: If regulatory compliance demands, create a separate platform escrow wallet to hold contest entry fees until settlement