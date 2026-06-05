# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Dev server (next dev, default port 3000)
npm run build            # Production build (output: standalone)
npm run lint             # ESLint (eslint-config-next, flat config eslint.config.mjs)
npm run prisma:generate  # Regenerate Prisma client after schema.prisma changes
npm run prisma:migrate   # prisma migrate dev (create + apply migration locally)
npm run prisma:seed      # Seed DB (npx tsx prisma/seed.ts)
```

No test framework is configured. One-off scripts live in `scripts/` and run via `npx tsx scripts/<name>.ts` (e.g. `make-super-admin.ts`, `test-session-revocation.ts`).

Docker (production parity): `docker-compose up --build`. Compose maps host **3100 → container 3000**; `NEXTAUTH_URL` and DB connection are wired in `docker-compose.yml`. PowerShell deploy/backup/restore/update helpers are at repo root and in `scripts/` (`.ps1`).

Required env (see `.env.example`): `DATABASE_URL` (PostgreSQL), `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `CRON_SECRET`, `ENABLE_AUTO_UPDATE`.

## Architecture

Next.js 15 App Router + React 19, PostgreSQL via Prisma 5, NextAuth (JWT credentials), Tailwind, TipTap rich-text editor. UI strings and commit messages are in Indonesian.

### Multi-site is the core domain model
This is a **multi-tenant** announcement CMS. Sites are first-class; most data is scoped to a `Site`. Key relationships in `prisma/schema.prisma`:
- `Announcement` ↔ `Site` is **many-to-many** via the `AnnouncementSite` junction (content syndication). An announcement appears on multiple sites; one junction row has `isPrimary = true`. Never assume a single site per announcement — query/filter through `sites.some({ siteId })` and derive `primarySite` from the junction.
- `Category`, `NewsletterSubscriber`, `SiteSettings` are hard-scoped to one `siteId`. `MediaLibrary`, `ActivityLog`, `EmailTemplate` use **nullable** `siteId` (null = shared/global).
- `Settings` (singleton, `id=1`) is legacy global config; per-site overrides live in `SiteSettings`.

### Access control (two layers)
1. **`isSuperAdmin`** (boolean on `User`) — bypasses all site checks, sees all active sites.
2. **`UserSiteAccess`** — per-site `SiteRole` (`SITE_ADMIN` > `EDITOR` > `VIEWER`). Separate from the global `User.role` (`ADMIN`/`EDITOR`).

Always gate writes through `lib/site-access.ts` helpers — `canEditOnSite`, `canAdminSite`, `getAccessibleSites`, `getUserSiteRole`. API routes loop over target `siteIds` and call `canEditOnSite` before mutating (see `app/api/announcements/route.ts` POST). Don't hand-roll permission checks.

### Site context propagation
The "current site" for the admin panel is stored in **httpOnly cookies** (`current_site_id`, `current_site_slug`) managed by `lib/site-context.ts`. Public routes are path-based: `/site/[siteSlug]/...`. `next.config.ts` 301-redirects legacy `/article/*`, `/category/*`, `/search` URLs into `/site/sja-utama/*`. Root `/` redirects to `/site` (the site picker) via `middleware.ts`.

### Request pipeline conventions
- **`middleware.ts`** handles root redirect, security headers, and in-memory IP rate limiting (per-IP+path-segment; stricter limits on `/auth`, `/backup`). Limits reset on restart — it's not distributed.
- **API routes** (`app/api/*/route.ts`): get session via `getServerSession(authOptions)`; validate body with Zod schemas from `lib/validation-schemas.ts` using `validateInput(Schema, body)` + `formatZodErrors`; **all HTML content is XSS-sanitized via `sanitizeHTML` (DOMPurify) inside the schemas** — never persist raw user HTML. Mutations write an `ActivityLog` row.
- **Auth** (`lib/auth.ts`): JWT strategy with **DB-backed session revocation** — every token refresh re-checks `UserSession.isRevoked`/`expiresAt` and clears the token if invalid (fail-open on DB error). Sign-in creates a `UserSession` row. Sign-in page is `/admin-login`.
- **Scheduler** (`lib/scheduler.ts`): no external cron. `runScheduler()` is throttled (60s) and invoked opportunistically from server render (`app/admin/page.tsx`); it auto-publishes (`scheduledAt <= now`) and auto-takes-down (`takedownAt <= now`). There's also a protected `/api/scheduler` route (Bearer `CRON_SECRET`) for external triggering.

### Prisma client
Import the singleton from `lib/prisma.ts` (`import prisma from "@/lib/prisma"`) — it guards against hot-reload connection exhaustion. The `@/*` path alias maps to the repo root (`tsconfig.json`), so imports are `@/lib/...`, `@/components/...`, not `@/src/...`. After editing `schema.prisma`, run `prisma:generate`; bump `schemaVersion` in `version.json` when migrations ship.

### Other relations to know
`AnnouncementRevision` (version history, restore), `ApprovalRequest` (content approval workflow), `Comment` (self-referential threading via `parentId`, moderation `status`), `EmailTemplate`/`EmailLog`/`EmailSettings` + newsletter (nodemailer/handlebars). `wordCount` on `Announcement` drives reading-time display.
