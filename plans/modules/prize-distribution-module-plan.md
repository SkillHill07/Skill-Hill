# Prize Distribution Module Plan

## Status — ✅ Built

Implemented in `apps/api/src/modules/prize/` (prize.model.ts, prize.service.ts, prize.validation.ts, prize.routes.ts, prize.admin.routes.ts, index.ts). **22 new tests** (14 service incl. distribution math, tie splitting, idempotency, credit-failure handling; 4 public/user routes; 4 admin routes). Typecheck + lint clean.

**Live now:**
- Distribution triggers automatically inside `contestService.settleContest` (covers both the admin settle route AND the BullMQ worker auto-settle). Pool = `entryFee × ALL paid participants` (everyone funded the pot — non-submitters forfeit the win, not their money); winners = the submitted + scored subset (score > 0). Platform keeps `PLATFORM_FEE_RATE` (env, default 0.1), net pool split per the share table (40/25/15/5/5/2×5). Winners' wallets are credited via `walletService.credit` (idempotent on `(prize, contestId)`).
- `GET /contests/:id/prizes` (public) — share structure + indicative amounts; winners with names once settled. Draft/cancelled hidden from non-staff (matches leaderboard/contest).
- `GET /prizes` (user) — own prize history, contest title/slug populated.
- `POST /admin/contests/:id/prizes/redistribute` (admin) — idempotent re-run: retries stuck pending/failed credits, skips credited ones. Used to recover from a failed distribution at settle time.

**Deferred (ponytail):**
- Per-contest custom prize tables (the share table is a fixed module constant; a contest `prizeTable` field + validation would be needed).
- BullMQ prize job with exponential backoff — distribution runs synchronously in the settle call; per-winner credit failures are logged and retried via the admin endpoint.
- `POST /prizes/:id/withdraw` — not built: prizes credit the wallet, and payouts to UPI are the wallet withdrawal flow (KYC-gated, already wired to RazorpayX).

**Documented deviations:**
- Statuses are `pending | credited | failed` (the plan's payout-queue statuses `pending | processing | completed` assumed per-prize payouts; wallet credits make the payout a wallet concern). `payoutMethod`/`payoutReference`/`paidAt` fields dropped for the same reason.
- Tied ranks SPLIT their rank's share (two people tying for 1st each get half of 40%) so the total awarded never exceeds the net pool; any remainder stays with the platform.
- Free contests skip distribution entirely (no fees collected — crediting the declared `prizePool` would create money from nothing); zero-score submissions are excluded from winners. Review note: the pool basis was changed to ALL paid participants after review (the first cut used only the submitted subset, which would have silently kept forfeited fees with the platform).
- Distribution is best-effort inside settle (logged, never 500s the settle) with the admin redistribute endpoint as the retry path.

## Purpose
Automatically distribute prize money to contest winners after contest freeze/settle, managing the prize pool and payout processing.

## Architecture

```
apps/api/src/modules/prize/
├── prize.service.ts          # Distribution logic
├── prize.routes.ts           # HTTP routes
├── prize.validation.ts       # Zod schemas
└── index.ts                  # Module exports
```

## Prize Pool Distribution Model

### Prize Pool Calculation
- Total pool = `entryFee × participants`
  - Example: 100 participants × ₹20 = ₹2,000
  - Platform fee: 10-20% (configurable)
  - Net pool: ₹1,600-1,800 distributed to winners

### Default Distribution (can vary per contest)
| Rank | Share | Example (₹1,600 pool) |
|------|-------|----------------------|
| 1st | 40% | ₹640 |
| 2nd | 25% | ₹400 |
| 3rd | 15% | ₹240 |
| 4th-5th | 10% (5% each) | ₹80 each |
| 6th-10th | 10% (2% each) | ₹32 each |

## Payout Flow

### Automatic (after settle)
```
1. Admin triggers settle (or BullMQ job)
2. Service:
   a. Reads frozen leaderboard from MongoDB
   b. Calculates prize distribution
   c. Updates each entry with prize amount
   d. Creates payout queue entries
   e. Status: pending → processing → completed / failed
```

### Payout Methods
- **UPI**: Via Razorpay Payouts API (requires UPI ID from user KYC)
- **Razorpay**: Transfer to Razorpay account linked
- **Manual**: Admin marks as paid outside system (fallback)

### User Withdrawal Flow
```
1. User requests withdrawal (after contest settled and they won)
2. POST /api/prizes/:id/withdraw
3. Server validates:
   a. User is winner
   b. Contest is settled
   c. Prize not already paid
4. Initiates Razorpay Payout (if UPI on file)
5. Updates prize status
```

## Data Model

```
Collection: prizes
Fields:
  contestId
  userId
  rank
  prizeAmount (paise)
  status: pending | credited | failed   # wallet credit status (not payout)
  failureReason
  creditedAt

Unique index: (contestId, userId) — one prize per winner, idempotent re-runs
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/admin/contests/:id/settle | Admin | Settle contest (now distributes prizes automatically) |
| GET | /api/contests/:id/prizes | Public | Prize structure + winners once settled |
| POST | /api/admin/contests/:id/prizes/redistribute | Admin | Re-run distribution (idempotent retry) |
| GET | /api/prizes | User | List own prize history |
| GET | /api/prizes/recent | Public | Recent credited winners feed (`?limit=`, max 50) — winner name/avatar + contest + amount, newest first |

## Recent Winners Feed (added with the website pass)
- Powers the homepage "Wall of fame" marquee + avatar strip
- Only `credited` prizes are returned; `userId`/`contestId` populated (`firstName lastName avatarUrl` / `title slug`)
- Implementation: `publicPrizeRouter` in `prize.routes.ts`, mounted at `/prizes` **before** `userPrizeRouter` in `app.ts`

## Security
- Only settled contests can trigger prize distribution
- Prize amounts verified against total pool
- Admin actions logged to audit
- Withdrawal requires user KYC to be completed
- Razorpay Payouts API used for automated transfers (requires API key with payout permission)

## Best Practices
- Prizes stored in paise integers
- Prize distribution is idempotent (can re-run safely)
- Failed payouts retried with exponential backoff
- Manual payout option for edge cases
- All payout actions logged

## Skills
- razorpay — Razorpay Payouts API
- security-review — payout security
- backend-development — service layer
- backend-patterns — retry/idempotency patterns