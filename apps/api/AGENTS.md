# apps/api — Local Contract

Extends the root `AGENTS.md` and `AI_rules.md`. Read both first.

## Session & Auth Contract
- Tokens are delivered **only** via HttpOnly cookies (`accessToken` 15 min, `refreshToken` 7 d). Never include raw tokens in JSON response bodies — clients authenticate with `credentials: "include"` and call `/auth/refresh` on 401.
- Refresh tokens are single-use. Reuse triggers full revocation (`revokeAllUserTokens` + Mongo `refreshTokens: []`) and 401 `TOKEN_REVOKED`.
- OAuth callbacks must verify the one-time Redis `state` value and reject banned/flagged accounts **before** issuing tokens.
- Turnstile is verified server-side on: register, login, forgot-password, contest-join, withdrawal.
- Rate limiters live in `src/middlewares/rate-limiter.ts`; withdrawal uses a per-user limiter placed after `authenticate`.

## Validation Rules
- Every `:id` path param must use the ObjectId regex (`/^[a-f0-9]{24}$/i`) in its Zod schema — malformed ids must 400 at the boundary, never reach Mongoose (CastError ⇒ 500).
- Multipart routes (e.g. `PUT /auth/me`) assemble fields first, then validate with Zod inside the handler.

## Submissions
- `mode: "run"` judges public test cases only and must never touch Participation scores or leaderboards. `mode: "submit"` is the full scored judge. MCQs are always submits.

## Testing
- Vitest, colocated `*.test.ts`. Route tests stub auth middleware and mock services.
- `docker/sandbox.test.ts` requires Docker; skip locally without it (`vitest run --exclude "**/sandbox.test.ts"`).

## Known Deliberate Tradeoffs (ponytail ledger)
- Access tokens are stateless (no blacklist); logout/ban revocation applies to refresh tokens only — acceptable at a 15-minute access lifetime.
- Rate limiter fails closed (429) when Redis errors — availability traded for safety.
