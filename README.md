# SkillHill

Skill-based coding contest platform. Users pay ₹20 to join a contest and win a prize.

## Quick start

```bash
pnpm install
pnpm dev          # starts api (:4000), web (:3000), admin (:3001)
pnpm build        # builds all apps and packages
pnpm lint         # lint all
pnpm typecheck    # typecheck all
```

## Structure

```
apps/
  api/       Express + TypeScript backend
  web/       Next.js user-facing frontend
  admin/     Next.js admin panel
packages/
  shared-types/  TS types shared across apps
  config/        Shared eslint, tsconfig, prettier configs
  ui/            Shared shadcn/ui component library
```

## Environment

Each app has its own `.env.example`. Copy to `.env` and fill in values before running.

## Rules

Read `AI_rules.md` before making any change. It is binding for all agents.
