# Leaderboard Module Plan

> **Status: BUILT (MongoDB-backed)** — `apps/api/src/modules/leaderboard/`
> implements `GET /contests/:id/leaderboard` (public, `?limit=` ≤ 100) and
> `GET /contests/:id/leaderboard/me` (authenticated). Ranks read directly from
> `participation.totalScore` (best score wins, maintained by the judge's
> `updateParticipationScore`) + `submittedAt` for tie-breaking; competition
> ranking (1,1,3) via a pure `computeRanks` helper. Swagger + 9 tests (5 rank
> unit + 4 route) — full suite green.
>
> **Deviations from this plan (ponytail notes):**
> 1. **No Redis sorted set.** The plan proposed `ZINCRBY` for live scores, but
>    the real semantics are *best-score-wins*, not cumulative — `ZINCRBY`
>    would double-count. Mongo already holds the atomic truth (one write per
>    judged submission), and reads are sub-second at this scale. Upgrade path:
>    mirror `totalScore` to a Redis sorted set via `ZADD` (not ZINCRBY) in
>    `judge.service` when a contest grows huge.
> 2. **No freeze snapshot collection.** Participation docs are the frozen
>    standings — submissions stop at freeze, so scores cannot change after.
>    Prize distribution can read them at settle time. A `leaderboards`
>    collection adds redundant state.
> 3. **`leaderboard:update` WebSocket event deferred** — clients refresh on
>    `submission:completed` (already pushed by the sockets module) or poll.
>    A debounced leaderboard event can be added later if the UI needs it.
> 4. **`rank` is not persisted** — computed at read time (draft/cancelled
>    contests hidden from non-staff with 404, matching the contest module).

## Purpose
Maintain real-time contest leaderboards during active contests and persist final rankings after freeze for prize distribution.

## Architecture

```
apps/api/src/modules/leaderboard/
├── leaderboard.service.ts    # Core logic (Redis + MongoDB)
├── leaderboard.routes.ts     # HTTP routes
├── leaderboard.validation.ts # Zod schemas
└── index.ts                  # Module exports
```

## Data Storage Strategy

### During Active Contest (Redis Sorted Set)
```
Key: leaderboard:{contestId}
Value: Sorted Set
  Member: userId
  Score: totalScore (integer)
  Rank: computed by Redis

Operations:
  ZINCRBY leaderboard:{contestId} score userId  — update score on submission
  ZREVRANGE leaderboard:{contestId} 0 9 WITHSCORES — get top 10
  ZRANK leaderboard:{contestId} userId — get user's rank
  ZSCORE leaderboard:{contestId} userId — get user's score
```

### After Freeze (MongoDB)
```
Collection: leaderboards
Fields:
  contestId, entries: [{ userId, score, rank, prize }]
  
Written once when contest freezes
Read for final results display
```

## Why Redis During Active Contest?
- Sub-second leaderboard updates
- Atomic score updates
- No DB write contention during contest
- Built-in sorted set operations (rank, range, score)
- Automatic tie-breaking by submission time (score + timestamp as composite)

## Why MongoDB After Freeze?
- Permanent record of final standings
- Required for prize distribution audit
- Can be cached with Next.js `use cache`

## Leaderboard Entry Structure (Redis)
```
ZADD leaderboard:{contestId} <score> <userId>
Score is composite: totalScore * 10^9 + (maxTime - elapsedSeconds)
This ensures: higher score = higher rank, same score = faster time wins
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/contests/:id/leaderboard | Public | Top 100 leaderboard |
| GET | /api/contests/:id/leaderboard/me | User | Current user's rank & score |

## WebSocket Events
- `leaderboard:update` — emitted when score changes (debounced 2s)
- `leaderboard:final` — emitted when contest freezes with final standings

## Best Practices
- Never cache leaderboard at Next.js layer during active contest
- Use Redis pipeline for batch operations
- Debounce leaderboard WebSocket updates (2s buffer)
- On freeze: snapshot Redis → MongoDB in single transaction
- On settle: no leaderboard changes needed (already frozen)

## Skills
- backend-development — Redis sorted sets, service layer
- backend-patterns — caching strategy
- performance — real-time update optimization
- mongodb-query-optimizer — final standings query optimization