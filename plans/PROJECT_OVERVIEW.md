# Skill Contest Platform - Project Plans

## Overview

A skill-based coding contest platform where users pay ₹20 to join contests and compete for prizes. The platform implements a leetcode-style coding challenge system with real-time judging, live leaderboards, and automated prize distribution.

## Key Features

- **Contest Platform**: Multiple coding contests with live status
- **Payment System**: ₹20 entry fee via Razorpay
- **Code Judge**: Isolated execution with time/memory limits
- **Real-time Leaderboard**: Live rankings
- **Prize Distribution**: Automated prize pools
- **Admin Panel**: Contest management and monitoring
- **Security**: Payment verification, code execution sandboxes

## Technology Stack

- **Frontend**: Next.js 16, React 19, TypeScript, TanStack Query
- **Backend**: Node.js 20.9+, Express, TypeScript
- **Database**: MongoDB for user/contest data
- **Cache**: Redis for contest state, payments, rate limiting
- **Payment**: Razorpay for processing
- **Code Execution**: Custom sandbox worker
- **Auth**: Clerk for authentication
- **Monitoring**: OpenTelemetry
```

## Next.js 16 Critical Rules

This project uses **Next.js 16** (GA Oct 2025, Active LTS 16.2.x). Many patterns from Next.js 14/15 are **deprecated or removed**. Before writing any frontend code, research the current Next.js 16 docs. Key changes:

- **`middleware.ts` is deprecated** → use `proxy.ts` with exported `proxy` function (Node.js runtime only). Edge runtime is not supported in proxy.
- **Request-time APIs are async** — `params`, `searchParams`, `cookies()`, `headers()` all return Promises. Must `await` them.
- **Turbopack is the default bundler** — custom `webpack()` configs are ignored. Use `next build --webpack` as escape hatch or migrate to `turbopack.rules`.
- **`"use cache"` directive** — caching is opt-in. Use `"use cache"` for cacheable Server Components instead of old implicit caching.
- **`revalidateTag(tag)` single-arg deprecated** — pass a `cacheLife` profile: `revalidateTag('posts', 'max')`. New `updateTag()` for read-your-writes in Server Actions.
- **`next lint` removed** — use ESLint or Biome directly.
- **`next/image` defaults changed** — `qualities` defaults to `[75]`, `minimumCacheTTL` is 4h.
- **Removed APIs**: AMP, `serverRuntimeConfig`/`publicRuntimeConfig`, `experimental.ppr`/`dynamicIO`/`useCache`, all `unstable_*` prefixes.
- **Parallel route slots require `default.js`** — each `@slot` needs a `default.tsx`.
- **Minimums**: Node.js 20.9+, TypeScript 5.1+, React 19.2 (App Router only).

> **Before implementing any Next.js feature, verify the current docs.** Patterns from Next.js 14/15 tutorials are likely outdated.
- **Database**: MongoDB for user/contest data
- **Cache**: Redis for contest state, payments, rate limiting
- **Payment**: Razorpay for processing
- **Code Execution**: Custom sandbox worker
- **Auth**: Clerk for authentication
- **Monitoring**: OpenTelemetry

## Project Structure

```
apps/web/
  ├── src/
  │   ├── modules/
  │   │   ├── contest/  # Contest browsing & viewing
  │   │   ├── payment/   # Payment handling
  │   │   ├── submit/    # Code submission
  │   │   └── results/   # Contest results
  │   └── components/    # Shared UI components

apps/admin/
  ├── src/
  │   ├── modules/
  │   │   ├── contest/  # Create/manage contests
  │   │   ├── user/      # User management
  │   │   └── analytics/  # Usage analytics
  │   └── components/    # Admin UI components

apps/api/
  ├── src/
  │   ├── modules/
  │   │   ├── auth/        # Authentication
  │   │   ├── contest/     # Contest API
│   │   ├── payment/     # Razorpay orders, webhook processing, refunds, RazorpayX payouts
│   │   ├── judge/       # Code judging
  │   │   ├── submission/  # Code submissions (async judging)
  │   │   ├── language/    # Judge language catalog
  │   │   ├── leaderboard/ # Contest rankings (Mongo-backed, best-score wins)
│   │   ├── wallet/      # Central ledger: balances, transactions, withdrawals
│   │   ├── audit/       # Admin action audit trail (money/ban/contest-state mutations)
│   │   ├── logo/        # Site logo (singleton + R2 upload)
  │   │   ├── whyChooseUs/ # "Why choose us" feature items
  │   │   ├── banner/      # Hero/announcement banners (+ R2 image upload)
│   │   ├── faq/         # FAQ content (category filter)
│   │   ├── prize/       # Prize distribution (wallet credits on settle) + prize history
│   │   ├── sockets/     # Realtime submission status (socket.io, single-instance)
  │   │   └── webhook/     # Payment webhooks
  │   ├── utils/          # Shared utilities
  │   └── jobs/           # Background jobs

packages/
  └── ui/               # Shared UI components
```

## Phases

1. **Phase 1: Infrastructure Setup** - Redis, Docker, core infrastructure
2. **Phase 2: Contest Management System** - Core contest API
3. **Phase 3: Payment Integration** - Razorpay payments ✅ built (orders, HMAC webhook, refunds, RazorpayX UPI withdrawals)
4. **Phase 4: Code Execution Environment** - Sandbox execution
5. **Phase 5: Frontend Components** - User-facing UI ✅ website pass: content-rich homepage (hero motion, winners marquee, countup stats, how-it-works, practice teaser, accordion FAQ, CTA) + practice library (`/problems`) + problem viewer (`/problems/[id]`); marketing primitives in `apps/web/src/components/marketing.tsx`
6. **Phase 6: Security & Compliance** - Audit logging ✅ built (`audit` module + admin page), webhooks/turnstile/rate-limits/sandbox already in place from Phases 3-4; full audit checklist in `plans/phases/PHASE6_SECURITY.md`
7. **Phase 7: Testing & Verification** - Comprehensive test suite
8. **Phase 8: Deployment & Monitoring** - CI/CD and monitoring

## Skill Integration Map

| Module | Skills Applied |
|--------|----------------|
| Core API | backend-development, express-typescript, security-review |
| Payment | razorpay, backend-development, security-review |
| Wallet | backend-patterns, security-review, mongodb-query-optimizer |
| Payouts (RazorpayX) | razorpay, backend-development, security-review |
| Prizes | backend-patterns, security-review, backend-development |
| Code Judge | backend-development, security-review, mongodb-query-optimizer |
| Contest System | backend-patterns, backend-development |
| Leaderboard | backend-development, mongodb-query-optimizer |
| Frontend | frontend-dev, design-taste-frontend, frontend-design-review |
| Security | security-review, backend-security-coder |
| Testing | clerk-testing, golang-grpc |
| Admin Panel | frontend-design, frontend-dev |
| Debt Tracking | pony-tail |