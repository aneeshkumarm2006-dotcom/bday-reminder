# Circle the date - marketing website

The public landing site for **Circle the date**, the free birthday & event
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

## Structure

```
app/
  layout.tsx          fonts, metadata/OG/Twitter, theme provider, header/footer
  page.tsx            the landing page (hero → value → features → how → CTA)
  privacy|terms|contact/   legal + contact pages
  sitemap.ts robots.ts manifest.ts   SEO route handlers
  icon.svg opengraph-image.tsx        branded favicon + generated OG card
  globals.css         design tokens (§12.1) + Tailwind @theme (§12.2)
components/
  ring.tsx animated-ring.tsx          the ⭐ ring (dates only, §7) + day-of draw-on
  app-preview.tsx                     on-brand rendered "screenshots" of the app
  site-header/footer brand theme-*    chrome + dark-mode toggle
  ui/button.tsx                       cva button (§8.14)
lib/site.ts                           name, copy, outbound links
```

## Deploy

Deploy on Vercel (or any Node host). Set `NEXT_PUBLIC_SITE_URL` /
`NEXT_PUBLIC_APP_URL` to the real origins.
