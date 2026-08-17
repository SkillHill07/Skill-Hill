# Wallet Module Plan

## Status — ✅ Built

Implemented in `apps/api/src/modules/wallet/` (wallet.model.ts, transaction.model.ts, wallet.service.ts, wallet.validation.ts, wallet.routes.ts, wallet.admin.routes.ts). **34 new tests** (ledger ops, idempotency, atomic guards, withdrawal gates, routes, join-wiring). Typecheck + lint clean.

**Live now:**
- Wallet + append-only Transaction models (paise integers, partial unique idempotency index)
- Service: `deposit`, `deduct`, `credit`, `refund`, `withdraw`, `getBalance`, `getTransactions`, `setStatus` (admin freeze/unfreeze) — all atomic (`findOneAndUpdate` preconditions) + idempotent (duplicate insert compensated)
- `GET /wallet/balance`, `GET /wallet/transactions`, `POST /wallet/withdraw` (user), `PATCH /admin/wallets/:userId/status` (admin)
- **Wired into the platform**: contest join now deducts entry fees for paid contests (free contests skip); contest cancel refunds every paid participant (idempotent fan-out)

**Resolved by the payment module (Phase 3, built):**
- Deposits go through the payment module's order creation → HMAC webhook → `walletService.deposit()` (idempotent on the Razorpay payment id). `POST /wallet/deposit` is a thin wallet-centric alias that forwards to `paymentService.createOrder` (purpose=deposit) — same endpoint as `POST /payments/create-order`, so there's a single source of order-creation logic.
- Withdrawal payout gateway is wired: `wallet.routes` injects `payoutService.initiatePayout` (RazorpayX `POST /v1/payouts`, contact + UPI fund-account find-or-create cached on the User doc) into `withdraw()`. The default 503 payout remains for when RazorpayX env is absent.
- `reverseDeposit(userId, amount, paymentId)` added for admin payment refunds — atomic debit (rejected if the deposit was spent), refund ledger row unique per payment id.

**Documented deviations:**
- Idempotency index is `(userId, type, referenceId)` **partial unique** — the plan's `(referenceType, referenceId)` unique would wrongly block multiple users paying the same contest. Withdrawal rows (referenceId null) are excluded via `partialFilterExpression`.
- `referenceId` is stored as String (plan said ObjectId) to accommodate Razorpay payment ids.
- `locked` is always 0 — escrow-style locking on join is deferred; fees deduct immediately.
- Transaction `status` may transition (pending → completed/failed) — the only exception to append-only; amount/balance fields are immutable.
- Redis balance cache, per-day withdrawal cap, and admin refund-reprocess endpoint are deferred (ponytail).

## Purpose
Manage user balances — deposits, deductions (contest fees), credits (prize winnings), and withdrawals. Acts as the central ledger for all money movement in the platform.

## Why a Wallet?

Without wallet: every contest join requires a fresh Razorpay transaction (₹20 each time). Winnings paid directly via Razorpay Payouts. Refunds go back to Razorpay.

With wallet: users deposit once, join multiple contests from balance. Winnings credit to wallet. Refunds go to wallet. Users withdraw when they want. Fewer Razorpay transactions = lower fees.

## Architecture

```
apps/api/src/modules/wallet/
├── wallet.model.ts            # Mongoose schema (balance, locked)
├── wallet.service.ts          # Core logic (deposit, deduct, credit, withdraw)
├── wallet.routes.ts           # HTTP routes
├── wallet.validation.ts       # Zod schemas
├── transaction.model.ts       # Transaction log
├── transaction.service.ts     # Transaction querying
└── index.ts                   # Module exports
```

## Data Models

### Wallet Schema
| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId | Unique — one wallet per user |
| `balance` | Number | Current available balance in paise |
| `locked` | Number | Amount locked in pending contest entries (paise) |
| `totalDeposited` | Number | Lifetime deposits (paise) |
| `totalWithdrawn` | Number | Lifetime withdrawals (paise) |
| `totalWon` | Number | Lifetime prize winnings (paise) |
| `totalSpentOnFees` | Number | Lifetime contest fees paid (paise) |
| `status` | Enum | `active` / `frozen` (frozen = no transactions allowed) |
| `createdAt` | Date | |
| `updatedAt` | Date | |

**Unique index**: `userId` (1)

### Transaction Schema
| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId | Whose transaction |
| `type` | Enum | `deposit` / `contest_fee` / `prize` / `refund` / `withdrawal` |
| `amount` | Number | Amount in paise (always positive; type indicates direction) |
| `balanceBefore` | Number | Wallet balance before this transaction |
| `balanceAfter` | Number | Wallet balance after this transaction |
| `referenceType` | Enum | `payment` / `contest` / `prize` / `withdrawal` |
| `referenceId` | ObjectId | ID of the reference record |
| `description` | String | Human-readable description |
| `status` | Enum | `completed` / `pending` / `failed` |
| `createdAt` | Date | |

**Indexes**: `userId` + `createdAt`, `referenceType` + `referenceId` (unique)

## Core Service Functions

### `walletService.deposit(userId, amount, paymentId)`
- Called by: payment webhook handler after Razorpay payment captured
- Increases balance, creates `deposit` transaction
- Idempotent: if transaction for `paymentId` already exists, skip

### `walletService.deduct(userId, amount, contestId)`
- Called by: contest join handler
- Validates: balance >= amount, wallet not frozen
- Decreases balance, creates `contest_fee` transaction
- If contest cancelled later, `refund()` reverses this

### `walletService.credit(userId, amount, contestId)`
- Called by: prize distribution module after contest settles
- Increases balance, creates `prize` transaction
- Idempotent: if transaction for `contestId` + `prize` type already exists, skip

### `walletService.refund(userId, amount, contestId)`
- Called by: contest cancel handler
- Increases balance, creates `refund` transaction
- Only refunds if there was a matching `contest_fee` deduction

### `walletService.withdraw(userId, amount)`
- Called by: user-initiated withdrawal
- Validates: balance >= amount + platform withdrawal fee (if any), wallet not frozen
- Decreases balance, creates `withdrawal` transaction (status: pending)
- Triggers Razorpay Payout via `payoutService`
- On payout success: transaction → completed
- On payout failure: transaction → failed, balance restored

### `walletService.getBalance(userId)`
- Returns `{ balance, locked, available }` where `available = balance - locked`

### `walletService.getTransactions(userId, filters)`
- Paginated transaction history
- Filters: type, date range, reference type

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/wallet/balance | User | Get wallet balance |
| GET | /api/wallet/transactions | User | Transaction history (paginated) |
| POST | /api/wallet/deposit | User | Create Razorpay order for deposit (calls payment module) |
| POST | /api/wallet/withdraw | User | Request withdrawal (if KYC complete) |

## Integration with Other Modules

### On Payment Success (Payment Module → Wallet)
```
Razorpay webhook: payment.captured
  → PaymentService.verifyAndProcess(webhookPayload)
  → walletService.deposit(userId, amount, paymentId)
  → ParticipationService.create(userId, contestId)  // if contest-scoped payment
```

### On Contest Join (Contest Module → Wallet)
```
ContestService.join(userId, contestId)
  → walletService.deduct(userId, entryFee, contestId)
  → ParticipationService.create(userId, contestId)
```

### On Contest Cancel (Contest Module → Wallet)
```
ContestService.cancel(contestId)
  → for each participant:
    → walletService.refund(userId, entryFee, contestId)
    → ParticipationService.remove(userId, contestId)
```

### On Prize Distribution (Prize Module → Wallet)
```
PrizeService.distribute(contestId)
  → for each winner:
    → walletService.credit(userId, prizeAmount, contestId)
```

## Security & Best Practices
- All amount fields stored as paise integers (never floats)
- Every mutation is idempotent — same referenceId won't double-process
- Wallets use optimistic concurrency: check `balance >= amount` before deduct
- Transaction records are append-only — never updated or deleted
- Withdrawals require KYC completion (checked in service)
- Withdrawal limits: minimum ₹100, maximum per day configurable
- Admin can freeze/unfreeze wallets (for fraud/suspension)
- Wallet balance cached in Redis with short TTL for fast reads (invalidated on any mutation)

## Race Condition Protection
- Use MongoDB `findOneAndUpdate` with `{ balance: { $gte: amount } }` condition for atomic deduct
- If the condition fails (insufficient balance), the operation returns null — service throws
- No distributed lock needed for individual operations (MongoDB atomic update is sufficient)

## Initial Wallet Creation
- Wallet is created lazily on first deposit
- Zero-balance wallets are not stored (created on demand)

## Skills
- backend-development — core implementation
- security-review — financial transaction safety
- mongodb-query-optimizer — transaction query performance
- backend-patterns — idempotency, optimistic concurrency
- ponytail — debt tracking (withdrawal limits, escrow considerations)