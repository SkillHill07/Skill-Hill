# @skillcontest/api

Express + TypeScript REST API — the backend for Skills Arena.

All routes return a standard envelope:

```jsonc
{ "success": true,  "data": { ... }, "message": "..." }  // success
{ "success": false, "error": "...."                      }  // error
```

## Skills

| Skill | Used for |
|---|---|
| `express-typescript` | Route patterns, middleware, auth |
| `backend-development` | General backend conventions |
| `backend-patterns` | Architecture decisions |
| `backend-security-coder` | Input validation, secure coding |
| `security-review` | Auditing auth/payment routes |
| `nodejs-express-server` | Express setup patterns |
| `mongodb-natural-language-querying` | Writing Mongoose queries |
| `mongodb-query-optimizer` | Indexing / slow query fixes |
| `mongodb-search-and-ai` | Atlas Search / Vector Search |
| `razorpay` | Payment integration |
| `ponytail` | Debt tracking |

## Quick start

```bash
pnpm dev           # tsx watch src/server.ts :4000
pnpm build         # tsc
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint src --ext ts
```

## Docs

OpenAPI spec at [/api-docs.json](http://localhost:4000/api-docs.json) and Swagger UI at [/docs](http://localhost:4000/docs).
