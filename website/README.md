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
- `INDEXNOW_KEY` - instant indexing for Bing and friends. See
  [IndexNow](#indexnow-instant-indexing) for the one manual setup step.

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

## IndexNow (instant indexing)

[IndexNow](https://www.indexnow.org/) is a free, open protocol: publish, change
or delete a URL and the site *tells* the engines, instead of waiting to be
crawled. **Bing, Yandex, Naver, Seznam and Yep** participate — **Google does
not**, and nothing here affects Google, which still discovers the site through
`app/sitemap.ts` as before.

Bing is the reason to bother: it is a primary retrieval layer for ChatGPT
Search, so a post Bing hasn't re-crawled is a post that doesn't exist to a large
slice of AI search. There is no paid API and no new dependency — one `fetch` to
`api.indexnow.org`.

Two things ping, covering the two ways a page changes:

- **The admin.** Every publish path in `/seoteam` calls `pingIndexNow()`
  (`lib/indexnow.ts`) on create, update, unpublish and delete — posts, custom
  pages, keyword landing pages, the homepage, per-route SEO, and bulk imports.
  A slug rename submits both halves; a deletion submits the URL too, because
  fetching the 404 is how an engine learns to drop it.
- **Deploys.** `.github/workflows/indexnow.yml` runs on pushes to `main` that
  touch `website/`, waits for the Vercel deploy, diffs production's
  `/sitemap.xml` against the previous run's snapshot, and submits only what
  moved. That's the half the admin can't see: landing pages whose copy lives in
  `lib/content/seo-pages/`.

The ping is a hint, never a step: it is fire-and-forget, it never throws, and it
can't delay or fail the save that triggered it. It submits exactly the URLs the
sitemap advertises — `noindex`, `sitemap.exclude` and the sitewide indexing
kill-switch are all honoured — and never an authenticated `(app)` route.
Nothing is submitted unless `VERCEL_ENV=production`, so dev and preview deploys
stay silent.

### Setup — one manual step

1. Generate a key at [bing.com/webmasters](https://www.bing.com/webmasters) →
   **IndexNow**. (Any 8–128 hex-ish string works; using theirs is simplest.)
2. Create `website/public/<key>.txt` containing **exactly that key** and nothing
   else, and commit it. It is public by design — serving it at
   `https://birthdayreminders.us/<key>.txt` is how ownership is proven, so it is
   not a secret and does not belong in `.env` alone.
3. Set `INDEXNOW_KEY` to the same value in **Vercel → Settings → Environment
   Variables (Production)**, and as the `INDEXNOW_KEY` **GitHub repository
   secret** (Settings → Secrets and variables → Actions) for the workflow.
   Redeploy — Vercel bakes env vars at build time.

Leave any of it out and nothing breaks: with no key the helper is a silent
no-op, and the workflow logs a warning and skips.

### Manual submission

```bash
npm run indexnow:ping -- /blog/my-post /birthday-calendar
npm run indexnow:ping -- --all             # every URL in the live sitemap
npm run indexnow:ping -- --all --dry-run   # print, don't submit
```

Use it for the first backfill after switching IndexNow on, or to re-submit after
fixing the key file. A `403` or `422` in the logs means exactly one thing: the
key file is wrong, and every ping is being thrown away until it's fixed.

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
  indexnow.ts                         IndexNow ping (Bing et al.) — see above
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
`SEO_DASHBOARD_PASSWORD`, and `MONGODB_URI` for the admin, and `INDEXNOW_KEY`
(Production) if you want instant indexing.
