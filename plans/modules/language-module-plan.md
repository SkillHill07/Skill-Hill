# Language Module Plan

## Purpose
Manage the catalog of programming languages the judge supports. The Problem module
references these languages (via `languageSupport: string[]` of language keys) instead of
free-floating strings, so the admin panel can only attach languages the judge can actually run.

## Relationship with Other Modules

```
Language Module (this)
  ├── referenced by → Problem Module (problem.languageSupport = language keys)
  ├── referenced by → Judge Module (Phase 4: language commands/images come from here)
  └── used by       → Contest Workspace UI (language selector)
```

- Problems store **language keys** (`languageSupport: ["javascript", "cpp"]`), validated
  against this module on create/update.
- The judge worker (Phase 4) reads `compileCommand` / `runCommand` / `dockerImage` from here
  instead of a hardcoded `languages.ts`.
- Language registry is seeded with the 5 default languages on server boot (idempotent upsert).

## Architecture

```
apps/api/src/modules/language/
├── language.model.ts        # Mongoose schema
├── language.service.ts      # Business logic (CRUD, validateLanguageKeys, seed)
├── language.routes.ts       # HTTP routes
├── language.validation.ts   # Zod schemas
└── index.ts                 # Module exports
```

## Data Model

### Language Schema
| Field | Type | Notes |
|-------|------|-------|
| `key` | String | Unique slug (e.g. `javascript`). Referenced by problems. |
| `name` | String | Display name (e.g. `JavaScript`) |
| `version` | String | Default version/alias used by the judge (e.g. `20-alpine`) |
| `extension` | String | File extension without dot (e.g. `js`) |
| `compileCommand` | String \| null | Command template with `{file}` placeholder, null for interpreted langs |
| `runCommand` | String | Command template with `{file}` placeholder (e.g. `node {file}.js`) |
| `dockerImage` | String | Base image for the sandbox (e.g. `node:20-alpine`) |
| `logoUrl` | String \| null | Language logo on Cloudflare R2 — uploaded via `POST /languages/:key/logo` (multipart, WebP 256x256) |
| `enabled` | Boolean | Soft-disable a language without deleting problems that use it |
| `order` | Number | Display order in the language selector |

### Default Seed
| key | name | version | ext | compileCommand | runCommand | image |
|-----|------|---------|-----|----------------|------------|-------|
| javascript | JavaScript | 20-alpine | js | null | `node {file}.js` | node:20-alpine |
| typescript | TypeScript | 20-alpine | ts | null | `npx tsx {file}.ts` | node:20-alpine |
| python | Python | 3.12-alpine | py | null | `python3 {file}.py` | python:3.12-alpine |
| cpp | C++ | 13-alpine | cpp | `g++ -o {file} {file}.cpp` | `./{file}` | gcc:13-alpine |
| java | Java | 21-alpine | java | `javac {file}.java` | `java {file}` | openjdk:21-alpine |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /languages | Public | List enabled languages (sorted by order) |
| GET | /languages?includeDisabled=true | Admin/Creator | List all languages |
| GET | /languages/:key | Public | Single language (enabled only unless staff) |
| POST | /languages | Admin/Creator | Create a language |
| PATCH | /languages/:key | Admin/Creator | Update a language |
| POST | /languages/:key/logo | Admin/Creator | Upload logo (multipart field `logo`, JPEG/PNG/WebP ≤5MB → WebP 256x256 on R2) |
| DELETE | /languages/:key | Admin | Delete a language (409 if referenced by problems) |

## Service Functions

- `listLanguages({ includeDisabled })` — ordered list
- `getLanguageByKey(key)` — single
- `createLanguage(input)` / `updateLanguage(key, input)` / `deleteLanguage(key)`
- `validateLanguageKeys(keys)` — throws if any key is missing or disabled; **called by problem service**
- `seedDefaultLanguages()` — idempotent upsert of the default 5, called on server boot

## Image Upload

- Reuses the shared upload stack (`utils/upload.ts` → Sharp → Cloudflare R2) also used by avatars.
- `POST /languages/:key/logo` (admin/creator) accepts multipart `logo` (JPEG/PNG/WebP, ≤5MB), compresses to WebP 256x256, stores at `languages/{key}/{hash}.webp`, sets `logoUrl`.
- Multer errors (wrong type / too large) are mapped to a 400 by `handleMulterErrors` in the routes file.

## Best Practices
- `key` is the stable contract — problems reference it, never the ObjectId
- Deletion is blocked while any problem references the language (referential integrity)
- Disabled languages remain valid in `validateLanguageKeys` only for existing problems;
  new problems cannot be created with a disabled language
- `compileCommand`/`runCommand` use a `{file}` placeholder consumed by the judge worker (Phase 4)

## Skills
- backend-development — core implementation
- express-typescript — route patterns
- mongodb-query-optimizer — indexing (`key` unique)
- ponytail — debt tracking
