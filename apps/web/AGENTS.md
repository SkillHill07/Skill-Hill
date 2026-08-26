# apps/web — Local Contract

Extends the root `AGENTS.md` and `AI_rules.md`. Read both first. Visual rules live in the repo-root `design.md`.

## Route Groups
- `(site)/` — all pages with Navbar/Footer chrome.
- `(focus)/contests/[id]/workspace/` — distraction-free contest workspace (no site chrome).
- Global `error.tsx` / `not-found.tsx` / `loading.tsx` / `sitemap.ts` / `robots.ts` stay at `app/` root.

## Auth & Data Fetching
- All API calls go through `src/lib/api.ts`. It auto-refreshes the session on 401 (single-flight + Web Locks cross-tab lock) and retries once. Never add raw `fetch` calls in components.
- Signed-in state: use `useMe()` from `src/hooks/use-me.ts` — one shared query key, 401-safe.
- Protected pages wrap their content in `<RequireAuth>` and render inside it; never hand-roll guards per page.

## Turnstile
- Render `<Turnstile onToken={setToken} />` from `components/turnstile.tsx` on captcha-protected forms. Seed initial state with `getTurnstileToken()` (returns a dev placeholder when no site key is configured). Submit buttons stay disabled until a token exists.

## SEO
- Client pages cannot export metadata — add a sibling `layout.tsx` that exports `metadata` **and** a default export wrapping `children`.
- Dynamic public routes (`contests/[id]`, `problems/[id]`) use `generateMetadata` with graceful fallbacks; private pages set `robots: { index: false }`.

## Conventions
- Money display always via `inr()` from `lib/format.ts` (paise in, ₹ string out). User-entered rupees convert via `Math.round(n * 100)` at submit time.
- Query keys include their pagination/limit segment (e.g. `["wallet-transactions", limit]`) to avoid cache collisions.
- CodeMirror lives only in the workspace route (`components/workspace/*`) to keep it out of the main bundle.
