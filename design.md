# SkillHill Design System

This document describes the **actual** design system implemented in `apps/web` and `apps/admin`. When code and this document disagree, fix one of them in the same change — never let them drift.

Stack context: Next.js App Router, Tailwind CSS v4 (CSS-first `@theme inline` tokens), hand-rolled primitives in `apps/web/src/components/ui.tsx`, shared `cn()` helper from `@skillcontest/ui`.

---

## 1. Design philosophy

SkillHill is a **competitive coding arena**, not a generic SaaS dashboard.

- **Content first.** Contests, problems, scores and money are the interface. Chrome stays quiet.
- **Calm surfaces, loud data.** Neutral backgrounds and borders; color only for state (live, success, danger) and brand accents.
- **Dense where experts work** (workspace, tables), **airy where visitors browse** (marketing pages).
- Every visual choice must serve comprehension: hierarchy → scanning → action.
- No decoration without information value. No glassmorphism, no gradient soup, no animation for its own sake.
- Orange is used **strategically** — for CTAs, scores, progress, and brand moments. Not everywhere.

## 2. Brand personality

Precise, energetic, trustworthy. A scoreboard aesthetic: strong tabular numbers, clear rank badges, honest feedback. The product handles real money — the UI must feel like a serious financial tool when showing wallets, prizes and payouts.

## 3. Color system

Tokens are HSL channel variables consumed through Tailwind (`bg-background`, `text-muted-foreground`, …). Defined per app in `src/app/globals.css`.

### Backgrounds & surfaces

| Token | Light | Dark | Usage |
|---|---|---|---|
| `background` | white | `240 10% 4%` | Page background |
| `card` | white | `240 8% 7%` | Cards, panels, elevated surfaces |
| `muted` | zinc-100 | `240 5% 12%` | Section tints, inline code chips, hover fills |
| `accent` | zinc-100 | `240 5% 12%` | Hover states on nav items / ghost buttons |

### Foreground

| Token | Usage |
|---|---|
| `foreground` | Primary text — zinc-950 light / `0 0% 95%` dark |
| `muted-foreground` | Secondary text, descriptions, timestamps |
| `card-foreground` | Text on cards |

### Brand & semantics

| Token / utility | Meaning | Notes |
|---|---|---|
| `orange-600` | **Brand primary** | CTAs, active states, brand accents, scores |
| `emerald-*` | Success / money-in / accepted | Prizes, credits, "Accepted" verdicts |
| `amber-*` | Warning / pending / medium difficulty | Pending KYC, queued submissions |
| `red-*` | Danger / money-out / rejected | Errors, debits, wrong answers |
| `sky-*` / `violet-*` | Informational badges | Coding vs MCQ type badges |

**Rules**

- Money amounts always use `tabular-nums`.
- Green = incoming money only. Outgoing/debits use plain foreground or red.
- Never introduce a new hue for a one-off component. Map it to an existing tone first.
- Orange is NOT the default for every icon container. Use it only for brand moments and key actions.

## 4. Typography

Loaded via `next/font/google` with CSS variables `--font-sans` / `--font-mono`, wired into Tailwind's `font-sans` / `font-mono`.

| Face | Role | Notes |
|---|---|---|
| **Inter** | All UI text | Geometric-humanist; excellent small-size legibility |
| **JetBrains Mono** | Code editor, compiler output, test I/O | Also `tabular-nums` contexts may use sans with the utility class |

### Scale & hierarchy

| Element | Class pattern |
|---|---|
| Page title (h1) | `text-4xl sm:text-5xl font-extrabold tracking-tight` |
| Section heading | `text-3xl font-bold tracking-tight sm:text-4xl` with `SectionHeading` eyebrow (`text-xs uppercase tracking-widest text-orange-500`) |
| Card title | `text-base font-semibold leading-none tracking-tight` |
| Body | `text-sm` (14px) default; long-form `text-base leading-relaxed` |
| Secondary/meta | `text-sm text-muted-foreground` |
| Micro-labels | `text-xs font-medium uppercase tracking-wide text-muted-foreground` |
| Stat values | `text-2xl font-bold tracking-tight tabular-nums` |

Body line-height ≥ 1.5; headings ≤ 1.3. Headings are real `h1–h3` elements — one `h1` per page.

## 5. Spacing & layout

- Base unit: 4px. Use Tailwind steps (1=4px, 2=8px, 3=12px, 4=16px, 5=20px, 6=24px).
- Page container: `mx-auto max-w-6xl px-4` (marketing up to `max-w-7xl`; auth forms `max-w-md`).
- Vertical rhythm on pages: `py-10`; between major sections `mt-6`–`mt-8` (app) or `py-16` (marketing).
- Card padding: `p-5`. List rows inside cards: `px-5 py-3`.
- Form field gaps: `gap-3`; label-to-input handled inside `Label` (`mb-1.5`).
- Grids: `gap-4` everywhere. Responsive columns: 1 → `sm:grid-cols-2` → `lg:grid-cols-3/4`.

## 6. Radius, borders, shadows

| Property | Value | Where |
|---|---|---|
| Radius sm | `rounded-md` (6px) | Inline code chips, nav items |
| Radius default | `rounded-lg` (8px) | Buttons, inputs, badges, rows, alerts |
| Radius lg | `rounded-xl` (12px) | Cards, EmptyState, workspace panels |
| Radius full | `rounded-full` | Badges, avatars |
| Border | `border-border` on every card & input | Never pure black/white borders |
| Shadows | `shadow-sm` resting cards, `shadow-md` hover lift | Nothing larger; no colored glows |

## 7. Components

All live in `apps/web/src/components/ui.tsx` unless noted. Use them; do not restyle raw HTML to look like them.

### Button

Variants: `primary` (orange-600, white text), `secondary` (zinc-900/100 inverse), `outline` (bordered), `ghost`, `danger` (red-600), `success` (emerald-600). Sizes: `sm h-8`, `md h-10`, `lg h-11`.

- One primary button per view region; everything else outline/ghost.
- `loading` prop swaps in a spinner and disables; keep labels verb-first ("Join contest", not "Submit").
- Links that look like buttons use `<Link>` with local `ButtonLink` patterns — never `<button><a>`.
- Icons inside buttons: `h-4 w-4` (+ `aria-hidden`).

### Inputs / Textarea / Select

Height `h-10`, `rounded-lg border border-input bg-background`, focus ring `ring-orange-500`. Always paired with `Label htmlFor`. Helper text below input: `mt-1 text-xs text-muted-foreground` with `aria-describedby`. Native `<select>` is acceptable for language pickers (styled to match inputs).

### Card

`rounded-xl border border-border bg-card shadow-sm`. Compose with `CardContent p-5`. Don't stack cards inside cards — use sections/borders instead.

### Badge

Pill (`rounded-full px-2.5 py-0.5 text-xs font-medium`). Tones map to domains: status colors come from `status-badge.tsx` maps (contest/submission/payment/prize/account). Difficulty: easy=green, medium=amber, hard=red.

### Tables / lists

Row lists inside cards use `divide-y divide-border` with `px-5 py-3` rows — preferred over bordered tables for transactional data.

### Feedback

| Component | Purpose |
|---|---|
| `Skeleton` | Loading placeholders shaped like content (never spinners alone for >200ms loads) |
| `Spinner` | Inline busy indicator (buttons, OAuth callback) |
| `ErrorBanner` | Red alert strip for recoverable errors; message is human, actionable |
| `EmptyState` | Dashed-border panel: one-line title + optional hint; suggest next action |
| `StatCard` | Label (micro-caps) + big tabular value + optional sub note |
| Success notice | Emerald variant of ErrorBanner styling with `role="status"` |

**State coverage rule:** every async surface implements all four — loading, error, empty, success. No silent `null` returns for failed queries on user-facing pages.

## 8. Motion

Library: `motion` (Framer Motion) — the only allowed animation dependency.

- Marketing reveals: `Reveal` (fade + 20px rise, ~0.5s, whileInView once).
- Hero: staggered entrance ≤ 0.6s total.
- Hover transitions: `transition-colors` (150ms) on interactive elements; `-translate-y-0.5 shadow-md` lifts on marketing cards only.
- Workspace/editor: **no decorative motion**. Judge results update instantly.
- `globals.css` kills animations/transitions globally under `prefers-reduced-motion: reduce`.

## 9. Accessibility

- Semantic landmarks: single `<main>` per page, `<nav aria-label>` for navigation groups, `<footer>`, `<aside>` for sidebars.
- Icon-only controls require `aria-label` (e.g., mobile menu open/close states).
- Decorative icons get `aria-hidden="true"`.
- Forms: label + control via `htmlFor`/`id`; radio groups use `<fieldset><legend>`; errors reference inputs via `aria-describedby`.
- Focus: visible rings everywhere (`focus-visible:ring-2 ring-offset-2`); keyboard-reachable custom controls.
- Dialogs/menus: escape closes, focus returns to trigger (mobile menu toggles `aria-expanded`).
- Contrast: body text ≥ 4.5:1.
- Live regions: judge status line and notices use `role="status"` / `aria-live="polite"` where they change asynchronously.

## 10. Responsive behavior

Breakpoints: Tailwind defaults (`sm 640`, `md 768`, `lg 1024`, `xl 1280`).

- Navbar collapses to hamburger below `md`; mobile panel lists all links.
- Contest workspace: sidebar problem-list becomes horizontal snap-scroll strip on <lg; statement stacks above editor; toolbar wraps.
- Data grids: 1-col mobile → 2-col tablet → 3/4-col desktop.
- Touch targets ≥ 40px height for primary actions; pagination/nav pills padded accordingly.
- No horizontal scroll at 360px width; long identifiers truncate (`truncate`, `min-w-0`).

## 11. SEO & metadata conventions

- Root metadata in `app/layout.tsx` (title template `%s · SkillHill`, OG/Twitter, `metadataBase` from `NEXT_PUBLIC_APP_URL`).
- Per-route `layout.tsx` exports metadata for client pages; server pages export/generate directly.
- Dynamic pages (`contests/[id]`, `problems/[id]`) use `generateMetadata` with graceful fallback and canonical URLs.
- Private/auth pages set `robots: { index: false }`. Admin sets it globally plus `nocache`.
- `sitemap.ts` lists public routes only; `robots.ts` disallows dashboard/wallet/profile/workspace/auth paths.

## 12. Do / Don't

**Do**

- Use tokens (`bg-card`, `text-muted-foreground`) so dark mode keeps working.
- Keep one visual language across web and admin (same fonts, radii, badge shapes).
- Show money as `inr(paise)` from `lib/format.ts` — never hand-format rupees.
- Reserve red for destructive/error; reserve green for success/money-in.
- Use orange strategically — CTAs, brand moments, scores. Not as default icon background.

**Don't**

- Don't hardcode hex colors or arbitrary spacing values (`p-[13px]`) in components.
- Don't add new animation libraries, gradients-per-section, or backdrop blurs beyond the navbar.
- Don't put buttons inside links (or vice versa) — style the anchor instead.
- Don't swallow query failures into empty states; show the error banner.
- Don't build a one-off component when composing existing primitives works.
- Don't make every icon container orange. Use muted/neutral backgrounds by default.
- Don't use excessive card grids. Use editorial/alternating layouts for features.
- Don't use floating gradient orbs, animated gradient text, or decorative blobs.
