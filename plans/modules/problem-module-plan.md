# Problem Module Plan

## Purpose
Manage coding problems and their test cases (public + hidden). Problems are referenced by contests via `contest.problemIds[]`. Test cases are embedded sub-documents of the problem — **not a separate module** — because they have no independent existence outside a problem.

## Why Test Cases Are Part of This Module (Not Separate)

- Test cases are inherently sub-documents of a problem — they have no meaning without one
- The judge worker reads test cases via a single service call: `problemService.getTestCases(id, includeHidden)`
- Separate module would add cross-module query complexity for no benefit
- If problems grow to 50+ test cases, they can be extracted to a separate Mongoose **collection** (still within this module) — planned as a ponytail future extraction point

## Architecture

```
apps/api/src/modules/problem/
├── problem.model.ts          # Mongoose schema
├── problem.service.ts        # Business logic
├── problem.routes.ts         # HTTP routes
├── problem.validation.ts     # Zod schemas
├── test-case.model.ts        # Test case schema (sub-document)
└── index.ts                  # Module exports
```

## Data Model

### Problem Schema
| Field | Type | Notes |
|-------|------|-------|
| `contestId` | ObjectId | Reference to contest |
| `title` | String | Problem title |
| `slug` | String | URL-safe identifier |
| `description` | String | Full problem description (Markdown) |
| `imageUrls` | String[] | Statement diagrams/images (Cloudflare R2, WebP) |
| `type` | Enum | `coding` (default) / `mcq` |
| `difficulty` | Enum | `easy` / `medium` / `hard` |
| `points` | Number | Base score for solving |
| `order` | Number | Display order within contest |
| `timeLimit` | Number | Execution time limit in ms (default 2000) — coding only |
| `memoryLimit` | Number | Memory limit in MB (default 256) — coding only |
| `languageSupport` | String[] | e.g., `["javascript", "python", "cpp"]` — empty for mcq |
| `solutionTemplate` | Object | `{ "javascript": "...", "python": "..." }` — coding only |
| `testCases` | [TestCase] | Array of test cases (see below) — coding only |
| `options` | String[] | MCQ answer choices — mcq only (min 2) |
| `correctAnswer` | Number | MCQ correct option index (0-based) — mcq only, **never exposed** |
| `correctSolution` | String | Reference solution (stored separately, never exposed) |
| `status` | Enum | `draft` / `published` |

### TestCase Sub-document
| Field | Type | Notes |
|-------|------|-------|
| `input` | String | Test case input |
| `expectedOutput` | String | Expected output |
| `isPublic` | Boolean | Whether visible to participants |
| `order` | Number | Display order |
| `description` | String | Optional description for public cases |

## Key Rules
- **Hidden test cases are NEVER returned to client** — stripped via Mongoose `toJSON` transform
- **MCQ `correctAnswer` is NEVER returned to client** — stripped via the same `toJSON` transform (options stay visible)
- **Correct solution stored in separate collection** — never embedded in problem doc
- **Problems cannot be edited once contest is active** — must clone and create new version
- **Test cases are ordered by importance** — partial scoring possible if some pass

## MCQ Problems
- `type: "mcq"` requires `options` (≥ 2) and `correctAnswer` (valid 0-based index) — enforced by a Zod `superRefine` on create and update
- MCQ problems skip the language-catalog check and store `languageSupport: []` (the model validator allows an empty list only for mcq)
- Adding test cases to an mcq problem is rejected (`MCQ_NO_TEST_CASES`)
- Switching types via PATCH normalizes the other type's fields (coding → mcq clears `languageSupport`/`solutionTemplate`/`testCases`; mcq → coding clears `options`/`correctAnswer` and requires a language)
- An options-only PATCH on an mcq re-validates the stored `correctAnswer` index in the service (`MCQ_INVALID_ANSWER`)
- Judge integration: the judge worker must branch on `type` — compare the submitted option index to `correctAnswer` for mcq instead of running code (lands with the judge module, Phase 4)

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/contests/:id/problems | Public | List problems (no hidden test cases) |
| GET | /api/contests/:id/problems/:pid | Public | Single problem details |
| POST | /api/contests/:id/problems | Admin | Add problem to contest |
| PATCH | /api/contests/:id/problems/:pid | Admin | Update problem (draft only) |
| DELETE | /api/contests/:id/problems/:pid | Admin | Remove problem (draft only) |
| POST | /api/problems/:pid/test-cases | Admin | Add test case |
| DELETE | /api/problems/:pid/test-cases/:tcid | Admin | Remove test case |
| POST | /api/problems/:pid/images | Admin | Upload statement image (appends to `imageUrls`, 1280x1024 WebP, draft only) |
| DELETE | /api/problems/:pid/images/:index | Admin | Remove statement image by index (draft only) |
| GET | /api/problems | Public | Practice library — search/filter (difficulty, type, language) + pagination; only problems from contests in `active`/`frozen`/`settled` |
| GET | /api/problems/:pid | Public | Single practice problem — 404 `PROBLEM_NOT_FOUND` when its contest is `draft`/`cancelled` |

## Practice Library (added with the website pass)
- `GET /problems` powers `/problems` on the web: `?search=&difficulty=&type=&language=&page=&limit=`
- `GET /problems/:id` powers `/problems/[id]` (statement, public examples, starter template, MCQ options)
- Hidden test cases + `correctAnswer` stay stripped via the schema toJSON transform — practice routes add no extra exposure
- Implementation: `practiceProblemRouter` in `problem.routes.ts`, mounted at `/problems` in `app.ts`

## Statement Images
- `imageUrls: string[]` — multiple diagrams supported; managed via `POST/DELETE .../images`
- Upload reuses the shared upload stack (`uploadImageToR2` + `createImageUploadMiddleware` + `createImageUploadErrorHandler`) — same pattern as language logos and avatars
- `assertProblemEditable` (draft contest + problem exists) runs **before** the R2 upload so a locked/unknown problem can't orphan an object
- Images are public (part of the statement) — not stripped by the toJSON transform

## Best Practices
- Hidden test cases stripped at Mongoose schema level
- Correct solution reference stored in separate encrypted collection
- Problem cannot be modified once contest transitions from `draft` to `active`
- Solution templates provided per language
- Test cases validated to have both `input` and `expectedOutput`

## Skills
- backend-development — core implementation
- express-typescript — route patterns
- security-review — hidden test case protection
- mongodb-query-optimizer — indexing for contest + problem lookups