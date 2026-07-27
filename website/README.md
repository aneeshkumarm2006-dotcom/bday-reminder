# Birthday Reminders - marketing website

The public landing site for **Birthday Reminders**, the free birthday & event
reminder app. Built with **Next.js 16** (App Router, Turbopack) + **Tailwind
CSS v4**, on-brand with the app's design system (`_ai_context/Bday_design`).

## Stack

- **Next.js 16** - App Router, static prerendered marketing pages.
- **Tailwind CSS v4** - CSS-first `@theme`; design tokens live in `app/globals.css`.
- **shadcn/ui foundation** - `components.json` + `cn()` (`lib/utils.ts`) + cva
  primitives (`components/ui`), themed to the design tokens.
- **lucide-react** - icons. **framer-motion** - the restrained §9 motion (ring
  draw-on, mount fade+rise). **next-themes** - class-based light/dark.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (Turbopack)
npm run start      # serve the build
npm run lint       # eslint (next lint was removed in Next 16)
npm run typecheck  # tsc --noEmit
```

## Configuration

Copy `.env.example` to `.env.local`. Both vars are optional (defaults in
`lib/site.ts`):

- `NEXT_PUBLIC_SITE_URL` - the site's own origin (canonical, OG, sitemap, robots).
- `NEXT_PUBLIC_APP_URL` - the deployed web app, the "open the app" CTA target.

## Site admin (`/seoteam`)

The SEO team controls everything public from one password-gated dashboard — no
developer, no redeploy:

| Screen | What it controls |
| --- | --- |
| **Overview** | Counts, "needs attention" (SEO failures, unpublished drafts, 404 spikes), recent activity |
| **Posts / Media** | The blog CMS and the Cloudinary-backed image library |
| **Landing** | Every section of the homepage — order, visibility, and copy, with draft → preview → publish |
| **Pages** | A block-based builder for new pages at the site root, with scheduling |
| **Legal** | Privacy, terms, and contact copy (rich text) |
| **Site** | Identity, SEO defaults, analytics IDs, socials, announcement bar, sitewide noindex |
| **Meta** | Per-route title/description/keywords/canonical/OG/robots/sitemap + custom JSON-LD |
| **Nav** | Header links and buttons, footer groups, legal line |
| **Redirects** | Redirect rules plus a 404 log with one-click "create redirect" |
| **Activity** | Audit log, revision snapshots with restore, and JSON export/import |

Three rules hold the whole thing together:

1. **Hardcoded defaults, DB overrides.** Every default lives in
   `lib/content/defaults.ts` and every read deep-merges the stored document over
   it (`lib/content/merge.ts`). With no `MONGODB_URI`, or with an unreachable or
   half-filled database, the public site renders exactly as it did before the
   admin existed. Clearing a field *is* the reset button.
2. **No cron.** Scheduling — announcement windows, scheduled pages — is
   evaluated at request time on force-dynamic routes, so content goes live on
   the minute with nothing running in the background.
3. **IDs, never scripts.** Analytics is ID fields rendered into fixed `<Script>`
   templates; rich text is sanitized server-side on write; custom JSON-LD is
   parsed and type-allowlisted. A shared-password admin must not be an XSS vector.

Optional: `npm run seed:content` writes today's copy into Mongo so the admin
opens pre-populated instead of showing placeholders.

## Structure

```
app/
  layout.tsx          fonts, admin-driven metadata/OG/Twitter, theme, analytics
  (marketing)/
    page.tsx          the landing page — renders the admin's section list
    [slug]/           admin-built custom pages (read-gated, redirect-aware)
    privacy|terms|contact/   legal + contact pages (admin-managed copy)
  seoteam/            the full site admin (see above) + its /api routes
  sitemap.ts robots.ts manifest.ts llms.txt/   SEO + discovery routes
  icon.svg opengraph-image.tsx        branded favicon + generated OG card
  globals.css         design tokens (§12.1) + Tailwind @theme (§12.2)
components/
  ring.tsx animated-ring.tsx          the ⭐ ring (dates only, §7) + day-of draw-on
  app-preview.tsx                     on-brand rendered "screenshots" of the app
  marketing/                          landing sections + page blocks (pure props)
  seoteam/admin/                      the admin editors
  site-header/footer brand theme-*    chrome + dark-mode toggle
  ui/button.tsx                       cva button (§8.14)
lib/
  site.ts                             origin + fallback constants
  content/                            models, defaults, merge, validation, getters
```

## Test

```bash
npm run test    # vitest — content merge/fallback, validation, SEO checks, JSON-LD
npm run e2e     # playwright — admin gating + the no-database defaults path

# The database-backed admin flows (edit → publish → public site) opt in:
MONGODB_URI="mongodb://127.0.0.1:27017/ctd-e2e" npm run e2e
```

`next build` must succeed **with no env vars at all** — that's the regression
that matters most, since it proves the defaults path still renders the site.

## Deploy

Deploy on Vercel (or any Node host). Set `NEXT_PUBLIC_SITE_URL` /
`NEXT_PUBLIC_APP_URL` to the real origins, plus `SESSION_SECRET`,
`SEO_DASHBOARD_PASSWORD`, and `MONGODB_URI` for the admin.
