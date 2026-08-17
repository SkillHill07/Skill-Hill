# Contest Module Plan

## Purpose
Manage the full lifecycle of coding contests: creation, scheduling, participation, state transitions, and settlement.

## Architecture

```
apps/api/src/modules/contest/
├── contest.model.ts        # Mongoose schema
├── contest.service.ts      # Business logic
├── contest.routes.ts       # HTTP routes
├── contest.validation.ts   # Zod schemas
├── participation.model.ts  # Participation tracking
├── participation.service.ts# Join/start/submit tracking
└── index.ts                # Module exports
```

## Relationship with Other Modules

```
Contest Module (this)
  ├── references → Problem Module (problemIds[])
  ├── calls     → Wallet Module (balance check, deduct on join)
  ├── calls     → Wallet Module (refund on cancel)
  └── triggers  → Prize Module (settle → prize distribution)
```

- Contest does **not** own problem definitions or test cases
- Contest does **not** handle payments or user balances
- Contest does **not** judge submissions (delegates to Judge via Submission)

## Data Model

### Contest Schema
| Field | Type | Notes |
|-------|------|-------|
| `title` | String | Required |
| `slug` | String | Unique, URL-friendly |
| `description` | String | Markdown |
| `problemIds` | [ObjectId] | References to Problem documents — empty until admin adds problems |
| `startTime` | Date | When contest begins |
| `endTime` | Date | When contest ends |
| `type` | Enum | `free` / `paid` (default `free`) — `free` forces `entryFee = 0` |
| `entryFee` | Number | In paise (2000 = ₹20). `0` for free contests; `> 0` required for paid |
| `prizePool` | Number | Total prize pool in paise |
| `maxParticipants` | Number | Optional cap |
| `status` | Enum | `draft` → `active` → `frozen` → `settled` / `cancelled` |
| `rules` | String | Markdown contest rules |
| `createdBy` | ObjectId | Admin user |

### Participation Schema
| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId | Reference to user |
| `contestId` | ObjectId | Reference to contest |
| `joinedAt` | Date | When payment confirmed |
| `startedAt` | Date | When user started contest |
| `submittedAt` | Date | When user submitted all solutions |
| `totalScore` | Number | Cumulative score |
| `rank` | Number | Final rank (after freeze) |
| `status` | Enum | `registered`, `started`, `completed`, `timedout` |

## State Machine

```
draft ──publish──→ active ──freeze──→ frozen ──settle──→ settled
  ↑                  │                                      │
  └──edit────────────┘                                      │
                     └──cancel──→ cancelled ────────────────┘
```

- **draft**: Admin creating/editing contest
- **active**: Contest is visible and accepting participants
- **frozen**: Submissions closed (triggered by Upstash at endTime)
- **settled**: Prizes distributed
- **cancelled**: Contest cancelled, refunds issued

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/contests | Public | List active/upcoming contests |
| GET | /api/contests/:id | Public | Contest details (includes problems) |
| POST | /api/contests | Admin | Create draft |
| PATCH | /api/contests/:id | Admin | Update draft |
| POST | /api/contests/:id/publish | Admin | Publish contest |
| POST | /api/contests/:id/cancel | Admin | Cancel contest (refunds via wallet) |
| POST | /api/contests/:id/freeze | System | Freeze contest (Upstash) |
| POST | /api/contests/:id/settle | Admin | Settle contest (triggers prize distribution) |
| POST | /api/contests/:id/join | User | Join contest (checks wallet balance, deducts entry fee) |
| POST | /api/contests/:id/start | User | Start contest for user (one-time) |

## Join Flow (Wallet Integration)
```
POST /api/contests/:id/join
  → Validate: contest is active, not full, user not already registered
  → If contest.type === "paid": walletService.deduct(userId, entryFee, contestId)
    → If insufficient balance: throw error → frontend redirects to deposit
  → If contest.type === "free": skip payment entirely
  → Create participation record (status: registered)
  → Return success
```

## Free vs Paid
- `type` defaults to `free`; a free contest is forced to `entryFee = 0` at the service layer
- `paid` contests require `entryFee > 0` (Zod `superRefine` rejects missing/zero fees)
- Switching to `paid` via PATCH requires a positive `entryFee` in the same request
- The wallet module (Phase 3) skips the fee deduction for `free` contests

## Upstash Jobs
- `freeze-contest` — Delayed job at contest endTime
- `settle-contest` — Runs after freeze, triggers prize distribution

## Best Practices
- Route handlers contain zero business logic
- All inputs validated with Zod before reaching service
- State transitions enforced in service layer with preconditions
- Server-authoritative timing only (no client timestamps)
- Money stored as paise integers
- Contest **does not own problems** — references them via `problemIds[]`
- Join flow always checks wallet balance first (via wallet module)
- Cancel flow always refunds participants via wallet module

## Skills
- backend-development — core implementation
- express-typescript — route patterns
- backend-patterns — state machine, service layer
- mongodb-query-optimizer — indexes, query performance
- ponytail — debt tracking