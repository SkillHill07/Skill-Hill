# Site Content Modules — Plan (Logo, Why Choose Us, Banner, FAQ)

## Goal

Power the public marketing site (`apps/web` home page sections) with admin-managed
content through the API. Four small, independent modules that share one pattern:

| Module | Model (collection) | Public read | Admin writes | Image upload |
|--------|--------------------|-------------|--------------|--------------|
| Site Logo | `SiteLogo` (singleton) | GET /site/logo | PUT /site/logo | POST /site/logo/upload |
| Why Choose Us | `WhyChooseUsItem` (list) | GET /site/why-choose-us | POST / PATCH /:id / DELETE /:id | — (emoji/icon string) |
| Banner | `Banner` (list) | GET /site/banners | POST / PATCH /:id / DELETE /:id | POST /site/banners/:id/image |
| FAQ | `Faq` (list) | GET /site/faqs | POST / PATCH /:id / DELETE /:id | — |

## Conventions reused from the codebase

- Feature module layout: `model.ts`, `validation.ts` (Zod), `service.ts`, `routes.ts`, `index.ts`
- Public GETs show **active items only**; staff pass `?includeInactive=true` (non-staff → 403)
- Writes gated by `authenticate` + `requireRole("admin", "creator")`
- Image upload reuses `uploadImageToR2` (Sharp → WebP, Cloudflare R2) + the shared
  `createImageUploadMiddleware` / `createImageUploadErrorHandler` factory
- Errors thrown as `Object.assign(new Error(...), { status, code })`; `errorHandler` maps them
- Routes carry full paths (`/site/...`) inside each router (problem-module style) for easy test mounting
- `id` path params validated as 24-hex ObjectId → malformed ids 400 at the boundary (not a 500 CastError)

## 1. Site Logo — singleton

Branding for the navbar. One document, keyed by a fixed `key: "primary"` (unique index).

Schema:

- `key` — fixed `"primary"` (unique, immutable)
- `logoUrl` — `string | null`, R2 URL (max 500)
- `altText` — `string` (default `""`, max 120)
- `tagline` — `string | null` (max 200)

Endpoints:

- `GET /site/logo` — public. Auto-creates the singleton on first call (frontend always gets 200)
- `PUT /site/logo` — admin/creator. Upserts `altText` / `tagline` / `logoUrl`
- `POST /site/logo/upload` — admin/creator. Multipart `image` (JPEG/PNG/WebP, max 5MB),
  compressed to WebP 512×512 q90, folder `site/logo`, then persists the returned URL.

## 2. Why Choose Us — ordered feature list

The "why participate" section (e.g. prize pools, fair judging, instant results).

Schema: `title` (max 120), `description` (max 1000), `icon` (emoji/icon key, default `"✨"`, max 100),
`order` (int ≥ 0, default 0), `active` (bool, default true).

Endpoints: `GET /site/why-choose-us`, `POST /site/why-choose-us` (201),
`PATCH /site/why-choose-us/:id`, `DELETE /site/why-choose-us/:id`.

## 3. Banner — hero/announcement carousel

Schema: `title` (max 120), `subtitle` (nullable, max 300), `imageUrl` (nullable R2, max 500),
`ctaText` (nullable, max 60), `ctaLink` (nullable valid URL, max 500), `order`, `active`.

Endpoints:

- `GET /site/banners`, `POST /site/banners` (201), `PATCH /site/banners/:id`, `DELETE /site/banners/:id`
- `POST /site/banners/:id/image` — multipart `image`, compressed to WebP 1920×720 q85,
  folder `site/banner-{id}`. **Pre-check `assertBannerExists` BEFORE upload** so an unknown
  banner can't orphan an R2 object (problem-module pattern).

## 4. FAQ — accordion content

Schema: `question` (max 300), `answer` (max 5000), `category` (nullable, max 60),
`order`, `active`.

Endpoints: `GET /site/faqs` (optional `?category=` filter), `POST /site/faqs` (201),
`PATCH /site/faqs/:id`, `DELETE /site/faqs/:id`.

## Security & safety

- Writes: admin/creator only. Public reads never see inactive items.
- `includeInactive=true` honored only for staff; other callers get active-only (403 if asked).
- Uploads: MIME allow-list + 5MB cap via multer; WebP re-encode strips any payload.
- `ctaLink` must be a valid absolute URL (zod `z.string().url()`).
- No user input is ever concatenated into commands or HTML — content is rendered by the
  frontend as text (frontend must escape/sanitize before rendering rich HTML).

## Testing

- `logo.routes.test.ts` — GET singleton, PUT upsert, upload success / missing file /
  bad MIME / oversized / upload-failure propagation
- `whyChooseUs.routes.test.ts` — public list (active-only), includeInactive gating (403 for
  non-staff), create / update / delete, validation 400
- `banner.routes.test.ts` — CRUD + image upload incl. **no-orphan test** (404 before upload)
- `faq.routes.test.ts` — CRUD, category filter, gating, validation

Auth stubbed pass-through (admin) + configurable `currentUser` to exercise role gating.
Multer runs for real (real MIME filter + size limit). `uploadImageToR2` mocked.

## Build status — ✅ complete (2026-08-02)

All four modules implemented, wired, and tested:

- Modules: `apps/api/src/modules/{logo,whyChooseUs,banner,faq}/` (model, validation, service, routes, index)
- Mounted in `app.ts` (routers carry full `/site/...` paths) + Swagger tables/tags added
- Shared types: `SiteLogo`, `WhyChooseUsItem`, `Banner`, `Faq` added to `packages/shared-types`
- Route tests: 42 new tests (logo 8, why-choose-us 9, banner 15, faq 10) — **104 total, all passing**
- Typecheck + lint clean

Security hardening applied during review:

- `ctaLink` rejects executable schemes (`javascript:`/`data:`/`vbscript:`) via a zod refine —
  the frontend renders this as an `<a href>`
- `id` path params validated as 24-hex ObjectId at the boundary (400, not a 500 CastError)
- Banner image route asserts the banner exists **before** uploading (no orphaned R2 objects)

## Out of scope (ponytail notes)

- No `startAt`/`endAt` banner scheduling — use `active` + `order` for now
- No content versioning / audit trail — `timestamps` only
- No auto-seed of default content — admin creates it
- Logo/banner images are cropped to a fixed aspect (cover fit) — no free-form focal point
- Orphaned R2 object cleanup on delete/replace deferred (single-region upload already noted in upload.ts)
- `includeInactive` gating is repeated inline in each routes file — could be a shared middleware
  if a fifth content module shows up
