# Phase 3: Payment Integration

## Status — ✅ Built (see `plans/modules/payment-module-plan.md`)

Order creation, HMAC-verified webhook (raw-body signature check, atomic capture claim + idempotent wallet deposit), refunds (wallet reversal first), payment audit views, and the RazorpayX UPI payout gateway for withdrawals are all implemented and tested (41 new tests). Env to go live: `RAZORPAY_KEY_ID/SECRET` + `RAZORPAY_WEBHOOK_SECRET` for deposits; `RAZORPAYX_ACCOUNT_NUMBER` (key with payout permission) for withdrawals.

## Objective
Integrate Razorpay for contest entry fee (₹20 = 2000 paise) processing with HMAC-verified webhooks and full idempotency.

## Tasks

### 1. Razorpay Setup
- **File**: `apps/api/src/config/razorpay.ts`
- **Description**: Initialize Razorpay SDK client with key/secret from env
- **Skill**: razorpay
- **Best Practices**:
  - Never expose `key_secret` to client
  - Store `key_id` in public env for frontend

### 2. Payment Model
- **File**: `apps/api/src/modules/payment/payment.model.ts`
- **Schema**: `userId`, `contestId`, `razorpayOrderId`, `razorpayPaymentId`, `amount` (paise), `currency`, `status` (created | attempted | paid | refunded | failed), `idempotencyKey` (unique), `createdAt`, `paidAt`
- **Skill**: mongodb-natural-language-querying, backend-development
- **Best Practices**:
  - `idempotencyKey` has unique index in MongoDB
  - Amount stored in paise integers

### 3. Order Creation API
- **Files**: `apps/api/src/modules/payment/routes/payment.routes.ts`, `services/payment.service.ts`
- **Endpoint**: `POST /api/payments/create-order`
- **Body**: `contestId`, `userId` (from auth middleware)
- **Logic**:
  1. Validate contest exists and is accepting participants
  2. Generate idempotency key `join:{userId}:{contestId}`
  3. Check idempotency in Redis (avoid duplicate Razorpay orders)
  4. Create Razorpay order with `amount: 2000`, `currency: "INR"`, `receipt: "contest:{contestId}:user:{userId}"`
  5. Store payment record in MongoDB with `status: created`
  6. Return `orderId`, `amount`, `key_id` to client
- **Skill**: razorpay, backend-development, security-review

### 4. Payment Verification Webhook
- **File**: `apps/api/src/modules/webhook/razorpay.webhook.ts`
- **Endpoint**: `POST /api/webhooks/razorpay` (excluded from auth middleware)
- **Logic**:
  1. Read `x-razorpay-signature` header
  2. Compute HMAC SHA256 of raw body with `webhook_secret`
  3. Compare — reject with 400 if mismatch
  4. Verify `event` is `payment.captured` or `payment.failed`
  5. Extract `payment.entity` (order_id, payment_id, status)
  6. Check idempotency in Redis (key: `payment:{payment_id}`)
  7. Update payment record in MongoDB
  8. If `payment.captured`: create participation record in contest
  9. Return 200 OK
- **Skill**: razorpay, security-review, backend-development
- **Best Practices**:
  - Route excluded from auth middleware
  - HMAC verification before any processing
  - Redis idempotency check before any DB mutation
  - Webhook handler is idempotent: replaying same event is safe
  - Never trust `payment.success` callback from client — only webhook confirms

### 5. Refund Handling
- **File**: `apps/api/src/modules/payment/services/refund.service.ts`
- **Trigger**: Contest cancellation or failed contest (admin)
- **Logic**:
  1. Admin initiates refund via `POST /api/admin/payments/refund`
  2. Service calls `razorpay.payments.refund(paymentId)`
  3. Update payment status to `refunded`
  4. Remove user participation
- **Skill**: razorpay, backend-development
- **Best Practices**:
  - Admin action logged to audit collection
  - Idempotent: if refund already exists, skip

### 6. Race Condition Prevention
- **File**: `apps/api/src/modules/payment/middleware/payment-lock.ts`
- **Description**: Redis distributed lock on `join:{userId}:{contestId}` during payment processing
- **Skill**: backend-patterns, security-review
- **Best Practices**:
  - Lock TTL: 30 seconds
  - Block duplicate join attempts while payment is processing

## Deliverables
- Razorpay order creation API
- HMAC-verified webhook handler
- Reliable payment status tracking
- Refund capability
- Race condition prevention

## Dependencies
- Phase 1 (Redis for idempotency)
- Phase 2 (Contest management)

## Verification
- Payment flow E2E (create order → simulate payment → webhook → verify participation created)
- HMAC signature verification test
- Idempotency test (replay webhook — no duplicate)
- Refund test
- Race condition test (concurrent join attempts)