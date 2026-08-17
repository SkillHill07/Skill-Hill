# Payment Module Plan

## Status — ✅ Built

Implemented in `apps/api/src/modules/payment/` (payment.model.ts, payment.service.ts, payment.validation.ts, payment.routes.ts, payment.admin.routes.ts, payout.service.ts, index.ts) + `apps/api/src/modules/webhook/razorpay.webhook.ts`. **41 new tests** (23 service, 6 payout, 4 webhook route, 6 user route, 6 admin route; plus wallet `reverseDeposit` + withdraw-route updates). Typecheck + lint clean.

**Live now:**
- `POST /payments/create-order` — Razorpay order (insert-first, unique idempotency key, 409 on concurrent duplicate), returns `{ orderId, amount, keyId }` for Checkout. `POST /wallet/deposit` is a thin alias forwarding here (purpose=deposit).
- `POST /webhooks/razorpay` — HMAC-verified over the RAW body (`express.json` verify hook), atomic `created/attempted/failed → paid` claim + idempotent `walletService.deposit()` on capture. Review-hardened: a retry capture after a failed attempt on the same order still credits (Razorpay allows multiple payment attempts per order); a frozen-wallet capture records the reason + payment id and rethrows so the webhook 500s and Razorpay retries — it self-heals when the wallet unfreezes instead of stranding captured money
- `GET /payments` (user history), `GET /admin/payments` (audit view, user populated), `POST /admin/payments/refund` (reverses the wallet deposit first, then Razorpay refund; blocked with 400 if the user spent the money — no double-pay)
- **Withdrawals are live**: `wallet.routes` injects the real RazorpayX payout gateway (`payout.service.ts`) into `walletService.withdraw` — contact + UPI fund-account find-or-create (cached on the User doc, UPI-change aware) then `POST /v1/payouts` via the official RazorpayX REST API (Node fetch + Basic auth, **zero new dependencies**)

**Deferred (ponytail):**
- Redis idempotency keys / distributed payment lock — DB-atomic claims + the wallet's partial-unique idempotency index cover replays without Redis (consistent with the wallet module)
- `payout.processed`/`payout.failed` status webhook to reconcile final payout settlement (payouts are async; creation is treated as acceptance)
- Auto-create participation on capture — joins are wallet-deducts (already wired); orders with `contestId` are deposit metadata only

**Documented deviations:**
- Idempotency keys are nonce-based (`dep:{userId}:{uuid}`) rather than the plan's deterministic `join:{userId}:{contestId}` — every create-order is a fresh attempt (standard wallet-deposit UX); concurrent duplicate clicks still 409 via the unique key.
- Admin refund ordering: wallet reversal BEFORE the Razorpay refund (money locked during processing); on provider failure the wallet is re-credited via a synthetic-reference deposit and the payment stays `paid` so a retry is safe. Reverse-then-refund is self-healing; refund-then-reverse would double-pay when the wallet no longer holds the funds.
- RazorpayX client is a thin REST client (`config/razorpay.ts`) instead of the unmaintained community `razorpayx-nodejs-sdk`.
- Webhook returns 200 for ignored/unknown events (no retry storms); real processing failures return 500 so Razorpay retries.

## Purpose
Handle **raw Razorpay operations**: order creation, webhook verification, and refunds. This module does **not** manage user balances — it delegates to the Wallet module after successful payments.

## Boundary
- Payment module: talks to Razorpay API, nothing else
- Wallet module: manages user balances (deposit, deduct, credit)
- Payment success → calls `walletService.deposit()`
- Payment is the *deposit mechanism* — wallet is the *balance store*

## Architecture

```
apps/api/src/modules/payment/
├── payment.model.ts          # Mongoose schema (status machine, unique keys)
├── payment.service.ts        # Order creation, webhook processing, refunds, lists
├── payment.validation.ts     # Zod schemas
├── payment.routes.ts         # User routes (create-order, list own)
├── payment.admin.routes.ts   # Admin routes (audit view, refund)
├── payout.service.ts         # RazorpayX gateway (withdrawals, injected into wallet)
└── index.ts                  # Module exports

apps/api/src/modules/webhook/
├── razorpay.webhook.ts       # Webhook route (no auth — HMAC verified)
└── index.ts
```

The Razorpay SDK client + RazorpayX REST client live in `apps/api/src/config/razorpay.ts` (lazy singletons, feature-gated).

## Data Model

### Payment Schema
| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId | Who pays |
| `contestId` | ObjectId | Which contest |
| `razorpayOrderId` | String | Razorpay order reference |
| `razorpayPaymentId` | String | Razorpay payment reference (after success) |
| `amount` | Number | In paise (2000 = ₹20) |
| `currency` | String | INR |
| `status` | Enum | `created` → `attempted` → `paid` / `failed` / `refunded` |
| `idempotencyKey` | String | Unique, prevents duplicate processing |
| `receipt` | String | `contest:{id}:user:{id}` |
| `createdAt` | Date | |
| `paidAt` | Date | |
| `refundedAt` | Date | |
| `refundId` | String | Razorpay refund reference |

## Flow

### Payment Flow
```
1. User clicks "Deposit Funds" or is redirected from join due to insufficient balance
2. Frontend calls POST /api/payments/create-order
   body: { amount: 2000, contestId? }
3. Server:
   a. Generates idempotency key: deposit:{userId}:{nonce}
   b. Checks Redis for existing order (prevents duplicate)
   c. Creates Razorpay order (amount, currency: INR)
   d. Saves payment record in MongoDB (status: created)
   e. Returns { orderId, amount, keyId } to client
4. Frontend opens Razorpay Checkout with orderId
5. User completes payment in Razorpay UI
6. Razorpay sends webhook to POST /api/webhooks/razorpay
7. Server:
   a. Verifies HMAC signature (MUST be first step)
   b. Checks idempotency in Redis (key: payment:{paymentId})
   c. Updates payment record status
   d. If payment.captured: calls walletService.deposit(userId, amount, paymentId)
   e. Returns 200 OK
8. Wallet balance is now updated
9. If this was a contest join deposit, frontend retries join
```

### Refund Flow
```
1. Admin clicks "Refund" for a contest
2. POST /api/admin/payments/refund (requires admin role)
3. Server:
   a. Logs action to audit collection
   b. Calls Razorpay refund API
   c. Updates payment status to refunded
   d. walletService.deposit(userId, amount, refundPaymentId) — money back to wallet
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/payments/create-order | User | Create Razorpay order (deposit) |
| POST | /api/webhooks/razorpay | None | Razorpay webhook (HMAC verified) |
| POST | /api/admin/payments/refund | Admin | Issue refund (reverses wallet first) |
| GET | /api/payments | User | List own payments |
| GET | /api/admin/payments | Admin/Creator | Audit view — all payments, user populated |

## Security
- Webhook route excluded from auth middleware but HMAC-verified
- Idempotency keys prevent duplicate processing
- Redis lock prevents race conditions on join
- Never trust client-side `payment.success` callback — only webhook confirms payment
- All admin refund actions logged to audit

## Skills
- razorpay — Razorpay API integration (SDK + RazorpayX REST)
- security-review — HMAC verification, webhook security
- backend-development — service layer
- backend-patterns — idempotency patterns

## Ops notes
- Webhook requires `RAZORPAY_WEBHOOK_SECRET`; withdrawals require `RAZORPAYX_ACCOUNT_NUMBER` + a key with payout permission.
- The webhook route reads `req.rawBody` — do not mount another body parser ahead of it that would consume the raw stream.